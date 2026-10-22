/**
 * Valida em lote cobranças abertas na Efí (Gerencianet) e baixa no sistema.
 *
 * Perfis separados (Admin → Processos):
 *  - sicaf       → prioridade taxa anual (~R$ 985 / R$ 985,50)
 *  - manutencao  → boletos de manutenção
 *  - outros      → CAUFESP, avulso, pacotes etc.
 *  - todos       → tudo (SICAF primeiro, depois demais, manutenção por último)
 */
const { getDb } = require('../database/connection');
const gerencianetService = require('./gerencianet.service');

const LOG_PREFIX = '[EfiPagamentos]';
const STATUS_FINAL = new Set(['pago', 'cancelado', 'estornado', 'removido', 'expirado']);

/** Valores típicos da taxa SICAF anual (padrão) — consultados primeiro. */
const SICAF_VALORES_PRIORITARIOS = [985.5, 985, 985.0];

const LIMITE_CONSULTA = Math.max(
  80,
  parseInt(process.env.EFI_VALIDACAO_LIMITE || '400', 10) || 400,
);
const DELAY_MS = Math.max(40, parseInt(process.env.EFI_VALIDACAO_DELAY_MS || '70', 10) || 70);

const PERFIS = {
  sicaf: {
    label: 'SICAF',
    origens: ['sicaf'],
    limiteDefault: Math.max(150, Math.min(LIMITE_CONSULTA, 350)),
  },
  manutencao: {
    label: 'Manutenção',
    origens: ['manutencao'],
    limiteDefault: Math.max(80, Math.min(LIMITE_CONSULTA, 200)),
  },
  outros: {
    label: 'Outros',
    excluirOrigens: ['sicaf', 'manutencao'],
    limiteDefault: Math.max(50, Math.min(LIMITE_CONSULTA, 150)),
  },
  todos: {
    label: 'Todos',
    limiteDefault: LIMITE_CONSULTA,
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function almostEqual(a, b, eps = 0.05) {
  return Math.abs(money(a) - money(b)) <= eps;
}

function isSicafAnualPrioritario(valor) {
  return SICAF_VALORES_PRIORITARIOS.some((v) => almostEqual(valor, v));
}

function normalizePerfil(raw) {
  const p = String(raw || 'todos').toLowerCase().trim();
  if (PERFIS[p]) return p;
  return 'todos';
}

function clienteNome(row) {
  return row.cliente_nome || row.razao_social || row.nome_fantasia || row.cliente_documento || '—';
}

function mapItem(row, extra = {}) {
  return {
    id: Number(row.id),
    clienteId: Number(row.cliente_id) || null,
    clienteNome: clienteNome(row),
    origem: row.origem || null,
    tipo: row.tipo || null,
    valor: money(row.valor),
    statusSistema: String(row.status || '').toLowerCase(),
    txid: row.provider_txid || null,
    chargeId: row.provider_charge_id ? String(row.provider_charge_id) : null,
    dataPagamento: row.data_pagamento || null,
    createdAt: row.created_at || null,
    ...extra,
  };
}

function classificarPix(status) {
  const st = String(status || '');
  if (st === 'CONCLUIDA') return { sistema: 'pago', efi: st };
  if (st.startsWith('REMOVIDA')) return { sistema: 'cancelado', efi: st };
  return { sistema: null, efi: st || 'ATIVA' };
}

function classificarBoleto(status) {
  const st = String(status || '').toLowerCase();
  if (['paid', 'settled'].includes(st)) return { sistema: 'pago', efi: st };
  if (['unpaid', 'expired'].includes(st)) return { sistema: 'expirado', efi: st };
  if (['canceled', 'cancelled', 'refunded'].includes(st)) return { sistema: 'cancelado', efi: st };
  return { sistema: null, efi: st || 'waiting' };
}

async function consultarEfi(row) {
  const tipo = String(row.tipo || '').toLowerCase();
  if (tipo === 'pix' && row.provider_txid) {
    const resp = await gerencianetService.consultarPix(String(row.provider_txid));
    const cls = classificarPix(resp?.status);
    const pix = Array.isArray(resp?.pix) ? resp.pix[0] : null;
    return { ...cls, dadosPix: pix };
  }
  if (tipo === 'boleto' && row.provider_charge_id) {
    const resp = await gerencianetService.consultarCobranca(Number(row.provider_charge_id));
    const cls = classificarBoleto(resp?.data?.status || resp?.status);
    return { ...cls, dadosPix: null };
  }
  return { sistema: null, efi: 'sem_identificador', dadosPix: null };
}

async function propagarLocal(db, pgto) {
  if (pgto.origem === 'sicaf' && pgto.origem_id) {
    const sicafTaxa = require('./sicaf-taxa.service');
    await sicafTaxa.confirmarPagamento(pgto.origem_id);
    return;
  }
  const assessoria = require('./assessoria-portal.service').servicoPorOrigem(pgto.origem);
  if (assessoria && pgto.origem_id) {
    await assessoria.confirmarPagamento(pgto.origem_id);
    return;
  }
  if (pgto.origem === 'manutencao' && pgto.origem_id) {
    await db('manutencao_boletos').where('id', pgto.origem_id).update({
      status: 'Pago',
      data_pagamento: db.fn.now(),
    });
    try {
      const pagamentosService = require('./pagamentos.service');
      await pagamentosService.sincronizarPagamentosDaManutencao(db, pgto.origem_id, {
        pagamentoId: pgto.id,
      });
    } catch (e) {
      console.error(`${LOG_PREFIX} sincronizar irmãs manutenção:`, e.message);
    }
    try {
      const boleto = await db('manutencao_boletos').where('id', pgto.origem_id).first();
      if (boleto) {
        const automacoes = require('./automacoes.service');
        await automacoes.onManutencaoBoletoPago({
          clienteId: Number(boleto.cliente_id || pgto.cliente_id),
          manutencaoId: Number(boleto.manutencao_id) || undefined,
          boletoId: Number(pgto.origem_id),
        });
      }
    } catch (e) {
      console.error(`${LOG_PREFIX} automação manutenção:`, e.message);
    }
    return;
  }
  if (pgto.origem === 'avulso' || pgto.origem === 'personalizado') {
    try {
      const propostas = require('./propostas-comerciais.service');
      await propostas.onPagamentoConfirmado(pgto);
    } catch (e) {
      console.error(`${LOG_PREFIX} proposta:`, e.message);
    }
  }
}

const SELECT_PENDENTE = [
  'p.id',
  'p.cliente_id',
  'p.origem',
  'p.origem_id',
  'p.tipo',
  'p.valor',
  'p.status',
  'p.provider_txid',
  'p.provider_charge_id',
  'p.data_pagamento',
  'p.created_at',
];

function queryPendentesAbertos(db) {
  return db('pagamentos as p')
    .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
    .whereNull('p.deleted_at')
    .where(function () {
      this.whereNotNull('p.provider_txid').orWhereNotNull('p.provider_charge_id');
    })
    .where(function () {
      this.whereNotIn('p.status', Array.from(STATUS_FINAL)).orWhereNull('p.status');
    })
    .select(
      ...SELECT_PENDENTE,
      db.raw("COALESCE(c.razao_social, c.nome_fantasia, '') as cliente_nome"),
      'c.documento as cliente_documento',
    );
}

function applyPerfilFiltro(q, perfil) {
  const cfg = PERFIS[perfil] || PERFIS.todos;
  if (cfg.origens?.length) {
    return q.whereIn('p.origem', cfg.origens);
  }
  if (cfg.excluirOrigens?.length) {
    return q.where(function () {
      this.whereNull('p.origem').orWhereNotIn('p.origem', cfg.excluirOrigens);
    });
  }
  return q;
}

function prioridadeSicafSql(db) {
  // 0 = taxa anual ~985 / 985.50; 1 = demais valores SICAF
  return db.raw(
    `CASE
      WHEN ROUND(p.valor, 2) IN (985.00, 985.50) THEN 0
      WHEN ABS(p.valor - 985.5) < 0.05 OR ABS(p.valor - 985) < 0.05 THEN 0
      ELSE 1
    END`,
  );
}

/**
 * Seleciona pendentes conforme o perfil.
 * SICAF: anuais (~985) primeiro, depois demais SICAF, mais antigos primeiro.
 * Manutenção: mais antigos primeiro.
 * Todos: SICAF prioritário → outros → manutenção.
 */
async function selecionarPendentes(db, { perfil = 'todos', limite } = {}) {
  const p = normalizePerfil(perfil);
  const cfg = PERFIS[p];
  const lim = Math.max(1, limite || cfg.limiteDefault || LIMITE_CONSULTA);

  if (p === 'sicaf') {
    return applyPerfilFiltro(queryPendentesAbertos(db), p)
      .orderBy(prioridadeSicafSql(db), 'asc')
      .orderBy('p.created_at', 'asc')
      .limit(lim);
  }

  if (p === 'manutencao' || p === 'outros') {
    return applyPerfilFiltro(queryPendentesAbertos(db), p)
      .orderBy('p.created_at', 'asc')
      .limit(lim);
  }

  // todos: monta em camadas para não misturar manutenção no começo
  const picked = [];
  const ids = new Set();
  const pushRows = async (rows) => {
    for (const row of rows) {
      if (ids.has(row.id)) continue;
      ids.add(row.id);
      picked.push(row);
      if (picked.length >= lim) return true;
    }
    return false;
  };

  const sicafLim = Math.min(lim, Math.max(120, Math.floor(lim * 0.7)));
  const sicafRows = await applyPerfilFiltro(queryPendentesAbertos(db), 'sicaf')
    .orderBy(prioridadeSicafSql(db), 'asc')
    .orderBy('p.created_at', 'asc')
    .limit(sicafLim);
  if (await pushRows(sicafRows)) return picked;

  const outrosLim = lim - picked.length;
  if (outrosLim > 0) {
    const outrosRows = await applyPerfilFiltro(queryPendentesAbertos(db), 'outros')
      .orderBy('p.created_at', 'asc')
      .limit(outrosLim);
    if (await pushRows(outrosRows)) return picked;
  }

  const manutLim = lim - picked.length;
  if (manutLim > 0) {
    const manutRows = await applyPerfilFiltro(queryPendentesAbertos(db), 'manutencao')
      .orderBy('p.created_at', 'asc')
      .limit(manutLim);
    await pushRows(manutRows);
  }

  return picked;
}

async function runValidacaoPagamentosEfi({ log, perfil = 'todos', limite } = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const perfilNorm = normalizePerfil(perfil);
  const cfg = PERFIS[perfilNorm];
  const say = (msg) => {
    if (log) log(msg);
    else console.log(`${LOG_PREFIX} ${msg}`);
  };

  const hasPagamentos = await db.schema.hasTable('pagamentos');
  if (!hasPagamentos) {
    return { ok: false, error: 'Tabela pagamentos não encontrada' };
  }

  let pagosSistemaQ = db('pagamentos as p')
    .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
    .whereNull('p.deleted_at')
    .andWhere('p.status', 'pago')
    .whereNotNull('p.data_pagamento')
    .andWhere('p.data_pagamento', '>=', db.raw('DATE_SUB(NOW(), INTERVAL 30 DAY)'));
  pagosSistemaQ = applyPerfilFiltro(pagosSistemaQ, perfilNorm);
  const pagosSistemaRows = await pagosSistemaQ
    .select(
      'p.id',
      'p.cliente_id',
      'p.origem',
      'p.tipo',
      'p.valor',
      'p.status',
      'p.provider_txid',
      'p.provider_charge_id',
      'p.data_pagamento',
      'p.created_at',
      db.raw("COALESCE(c.razao_social, c.nome_fantasia, '') as cliente_nome"),
      'c.documento as cliente_documento',
    )
    .orderBy('p.data_pagamento', 'desc')
    .limit(40);

  const pendentes = await selecionarPendentes(db, { perfil: perfilNorm, limite });
  const porOrigem = {};
  let prioritarios = 0;
  for (const row of pendentes) {
    const o = row.origem || '—';
    porOrigem[o] = (porOrigem[o] || 0) + 1;
    if (row.origem === 'sicaf' && isSicafAnualPrioritario(row.valor)) prioritarios += 1;
  }
  say(
    `Perfil ${cfg.label}: consultando ${pendentes.length} cobrança(s) (limite ${limite || cfg.limiteDefault}; SICAF anual prioritário: ${prioritarios}; por origem: ${JSON.stringify(porOrigem)})`,
  );

  const validados = [];
  const pendentesEfi = [];
  const cancelados = [];
  const erros = [];

  for (let i = 0; i < pendentes.length; i += 1) {
    const row = pendentes[i];
    try {
      const consulta = await consultarEfi(row);
      if (consulta.sistema === 'pago') {
        const update = {
          status: 'pago',
          data_pagamento: consulta.dadosPix?.horario ? new Date(consulta.dadosPix.horario) : db.fn.now(),
        };
        if (consulta.dadosPix?.endToEndId) update.provider_e2eid = consulta.dadosPix.endToEndId;
        try {
          await db('pagamentos').where('id', row.id).update(update);
        } catch (e) {
          delete update.provider_e2eid;
          await db('pagamentos').where('id', row.id).update(update);
        }
        await propagarLocal(db, row);
        validados.push(
          mapItem(row, {
            statusSistema: 'pago',
            statusEfi: consulta.efi,
            acao: 'validado_agora',
          }),
        );
      } else if (consulta.sistema === 'cancelado' || consulta.sistema === 'expirado') {
        await db('pagamentos').where('id', row.id).update({ status: consulta.sistema });
        cancelados.push(
          mapItem(row, {
            statusSistema: consulta.sistema,
            statusEfi: consulta.efi,
            acao: consulta.sistema,
          }),
        );
      } else {
        pendentesEfi.push(
          mapItem(row, {
            statusEfi: consulta.efi,
            acao: 'aguardando_efi',
          }),
        );
      }
    } catch (e) {
      erros.push(
        mapItem(row, {
          statusEfi: 'erro',
          acao: 'erro',
          erro: e.message || 'Falha ao consultar Efí',
        }),
      );
    }
    if (i < pendentes.length - 1) await sleep(DELAY_MS);
  }

  const pagosSistema = pagosSistemaRows.map((r) =>
    mapItem(r, { statusEfi: '—', acao: 'ja_pago_sistema' }),
  );

  const message = [
    `[${cfg.label}] ${validados.length} validado(s) na Efí e baixado(s)`,
    `${pendentes.length} consultado(s)`,
    `${pendentesEfi.length} ainda pendente(s)`,
    `${erros.length} erro(s)`,
  ].join(' · ');

  say(message);

  return {
    ok: true,
    message,
    perfil: perfilNorm,
    consultados: pendentes.length,
    validadosAgora: validados.length,
    jaPagosSistema: pagosSistema.length,
    pendentesEfi: pendentesEfi.length,
    cancelados: cancelados.length,
    erros: erros.length,
    prioritariosSicafAnual: prioritarios,
    validados,
    pagosSistema,
    pendentes: pendentesEfi,
    encerrados: cancelados,
    falhas: erros,
  };
}

module.exports = {
  runValidacaoPagamentosEfi,
  selecionarPendentes,
  normalizePerfil,
  PERFIS,
  SICAF_VALORES_PRIORITARIOS,
};
