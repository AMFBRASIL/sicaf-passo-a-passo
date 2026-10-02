/**
 * Assinaturas mensais dos módulos pagos do portal (Assistente Licitações-e, PNCP Inteligente).
 *
 * Cada mensalidade é um registro em `pagamentos` (boleto ou PIX) com origem = módulo.
 * A validade da assinatura é recalculada a partir das mensalidades pagas: cada pagamento
 * libera 1 mês a partir da data de pagamento ou do fim do mês anterior, o que for maior.
 */
const { getDb } = require('../database/connection');

const LOG_PREFIX = '[Modulos]';
const TABELA = 'modulos_assinaturas';
const DIAS_RENOVACAO = 7;

const MODULOS = {
  licitacoes_e: {
    nome: 'Assistente Licitações-e',
    origem: 'modulo_licitacoes_e',
    chaveValor: 'valor_modulo_licitacoes_e',
    valorPadrao: 299,
    protocoloPrefixo: 'MODLE',
  },
  pncp: {
    nome: 'PNCP Inteligente',
    origem: 'modulo_pncp',
    chaveValor: 'valor_modulo_pncp',
    valorPadrao: 699,
    protocoloPrefixo: 'MODPNCP',
  },
};

let ensurePromise = null;

function ensureTable(db) {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      if (!(await db.schema.hasTable(TABELA))) {
        await db.schema.createTable(TABELA, (t) => {
          t.increments('id').primary();
          t.integer('cliente_id').unsigned().notNullable();
          t.string('modulo', 30).notNullable();
          t.decimal('valor', 12, 2).notNullable();
          t.date('valido_ate').nullable();
          t.date('cortesia_ate').nullable();
          t.dateTime('ultimo_pagamento_em').nullable();
          t.timestamps(true, true);
          t.unique(['cliente_id', 'modulo']);
        });
        return;
      }
      if (!(await db.schema.hasColumn(TABELA, 'cortesia_ate'))) {
        await db.schema.alterTable(TABELA, (t) => {
          t.date('cortesia_ate').nullable();
        });
      }
    })().catch((e) => {
      ensurePromise = null;
      throw e;
    });
  }
  return ensurePromise;
}

