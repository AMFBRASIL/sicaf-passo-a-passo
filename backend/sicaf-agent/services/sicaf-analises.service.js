/**
 * Histórico de análises IA da Situação do Fornecedor (SICAF).
 */
const { getDb } = require('../database/connection');
const { assertClienteAcessivel, listClientesForUsuario } = require('./client-access.service');

function mapRow(row) {
  if (!row) return null;
  let analise = row.analise_json;
  if (typeof analise === 'string') {
    try {
      analise = JSON.parse(analise);
    } catch {
      analise = {};
    }
  }
  let niveisResumo = row.niveis_resumo;
  if (typeof niveisResumo === 'string') {
    try {
      niveisResumo = JSON.parse(niveisResumo);
    } catch {
      niveisResumo = [];
    }
  }
  return {
    id: row.id,
    clienteId: row.cliente_id,
    usuarioId: row.usuario_id,
    arquivoNome: row.arquivo_nome,
    statusGeral: row.status_geral,
    resumo: row.resumo,
    totalPendencias: row.total_pendencias,
    analise,
    niveisResumo: niveisResumo || [],
    certidoesInseridas: row.certidoes_inseridas,
    certidoesAtualizadas: row.certidoes_atualizadas,
    cadastroAtualizado: !!row.cadastro_atualizado,
    aviso: row.aviso,
    createdAt: row.created_at,
  };
}

async function saveAnalise({
  clienteId,
  usuarioId,
  fileName,
  analise,
  savePayload,
  saveWarning,
}) {
  const db = getDb();
  if (!db) return null;

  const pendencias = analise?.pendencias || [];
  const [id] = await db('sicaf_analises').insert({
    cliente_id: clienteId,
    usuario_id: usuarioId || null,
    arquivo_nome: fileName || null,
    status_geral: analise?.status_geral || null,
    resumo: analise?.resumo || null,
    total_pendencias: pendencias.length,
    analise_json: JSON.stringify(analise || {}),
    niveis_resumo: JSON.stringify(savePayload?.niveisResumo || []),
    certidoes_inseridas: savePayload?.certidoesInserted || 0,
    certidoes_atualizadas: savePayload?.certidoesUpdated || 0,
    cadastro_atualizado: savePayload ? 1 : 0,
    aviso: saveWarning || null,
  });

  const row = await db('sicaf_analises').where('id', id).first();
  return mapRow(row);
}

async function listAnalises(clienteId, usuarioId, limit = 30) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  const rows = await db('sicaf_analises')
    .where('cliente_id', clienteId)
    .orderBy('created_at', 'desc')
    .limit(Math.min(limit, 100));

  return {
    ok: true,
    analises: rows.map((r) => mapRow(r)),
  };
}

async function listAnalisesForUsuario(usuarioId, limit = 50) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const clientes = await listClientesForUsuario(db, usuarioId);
    const clienteIds = clientes.map((c) => Number(c.id)).filter((id) => id > 0);
    if (!clienteIds.length) {
      return { ok: true, analises: [] };
    }

    const clienteMap = Object.fromEntries(
      clientes.map((c) => [Number(c.id), c]),
    );

    const rows = await db('sicaf_analises')
      .whereIn('cliente_id', clienteIds)
      .orderBy('created_at', 'desc')
      .limit(Math.min(limit, 100));

    return {
      ok: true,
      analises: rows.map((r) => {
        const mapped = mapRow(r);
        const cliente = clienteMap[Number(r.cliente_id)];
        return {
          ...mapped,
          empresaNome: cliente?.razao_social || cliente?.nome_fantasia || null,
          empresaCnpj: cliente?.documento || mapped.analise?.cnpj || null,
        };
      }),
    };
  } catch (e) {
    console.error('[SicafAnalises] Erro listAnalisesForUsuario:', e.message);
    return { ok: false, error: 'Erro ao listar análises: ' + e.message };
  }
}

async function getAnaliseById(analiseId, clienteId, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  const row = await db('sicaf_analises')
    .where({ id: analiseId, cliente_id: clienteId })
    .first();

  if (!row) return { ok: false, error: 'Análise não encontrada' };

  return { ok: true, analise: mapRow(row) };
}

module.exports = {
  saveAnalise,
  listAnalises,
  listAnalisesForUsuario,
  getAnaliseById,
};
