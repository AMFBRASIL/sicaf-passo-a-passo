/**
 * Painel Gestão SICAF Admin — listagem com níveis I–VI e KPIs semafóricos.
 */
const adminClientsService = require('./admin-clients.service');
const { getDb } = require('../database/connection');
const { calcDaysRemaining } = require('../utils/sicaf-status');

const ROMAN_LEVELS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function mapNivelStatus(raw, habilitado) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('vencido')) return 'vencido';
  if (s.includes('vencendo') || s.includes('a vencer')) return 'vencendo';
  if (s.includes('pendente')) return 'pendente';
  if (
    s.includes('válido') ||
    s.includes('valido') ||
    s.includes('habilitado') ||
    s.includes('ativo')
  ) {
    return 'validado';
  }
  if (habilitado) return 'validado';
  return 'nao_cadastrado';
}

function mapNiveisFromApi(sicafNiveis) {
  const out = {};
  if (sicafNiveis && typeof sicafNiveis === 'object') {
    for (const [roman, detail] of Object.entries(sicafNiveis)) {
      if (!ROMAN_LEVELS.includes(roman)) continue;
      out[roman] = mapNivelStatus(detail?.status, detail?.habilitado);
    }
  }
  for (const roman of ROMAN_LEVELS) {
    if (!out[roman]) out[roman] = 'nao_cadastrado';
  }
  return out;
}

function nivelToDot(status) {
  if (status === 'validado') return true;
  if (status === 'vencendo' || status === 'pendente' || status === 'vencido') return 'p';
  return false;
}

function deriveGestaoStatus(client, niveis) {
  const dias = client.sicafValidade ? calcDaysRemaining(client.sicafValidade) : null;
  if (client.sicafStatus === 'Vencido' || (dias !== null && dias < 0)) return 'vencido';
  if (client.sicafStatus === 'Vencendo' || (dias !== null && dias >= 0 && dias <= 30)) {
    return 'vencendo';
  }
  const allValidado = ROMAN_LEVELS.every((r) => niveis[r] === 'validado');
  if (allValidado) return 'completo';
  return 'incompleto';
}

function mapClientToRow(client) {
  const niveis = mapNiveisFromApi(client.sicafNiveis);
  const diasVenc = client.sicafValidade ? calcDaysRemaining(client.sicafValidade) : null;
  return {
    id: client.id,
    cli: client.name,
    cnpj: client.documento,
    niveis: ROMAN_LEVELS.map((r) => nivelToDot(niveis[r])),
    niveisDetalhe: niveis,
    status: deriveGestaoStatus(client, niveis),
    diasVenc: diasVenc ?? 0,
    sicafStatus: client.sicafStatus || null,
    sicafValidade: client.sicafValidade || null,
    sicafId: client.sicafId || null,
  };
}

function countRowsByStatus(rows) {
  return {
    completo: rows.filter((r) => r.status === 'completo').length,
    incompleto: rows.filter((r) => r.status === 'incompleto').length,
    vencendo: rows.filter((r) => r.status === 'vencendo').length,
    vencido: rows.filter((r) => r.status === 'vencido').length,
  };
}

/** KPIs globais (todos os cadastros SICAF) — evita subcontagem por paginação. */
async function fetchGlobalSicafCounts() {
  const db = getDb();
  if (!db) return null;

  try {
    const stats = await db('sicaf_cadastros as s')
      .leftJoin(
        db('sicaf_niveis')
          .select('sicaf_id')
          .whereIn('nivel', ROMAN_LEVELS)
          .where(function () {
            this.where('habilitado', 1).orWhereRaw(
              "LOWER(COALESCE(status, '')) REGEXP 'valid|habilit|ativo'",
            );
          })
          .groupBy('sicaf_id')
          .havingRaw('COUNT(DISTINCT nivel) = 6')
          .as('nv'),
        'nv.sicaf_id',
        's.id',
      )
      .select(
        db.raw('COUNT(*) as total'),
        db.raw(
          "SUM(CASE WHEN s.data_validade IS NOT NULL AND DATEDIFF(s.data_validade, CURDATE()) < 0 THEN 1 ELSE 0 END) as vencido",
        ),
        db.raw(
          "SUM(CASE WHEN s.data_validade IS NOT NULL AND DATEDIFF(s.data_validade, CURDATE()) BETWEEN 0 AND 30 THEN 1 ELSE 0 END) as vencendo",
        ),
        db.raw(
          'SUM(CASE WHEN nv.sicaf_id IS NOT NULL AND (s.data_validade IS NULL OR DATEDIFF(s.data_validade, CURDATE()) > 30) THEN 1 ELSE 0 END) as completo',
        ),
      )
      .first();

    const total = parseInt(stats?.total, 10) || 0;
    const vencido = parseInt(stats?.vencido, 10) || 0;
    const vencendo = parseInt(stats?.vencendo, 10) || 0;
    const completo = parseInt(stats?.completo, 10) || 0;
    const incompleto = Math.max(0, total - vencido - vencendo - completo);

    return { completo, incompleto, vencendo, vencido, total };
  } catch (e) {
    console.error('[AdminSicaf] Erro ao calcular KPIs globais:', e.message);
    return null;
  }
}

async function getAdminSicaf(opts = {}) {
  const search = String(opts.search || '').trim();
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 500, 1), 2000);
  const page = Math.max(parseInt(opts.page, 10) || 1, 1);

  const [result, globalCounts] = await Promise.all([
    adminClientsService.listClientsForAdmin({
      search,
      page,
      limit,
      status: 'all',
      sicaf: 'cadastrado',
    }),
    search ? Promise.resolve(null) : fetchGlobalSicafCounts(),
  ]);

  if (!result.ok) return result;

  const withSicaf = result.clients || [];
  const rows = withSicaf.map(mapClientToRow);
  const counts = search
    ? countRowsByStatus(rows)
    : globalCounts
      ? {
          completo: globalCounts.completo,
          incompleto: globalCounts.incompleto,
          vencendo: globalCounts.vencendo,
          vencido: globalCounts.vencido,
        }
      : countRowsByStatus(rows);

  return {
    ok: true,
    rows,
    counts,
    total: search
      ? parseInt(result.total, 10) || withSicaf.length
      : globalCounts?.total || parseInt(result.total, 10) || withSicaf.length,
    page,
    limit,
    totalPages: result.totalPages || (limit > 0 ? Math.ceil(withSicaf.length / limit) : 1),
  };
}

module.exports = {
  getAdminSicaf,
  mapClientToRow,
  deriveGestaoStatus,
};
