/**
 * Propostas comerciais geradas no sistema de cadastro.
 * Aqui o cliente visualiza, cancela ou gera pagamento (PIX/boleto).
 */
const { getDb } = require('../database/connection');
const {
  assertClienteAcessivel,
  listClientesForUsuario,
} = require('./client-access.service');
const pagamentosService = require('./pagamentos.service');

const TABLE = 'propostas_comerciais';
const STATUS_ATIVAS = ['Gerada', 'Em_negociacao', 'Aceita'];
const STATUS_CANCELAVEIS = ['Gerada', 'Em_negociacao', 'Aceita'];

async function ensureTable(db) {
  const exists = await db.schema.hasTable(TABLE);
  if (exists) return true;
  await db.raw(`
    CREATE TABLE IF NOT EXISTS propostas_comerciais (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      cliente_id BIGINT UNSIGNED NOT NULL,
      protocolo_cadastro VARCHAR(40) NOT NULL,
      protocolo_proposta VARCHAR(40) NOT NULL,
      razao_social VARCHAR(160) NULL,
      documento VARCHAR(32) NULL,
      -- Fallback de schema; inserts devem usar getPrecosComerciais()
      valor_base DECIMAL(12,2) NOT NULL DEFAULT 985.00,
      valor_extras DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      valor_total DECIMAL(12,2) NOT NULL,
      periodicidade VARCHAR(20) NOT NULL DEFAULT 'anual',
      modulos_base_json JSON NOT NULL,
      modulos_extras_json JSON NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'Gerada',
      observacoes TEXT NULL,
      tracking_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_propostas_comerciais_protocolo (protocolo_proposta),
      KEY idx_propostas_comerciais_cliente (cliente_id),
      KEY idx_propostas_comerciais_protocolo_cadastro (protocolo_cadastro),
      KEY idx_propostas_comerciais_status (status),
      KEY idx_propostas_comerciais_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  return true;
}

function parseJsonField(value, fallback = []) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeModulo(item) {
  if (item == null) return null;
  if (typeof item === 'string') {
    return { nome: item, valor: null, codigo: null };
  }
  if (typeof item !== 'object') return null;
  const nome =
    item.nome ||
    item.titulo ||
    item.name ||
    item.label ||
    item.modulo ||
    item.codigo ||
    'Módulo';
  const valorRaw = item.valor ?? item.preco ?? item.price ?? item.valor_mensal ?? null;
  const valor =
    valorRaw == null || valorRaw === ''
      ? null
      : Number(String(valorRaw).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return {
    nome: String(nome),
    valor: Number.isFinite(valor) ? valor : null,
    codigo: item.codigo || item.code || item.id || null,
    descricao: item.descricao || item.description || null,
  };
}

function mapProposta(row) {
  const baseRaw = parseJsonField(row.modulos_base_json, []);
  const extrasRaw = parseJsonField(row.modulos_extras_json, []);
  const baseList = Array.isArray(baseRaw) ? baseRaw : baseRaw?.itens || baseRaw?.modulos || [];
  const extrasList = Array.isArray(extrasRaw) ? extrasRaw : extrasRaw?.itens || extrasRaw?.modulos || [];

  return {
    id: Number(row.id),
    clienteId: Number(row.cliente_id),
    protocoloCadastro: row.protocolo_cadastro,
    protocoloProposta: row.protocolo_proposta,
    razaoSocial: row.razao_social || null,
    documento: row.documento || null,
    valorBase: Number(row.valor_base) || 0,
    valorExtras: Number(row.valor_extras) || 0,
    valorTotal: Number(row.valor_total) || 0,
    periodicidade: row.periodicidade || 'anual',
    modulosBase: (Array.isArray(baseList) ? baseList : []).map(normalizeModulo).filter(Boolean),
    modulosExtras: (Array.isArray(extrasList) ? extrasList : []).map(normalizeModulo).filter(Boolean),
    status: row.status || 'Gerada',
    observacoes: row.observacoes || null,
    tracking: parseJsonField(row.tracking_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listPropostasPendentes(usuarioId, jwtTipo) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível', propostas: [] };

  try {
    await ensureTable(db);
    const clientes = await listClientesForUsuario(db, usuarioId);
    const clienteIds = clientes.map((c) => Number(c.id)).filter((id) => id > 0);
    if (!clienteIds.length) {
      return { ok: true, propostas: [], total: 0 };
    }

    const rows = await db(TABLE)
      .whereIn('cliente_id', clienteIds)
      .whereIn('status', STATUS_ATIVAS)
      .orderBy('created_at', 'desc');

    // Staff JWT: ainda assim só vê clientes acessíveis (assert já aplicado via list)
    if (jwtTipo && String(jwtTipo).toLowerCase() !== 'cliente') {
      // ok — listClientesForUsuario já filtra staff/cliente
    }

    return {
      ok: true,
      propostas: rows.map(mapProposta),
      total: rows.length,
    };
  } catch (e) {
    console.error('[Propostas] listPropostasPendentes:', e.message);
    return { ok: false, error: e.message, propostas: [] };
  }
}

async function getPropostaAcessivel(db, propostaId, usuarioId, jwtTipo) {
  const row = await db(TABLE).where('id', propostaId).first();
  if (!row) return { ok: false, error: 'Proposta não encontrada' };
  const cliente = await assertClienteAcessivel(db, row.cliente_id, usuarioId, jwtTipo);
  if (!cliente) return { ok: false, error: 'Sem permissão para esta proposta' };
  return { ok: true, row, cliente };
}

async function cancelarProposta({ propostaId, usuarioId, jwtTipo, motivo }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    await ensureTable(db);
    const access = await getPropostaAcessivel(db, propostaId, usuarioId, jwtTipo);
    if (!access.ok) return access;

    const { row } = access;
    if (!STATUS_CANCELAVEIS.includes(row.status)) {
      return { ok: false, error: `Não é possível cancelar proposta com status "${row.status}".` };
    }

    const tracking = parseJsonField(row.tracking_json, {}) || {};
    tracking.cancelamento = {
      em: new Date().toISOString(),
      usuarioId,
      motivo: motivo || null,
    };

    await db(TABLE)
      .where('id', propostaId)
      .update({
        status: 'Cancelada',
        observacoes: motivo
          ? `${row.observacoes ? `${row.observacoes}\n` : ''}Cancelada: ${motivo}`
          : row.observacoes,
        tracking_json: JSON.stringify(tracking),
        updated_at: db.fn.now(),
      });

    return { ok: true, message: 'Proposta cancelada', propostaId: Number(propostaId) };
  } catch (e) {
    console.error('[Propostas] cancelarProposta:', e.message);
    return { ok: false, error: e.message };
  }
}

async function gerarPagamentoProposta({
  propostaId,
  usuarioId,
  jwtTipo,
  formaPagamento,
  dataVencimento,
}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    await ensureTable(db);
    const access = await getPropostaAcessivel(db, propostaId, usuarioId, jwtTipo);
    if (!access.ok) return access;

    const { row } = access;
    if (!STATUS_ATIVAS.includes(row.status)) {
      return { ok: false, error: `Proposta com status "${row.status}" não pode ser paga.` };
    }

    const valor = Number(row.valor_total);
    if (!Number.isFinite(valor) || valor <= 0) {
      return { ok: false, error: 'Valor da proposta inválido.' };
    }

    const forma = String(formaPagamento || '').toLowerCase();
    if (!['boleto', 'pix'].includes(forma)) {
      return { ok: false, error: 'Escolha PIX ou boleto.' };
    }

    const result = await pagamentosService.gerarCobrancaPersonalizada({
      clienteId: row.cliente_id,
      valor,
      formaPagamento: forma,
      dataVencimento,
      descricao: `Proposta comercial ${row.protocolo_proposta}`.slice(0, 200),
    // Mesmo nome de item do boleto SICAF — a Efí rejeitou nomes/custom_id diferentes
      itemName: 'Guia de Processamento SICAF - CadBrasil',
      protocolo: `PROP-${row.cliente_id}-${row.id}`,
      origem: 'avulso',
      origemId: Number(row.id),
      geradoPor: usuarioId,
    });

    if (!result.ok) return result;

    let txid = result.txid || null;
    if (!txid && result.pagamentoId && forma === 'pix') {
      try {
        const pg = await db('pagamentos').where('id', result.pagamentoId).first();
        txid = pg?.provider_txid || null;
      } catch (_) {}
    }

    const tracking = parseJsonField(row.tracking_json, {}) || {};
    tracking.pagamento = {
      em: new Date().toISOString(),
      forma,
      pagamentoId: result.pagamentoId || null,
      protocoloPagamento: result.protocolo || null,
      usuarioId,
    };

    await db(TABLE)
      .where('id', propostaId)
      .update({
        status: 'Aceita',
        tracking_json: JSON.stringify(tracking),
        updated_at: db.fn.now(),
      });

    return {
      ok: true,
      message: 'Pagamento gerado',
      proposta: mapProposta({ ...row, status: 'Aceita', tracking_json: tracking }),
      pagamento: {
        pagamentoId: result.pagamentoId,
        tipo: result.tipo,
        valor: result.valor,
        vencimento: result.vencimento,
        protocolo: result.protocolo,
        barcode: result.barcode || null,
        link: result.link || null,
        pdf: result.pdf || null,
        qrcodeText: result.qrcodeText || null,
        qrcodeImage: result.qrcodeImage || null,
        txid,
      },
    };
  } catch (e) {
    console.error('[Propostas] gerarPagamentoProposta:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Quando um pagamento avulso vinculado à proposta é confirmado,
 * marca a proposta como Convertida (best-effort pelo protocolo na descrição).
 */
async function onPagamentoConfirmado(pagamento) {
  if (!pagamento) return;
  const origem = String(pagamento.origem || '').toLowerCase();
  if (origem !== 'avulso' && origem !== 'personalizado') return;

  const db = getDb();
  if (!db) return;
  try {
    if (!(await db.schema.hasTable(TABLE))) return;

    let row = null;
    const origemId = Number(pagamento.origem_id);
    if (Number.isFinite(origemId) && origemId > 0) {
      row = await db(TABLE).where('id', origemId).first();
    }
    if (!row) {
      const desc = String(pagamento.descricao || '');
      const match = desc.match(/Proposta comercial\s+([A-Z0-9\-]+)/i);
      const protocolo = match?.[1];
      if (protocolo) {
        row = await db(TABLE).where('protocolo_proposta', protocolo).first();
      }
    }
    if (!row) return;
    if (['Convertida', 'Cancelada', 'Recusada'].includes(row.status)) return;

    const tracking = parseJsonField(row.tracking_json, {}) || {};
    tracking.convertida = {
      em: new Date().toISOString(),
      pagamentoId: pagamento.id || pagamento.pagamentoId || null,
    };

    await db(TABLE)
      .where('id', row.id)
      .update({
        status: 'Convertida',
        tracking_json: JSON.stringify(tracking),
        updated_at: db.fn.now(),
      });
  } catch (e) {
    console.warn('[Propostas] onPagamentoConfirmado:', e.message);
  }
}

module.exports = {
  listPropostasPendentes,
  cancelarProposta,
  gerarPagamentoProposta,
  onPagamentoConfirmado,
  STATUS_ATIVAS,
};
