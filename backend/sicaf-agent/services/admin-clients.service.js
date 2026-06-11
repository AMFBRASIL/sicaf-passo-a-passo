/**
 * Camada admin — enriquece listagem de clientes para /admin/clientes.
 * Busca por CNPJ/e-mail/nome expande para todo o portfólio do mesmo usuário.
 */
const { getDb } = require('../database/connection');
const clientsService = require('./clients.service');

const MANUTENCAO_ATIVA = ['Ativo', 'ativo', 'A Vencer', 'a vencer', 'Vencendo', 'vencendo'];

const TAXA_SICAF_PAGA_WHERE =
  "(LOWER(TRIM(CAST(status AS CHAR))) IN ('pago','paga','aprovado','aprovada') OR status IN ('Pago','Paga','pago','paga','Aprovado','Aprovada','aprovado','aprovada'))";

async function enrichClients(clients) {
  const db = getDb();
  const userIds = [...new Set(clients.map((c) => c.userId).filter(Boolean))];
  const clientIds = clients.map((c) => c.id);

  let userMap = {};
  if (userIds.length && db) {
    const users = await db('usuarios')
      .whereIn('id', userIds)
      .select('id', 'nome', 'email', 'telefone', 'created_at');
    userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  }

  let manutMap = {};
  if (clientIds.length && db) {
    try {
      const manuts = await db('manutencoes')
        .whereIn('cliente_id', clientIds)
        .whereIn('status', MANUTENCAO_ATIVA)
        .select('cliente_id', 'valor', 'data_inicio', 'status');
      for (const m of manuts) {
        if (!manutMap[m.cliente_id]) manutMap[m.cliente_id] = m;
      }
    } catch (_) {}
  }

  let pendenteMap = {};
  if (clientIds.length && db) {
    try {
      const pendentes = await db('pagamentos_gerencianet')
        .whereIn('cliente_id', clientIds)
        .whereIn('status', ['pendente', 'aguardando', 'aberto'])
        .groupBy('cliente_id')
        .select('cliente_id')
        .count('* as total');
      for (const p of pendentes) {
        pendenteMap[p.cliente_id] = parseInt(p.total, 10) > 0;
      }
    } catch (_) {}
  }

  let sicafPagoMap = {};
  if (clientIds.length && db) {
    try {
      const pagos = await db('taxas_sicaf')
        .whereIn('cliente_id', clientIds)
        .whereRaw(TAXA_SICAF_PAGA_WHERE)
        .distinct('cliente_id')
        .select('cliente_id');
      for (const p of pagos) {
        sicafPagoMap[p.cliente_id] = true;
      }
    } catch (_) {}
  }

  return clients.map((c) => {
    const usuario = c.userId ? userMap[c.userId] : null;
    const manut = manutMap[c.id];
    const mrr = manut ? parseFloat(manut.valor) || 0 : 0;
    const temPendencia = !!pendenteMap[c.id];
    const sicafPago = !!sicafPagoMap[c.id];
    const pagou = !temPendencia && c.sicafStatus !== 'Vencido';
    const novo = c.createdAt
      ? Date.now() - new Date(c.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000
      : false;

    return {
      ...c,
      usuarioNome: usuario?.nome || c.name,
      usuarioEmail: usuario?.email || c.email,
      usuarioTelefone: usuario?.telefone || c.phone,
      usuarioDesde: usuario?.created_at || c.createdAt,
      mrr,
      manutencaoAtiva: !!manut,
      pagou,
      sicafPago,
      sicafAtivo: c.sicafStatus === 'Ativo' || c.sicafStatus === 'Vencendo',
      novo,
      plano: manut ? 'Manutenção SICAF' : c.sicafId ? 'SICAF' : 'Onboarding',
    };
  });
}

function buildGroups(enriched) {
  const userMap = {};
  for (const c of enriched) {
    if (c.userId) userMap[c.userId] = { nome: c.usuarioNome, email: c.usuarioEmail, telefone: c.usuarioTelefone, desde: c.usuarioDesde };
  }

  const userGroups = {};
  for (const c of enriched) {
    const gid = c.userId ? `u-${c.userId}` : `c-${c.id}`;
    if (!userGroups[gid]) {
      const u = c.userId ? userMap[c.userId] : null;
      userGroups[gid] = {
        id: gid,
        usuarioId: c.userId,
        nome: u?.nome || c.usuarioNome || c.name,
        contatoPrincipal: c.usuarioNome || c.name,
        email: u?.email || c.usuarioEmail || c.email,
        telefone: u?.telefone || c.usuarioTelefone || c.phone,
        cidade: c.city || '',
        desde: formatMesAno(u?.desde || c.usuarioDesde || c.createdAt),
        plano: c.plano,
        empresas: [],
      };
    }
    userGroups[gid].empresas.push(c);
  }
  return Object.values(userGroups);
}

function buildStats(enriched, groups) {
  const totalMrr = enriched.reduce((s, c) => s + (c.mrr || 0), 0);
  const emRisco = enriched.filter((c) => c.sicafStatus === 'Vencido' || !c.pagou).length;
  return {
    totalClientes: groups.length,
    totalCnpjs: enriched.length,
    emRisco,
    mrr: totalMrr,
  };
}

/**
 * Após a busca inicial, traz todos os CNPJs do mesmo login (usuario_id).
 */
async function expandToRelatedPortfolio(matchedClients, search) {
  const db = getDb();
  if (!matchedClients.length) return matchedClients;

  const userIds = new Set();
  for (const c of matchedClients) {
    if (c.userId) userIds.add(c.userId);
  }

  const term = String(search || '').trim();
  if (term.includes('@') && db) {
    try {
      const users = await db('usuarios').where('email', 'like', `%${term}%`).select('id');
      for (const u of users) userIds.add(u.id);
    } catch (_) {}
  }

  if (!userIds.size) return matchedClients;

  const expanded = await clientsService.listClients({
    usuarioIds: Array.from(userIds),
    limit: 500,
    page: 1,
  });
  if (!expanded.ok || !expanded.clients?.length) return matchedClients;

  const byId = new Map();
  for (const c of [...matchedClients, ...expanded.clients]) {
    byId.set(c.id, c);
  }
  return Array.from(byId.values());
}

async function listClientsForAdmin(params = {}) {
  const search = params.search || '';
  const hasUsuarioFilter = Array.isArray(params.usuarioIds) && params.usuarioIds.length > 0;

  const result = await clientsService.listClients({
    search: hasUsuarioFilter ? '' : search,
    status: params.status || 'all',
    sicaf: params.sicaf || 'all',
    city: params.city || 'all',
    page: params.page || 1,
    limit: params.limit || 200,
    usuarioIds: hasUsuarioFilter ? params.usuarioIds : undefined,
  });
  if (!result.ok) return result;

  let clients = result.clients || [];

  // CNPJ / e-mail / nome: incluir todo o portfólio vinculado ao mesmo login
  if (search.trim() && !hasUsuarioFilter) {
    clients = await expandToRelatedPortfolio(clients, search);
  }

  const enriched = await enrichClients(clients);
  const groups = buildGroups(enriched);
  const stats = buildStats(enriched, groups);

  const total = parseInt(result.total, 10) || enriched.length;
  const limit = params.limit || 200;
  const page = params.page || 1;

  return {
    ok: true,
    clients: enriched,
    groups,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
    stats: { ...stats, ...(result.stats || {}) },
  };
}

/**
 * Retorna um grupo completo (todas as empresas do mesmo usuario_id).
 */
async function getGrupoForAdmin({ grupoId, clienteId } = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  let usuarioId = null;
  let orphanClienteId = null;

  if (grupoId?.startsWith('u-')) {
    usuarioId = parseInt(grupoId.slice(2), 10);
  } else if (grupoId?.startsWith('c-')) {
    orphanClienteId = parseInt(grupoId.slice(2), 10);
  }

  if (clienteId) {
    const row = await db('clientes').where('id', clienteId).select('id', 'usuario_id').first();
    if (!row) return { ok: false, error: 'Cliente não encontrado' };
    if (row.usuario_id) usuarioId = row.usuario_id;
    else orphanClienteId = row.id;
  }

  if (usuarioId && Number.isFinite(usuarioId)) {
    const result = await listClientsForAdmin({ usuarioIds: [usuarioId], limit: 500 });
    if (!result.ok) return result;
    const grupo = result.groups.find((g) => g.id === `u-${usuarioId}`) || result.groups[0];
    return { ok: true, grupo, groups: result.groups };
  }

  if (orphanClienteId && Number.isFinite(orphanClienteId)) {
    const det = await clientsService.getClientById(orphanClienteId);
    if (!det.ok || !det.client) return { ok: false, error: 'Cliente não encontrado' };
    const c = det.client;
    const enriched = await enrichClients([
      {
        id: c.id,
        name: c.razao_social,
        fantasyName: c.nome_fantasia,
        documento: c.documento,
        email: c.email,
        phone: c.telefone,
        city: c.cidade && c.estado ? `${c.cidade} - ${c.estado}` : c.cidade,
        userId: null,
        sicafId: c.sicaf?.id || null,
        sicafStatus: c.sicaf?.status || null,
        sicafValidade: c.sicaf?.data_validade || null,
        sicafManutencao: c.sicaf?.manutencao_ativa === 1,
        createdAt: c.created_at,
      },
    ]);
    const grupo = buildGroups(enriched)[0];
    return { ok: true, grupo, groups: grupo ? [grupo] : [] };
  }

  return { ok: false, error: 'Grupo não informado' };
}

function formatMesAno(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${mm}/${yyyy}`;
  } catch {
    return '—';
  }
}

module.exports = {
  listClientsForAdmin,
  getGrupoForAdmin,
  getClientById: clientsService.getClientById,
  getClientFinanceiro: clientsService.getClientFinanceiro,
  getCertidoesStatus: clientsService.getCertidoesStatus,
  createClient: clientsService.createClient,
  updateClient: clientsService.updateClient,
};
