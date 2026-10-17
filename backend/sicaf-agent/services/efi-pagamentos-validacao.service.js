/**
 * Valida em lote cobranças abertas na Efí (Gerencianet) e baixa no sistema.
 */
const { getDb } = require('../database/connection');
const gerencianetService = require('./gerencianet.service');

const LOG_PREFIX = '[EfiPagamentos]';
const STATUS_FINAL = new Set(['pago', 'cancelado', 'estornado', 'removido', 'expirado']);
/** Por rodada: evita estourar a API da Efí; rodízio por origem garante manutenção mesmo com fila SICAF grande. */
const LIMITE_CONSULTA = Math.max(
  80,
  parseInt(process.env.EFI_VALIDACAO_LIMITE || '400', 10) || 400,
);
const DELAY_MS = 90;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

/**
 * Rodízio por origem (mais antigas primeiro) para manutenção/SICAF não se bloquearem.
 * Depois completa o restante do limite com as mais antigas restantes.
 */
async function selecionarPendentes(db, limite = LIMITE_CONSULTA) {
  const origensRows = await db('pagamentos as p')
    .whereNull('p.deleted_at')
    .where(function () {
      this.whereNotNull('p.provider_txid').orWhereNotNull('p.provider_charge_id');
    })
    .where(function () {
      this.whereNotIn('p.status', Array.from(STATUS_FINAL)).orWhereNull('p.status');
    })
    .distinct('p.origem');
  const origens = [...new Set(origensRows.map((r) => r.origem || null))];
  const porOrigem = Math.max(25, Math.floor(limite / Math.max(origens.length, 1)));
  const picked = [];
  const ids = new Set();

  for (const origem of origens) {
    let q = queryPendentesAbertos(db).orderBy('p.created_at', 'asc').limit(porOrigem);
    if (origem == null) q = q.whereNull('p.origem');
    else q = q.andWhere('p.origem', origem);
    for (const row of await q) {
      if (ids.has(row.id)) continue;
      ids.add(row.id);
      picked.push(row);
      if (picked.length >= limite) return picked;
    }
  }

  if (picked.length < limite) {
    let q = queryPendentesAbertos(db).orderBy('p.created_at', 'asc').limit(limite - picked.length);
    if (ids.size) q = q.whereNotIn('p.id', Array.from(ids));
    for (const row of await q) {
      if (ids.has(row.id)) continue;
      ids.add(row.id);
      picked.push(row);
    }
  }

  return picked;
}

async function runValidacaoPagamentosEfi({ log } = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const say = (msg) => {
    if (log) log(msg);
    else console.log(`${LOG_PREFIX} ${msg}`);
  };

  const hasPagamentos = await db.schema.hasTable('pagamentos');
  if (!hasPagamentos) {
    return { ok: false, error: 'Tabela pagamentos não encontrada' };
  }

  const pagosSistemaRows = await db('pagamentos as p')
    .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
    .whereNull('p.deleted_at')
    .andWhere('p.status', 'pago')
    .whereNotNull('p.data_pagamento')
    .andWhere('p.data_pagamento', '>=', db.raw('DATE_SUB(NOW(), INTERVAL 30 DAY)'))
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

  const pendentes = await selecionarPendentes(db, LIMITE_CONSULTA);
  const porOrigem = {};
  for (const row of pendentes) {
    const o = row.origem || '—';
    porOrigem[o] = (porOrigem[o] || 0) + 1;
  }
  say(
    `Consultando ${pendentes.length} cobrança(s) aberta(s) na Efí (limite ${LIMITE_CONSULTA}; por origem: ${JSON.stringify(porOrigem)})`,
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
    `${validados.length} validado(s) na Efí e baixado(s) no sistema`,
    `${pagosSistema.length} já pago(s) no sistema (30 dias)`,
    `${pendentesEfi.length} ainda pendente(s) na Efí`,
  ].join(' · ');

  say(message);

  return {
    ok: true,
    message,
    consultados: pendentes.length,
    validadosAgora: validados.length,
    jaPagosSistema: pagosSistema.length,
    pendentesEfi: pendentesEfi.length,
    cancelados: cancelados.length,
    erros: erros.length,
    validados,
    pagosSistema,
    pendentes: pendentesEfi,
    encerrados: cancelados,
    falhas: erros,
  };
}

module.exports = {
  runValidacaoPagamentosEfi,
};