function isoDate(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hojeIso() {
  return isoDate(new Date());
}

function somarUmMes(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(y, m, d);
  if (alvo.getDate() !== d) alvo.setDate(0);
  return isoDate(alvo);
}

function diasEntre(deIso, ateIso) {
  const a = new Date(`${deIso}T00:00:00`);
  const b = new Date(`${ateIso}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

async function getValor(db, cfg) {
  try {
    const row = await db('configuracoes_sistema').where('chave', cfg.chaveValor).first();
    const v = row ? parseFloat(String(row.valor).replace(',', '.')) : NaN;
    if (Number.isFinite(v) && v > 0) return v;
  } catch (_) {}
  return cfg.valorPadrao;
}

function mapPagamento(p) {
  return {
    id: p.id,
    tipo: p.tipo,
    status: p.status,
    valor: Number(p.valor),
    descricao: p.descricao,
    vencimento: isoDate(p.data_vencimento),
    dataPagamento: p.data_pagamento,
    protocolo: p.protocolo,
    barcode: p.barcode || '',
    link: p.link_boleto || '',
    pdf: p.link_pdf || '',
    txid: p.provider_txid || '',
    qrcodeText: p.qrcode_text || '',
    qrcodeImage: p.qrcode_image || '',
    criadoEm: p.created_at || null,
  };
}

async function obterAssinatura(db, clienteId, modulo) {
  await ensureTable(db);
  return db(TABELA).where({ cliente_id: clienteId, modulo }).first();
}

/** Recalcula a validade a partir de todas as mensalidades pagas do módulo. */
async function recalcularValidade(db, assinatura) {
  const cfg = MODULOS[assinatura.modulo];
  const pagos = await db('pagamentos')
    .whereNull('deleted_at')
    .where({ origem: cfg.origem, origem_id: assinatura.id, status: 'pago' })
    .orderByRaw('COALESCE(data_pagamento, updated_at, created_at) ASC');

  let validoAte = null;
  let ultimo = null;
  for (const p of pagos) {
    const pagoEm = isoDate(p.data_pagamento || p.updated_at || p.created_at);
    const inicio = validoAte && validoAte > pagoEm ? validoAte : pagoEm;
    validoAte = somarUmMes(inicio);
    ultimo = p.data_pagamento || p.updated_at || p.created_at;
  }

  await db(TABELA)
    .where('id', assinatura.id)
    .update({ valido_ate: validoAte, ultimo_pagamento_em: ultimo, updated_at: db.fn.now() });
  return validoAte;
}

async function montarStatus(db, clienteId, modulo) {
  const cfg = MODULOS[modulo];
  const assinatura = await obterAssinatura(db, clienteId, modulo);
  const valor = await getValor(db, cfg);
  const hoje = hojeIso();

  let historico = [];
  if (assinatura) {
    const rows = await db('pagamentos')
      .whereNull('deleted_at')
      .where({ origem: cfg.origem, origem_id: assinatura.id })
      .whereIn('status', ['aguardando', 'gerado', 'pago', 'expirado'])
      .orderBy('id', 'desc')
      .limit(24);
    historico = rows.map(mapPagamento);
  }

  const validoAtePago = assinatura?.valido_ate ? isoDate(assinatura.valido_ate) : null;
  const cortesiaAte = assinatura?.cortesia_ate ? isoDate(assinatura.cortesia_ate) : null;
  const validoAte =
    validoAtePago && cortesiaAte
      ? (validoAtePago > cortesiaAte ? validoAtePago : cortesiaAte)
      : validoAtePago || cortesiaAte;
  const ativo = Boolean(validoAte && validoAte >= hoje);
  const diasRestantes = validoAte ? diasEntre(hoje, validoAte) : null;
  const aberto =
    historico.find(
      (p) =>
        ['aguardando', 'gerado'].includes(p.status) &&
        (!p.vencimento || p.vencimento >= hoje) &&
        (p.barcode || p.qrcodeText),
    ) || null;

  return {
    ok: true,
    modulo,
    nome: cfg.nome,
    valor,
    ativo,
    validoAte,
    validoAtePago,
    cortesiaAte,
    diasRestantes,
    podeRenovar: !ativo || (diasRestantes != null && diasRestantes <= DIAS_RENOVACAO),
    pagamentoAberto: aberto,
    historico,
  };
}

async function getStatus(clienteId, modulo) {
  if (!MODULOS[modulo]) return { ok: false, error: 'Módulo inválido.' };
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    return await montarStatus(db, Number(clienteId), modulo);
  } catch (e) {
    console.error(`${LOG_PREFIX} getStatus:`, e.message);
    return { ok: false, error: e.message };
  }
}

async function getTodos(clienteId) {
  const modulos = [];
  for (const modulo of Object.keys(MODULOS)) {
    const s = await getStatus(clienteId, modulo);
    if (!s.ok) return s;
    modulos.push(s);
  }
  return { ok: true, modulos };
}

async function temAcesso(clienteId, modulo) {
  const s = await getStatus(clienteId, modulo);
  return Boolean(s.ok && s.ativo);
}

async function gerarCobranca({ clienteId, modulo, formaPagamento, geradoPor }) {
  const cfg = MODULOS[modulo];
  if (!cfg) return { ok: false, error: 'Módulo inválido.' };
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const forma = String(formaPagamento || '').toLowerCase();
    if (!['boleto', 'pix'].includes(forma)) {
      return { ok: false, error: 'Forma de pagamento inválida. Use boleto ou pix.' };
    }

    const status = await montarStatus(db, Number(clienteId), modulo);
    if (status.pagamentoAberto && status.pagamentoAberto.tipo === forma) {
      return { ok: true, reutilizado: true, pagamento: status.pagamentoAberto };
    }
    if (!status.podeRenovar) {
      return {
        ok: false,
        error: `O módulo já está pago até ${status.validoAte}. A próxima mensalidade fica disponível ${DIAS_RENOVACAO} dias antes do vencimento.`,
      };
    }

    const valor = status.valor;
    let assinatura = await obterAssinatura(db, Number(clienteId), modulo);
    if (!assinatura) {
      await db(TABELA).insert({ cliente_id: Number(clienteId), modulo, valor });
      assinatura = await obterAssinatura(db, Number(clienteId), modulo);
    } else if (Number(assinatura.valor) !== valor) {
      await db(TABELA).where('id', assinatura.id).update({ valor, updated_at: db.fn.now() });
    }

    const inicio = status.ativo && status.validoAte ? status.validoAte : hojeIso();
    const [ano, mes] = inicio.split('-');
    const referencia = `${mes}/${ano}`;
    const descricao = `Módulo ${cfg.nome} CADBRASIL - mensalidade ${referencia}`;
    const protocolo = `${cfg.protocoloPrefixo}-${assinatura.id}-${Date.now().toString().slice(-6)}`;

    const pagamentos = require('./pagamentos.service');
    const result = await pagamentos.gerarCobrancaPersonalizada({
      clienteId: Number(clienteId),
      valor,
      formaPagamento: forma,
      descricao,
      protocolo,
      origem: cfg.origem,
      origemId: assinatura.id,
      itemName: `Módulo ${cfg.nome} - mensalidade`,
      message: `${descricao}\nAcesso mensal ao módulo no Portal CADBRASIL\nReferência: ${protocolo}`,
      geradoPor: geradoPor || null,
    });
    if (!result.ok) return result;

    const atualizado = await montarStatus(db, Number(clienteId), modulo);
    return {
      ok: true,
      pagamento: atualizado.historico.find((p) => p.id === result.pagamentoId) || atualizado.pagamentoAberto,
    };
  } catch (e) {
    console.error(`${LOG_PREFIX} gerarCobranca:`, e.message);
    return { ok: false, error: e.message };
  }
}

/** Equipe CADBRASIL: libera (ou remove, com `ate` vazio) acesso de cortesia ao módulo. */
async function definirCortesia({ clienteId, modulo, ate, usuarioId }) {
  const cfg = MODULOS[modulo];
  if (!cfg) return { ok: false, error: 'Módulo inválido.' };
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const data = ate ? String(ate).slice(0, 10) : null;
  if (data && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < hojeIso())) {
    return { ok: false, error: 'Informe uma data a partir de hoje.' };
  }

  try {
    let assinatura = await obterAssinatura(db, Number(clienteId), modulo);
    if (!assinatura) {
      if (!data) return montarStatus(db, Number(clienteId), modulo);
      await db(TABELA).insert({
        cliente_id: Number(clienteId),
        modulo,
        valor: await getValor(db, cfg),
        cortesia_ate: data,
      });
      assinatura = await obterAssinatura(db, Number(clienteId), modulo);
    } else {
      await db(TABELA)
        .where('id', assinatura.id)
        .update({ cortesia_ate: data, updated_at: db.fn.now() });
    }

    try {
      await db('historico_acoes').insert({
        cliente_id: Number(clienteId),
        usuario_id: usuarioId || null,
        acao: data
          ? `Acesso de cortesia ao módulo ${cfg.nome} liberado até ${data}`
          : `Acesso de cortesia ao módulo ${cfg.nome} removido`,
        entidade: TABELA,
        entidade_id: assinatura.id,
        created_at: db.fn.now(),
      });
    } catch (_) {}

    return montarStatus(db, Number(clienteId), modulo);
  } catch (e) {
    console.error(`${LOG_PREFIX} definirCortesia:`, e.message);
    return { ok: false, error: e.message };
  }
}

/** Serviço de baixa por origem (pagamentos.origem → módulo). */
function porModulo(modulo) {
  return {
    async confirmarPagamento(assinaturaId) {
      const db = getDb();
      if (!db) return { ok: false, error: 'Banco de dados não disponível' };
      try {
        await ensureTable(db);
        const assinatura = await db(TABELA).where('id', assinaturaId).first();
        if (!assinatura || assinatura.modulo !== modulo) {
          return { ok: false, error: 'Assinatura não encontrada' };
        }
        const anterior = assinatura.valido_ate ? isoDate(assinatura.valido_ate) : null;
        const validoAte = await recalcularValidade(db, assinatura);

        let emailNotificacao = { enviado: false, motivo: 'validade_inalterada' };
        if (validoAte && validoAte !== anterior) {
          const { n } = await db('pagamentos')
            .whereNull('deleted_at')
            .where({ origem: MODULOS[modulo].origem, origem_id: assinatura.id, status: 'pago' })
            .count({ n: '*' })
            .first();
          emailNotificacao = await require('./servico-ativado-email.service').enviarServicoAtivado({
            clienteId: assinatura.cliente_id,
            servico: modulo,
            origemId: assinatura.id,
            validoAte: (await montarStatus(db, assinatura.cliente_id, modulo)).validoAte || validoAte,
            renovacao: Number(n) > 1,
          });
        }
        try {
          await db('historico_acoes').insert({
            cliente_id: assinatura.cliente_id,
            usuario_id: null,
            acao: `Mensalidade do módulo ${MODULOS[modulo].nome} confirmada (válido até ${validoAte})`,
            entidade: TABELA,
            entidade_id: assinatura.id,
            created_at: db.fn.now(),
          });
        } catch (_) {}
        return { ok: true, validoAte, emailNotificacao };
      } catch (e) {
        console.error(`${LOG_PREFIX} confirmarPagamento:`, e.message);
        return { ok: false, error: e.message };
      }
    },
  };
}

module.exports = {
  MODULOS,
  getStatus,
  getTodos,
  temAcesso,
  gerarCobranca,
  definirCortesia,
  porModulo,
};
