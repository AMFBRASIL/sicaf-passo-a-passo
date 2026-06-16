/**
 * Camada admin — enriquece listagem de clientes para /admin/clientes.
 * Busca por CNPJ/e-mail/nome expande para todo o portfólio do mesmo usuário.
 */
const { getDb } = require('../database/connection');
const clientsService = require('./clients.service');

const MANUTENCAO_ATIVA = ['Ativo', 'ativo', 'A Vencer', 'a vencer', 'Vencendo', 'vencendo'];

const TAXA_SICAF_PAGA_WHERE =
  "(LOWER(TRIM(CAST(status AS CHAR))) IN ('pago','paga','aprovado','aprovada') OR status IN ('Pago','Paga','pago','paga','Aprovado','Aprovada','aprovado','aprovada'))";

const TAXA_SICAF_PAGA_TS_WHERE =
  "(LOWER(TRIM(CAST(ts.status AS CHAR))) IN ('pago','paga','aprovado','aprovada') OR ts.status IN ('Pago','Paga','pago','paga','Aprovado','Aprovada','aprovado','aprovada'))";

const TAXA_SICAF_ABERTA_STATUSES = [
  'Pendente', 'pendente', 'Aguardando', 'aguardando', 'Gerado', 'gerado',
  'Vencido', 'vencido', 'Atrasado', 'atrasado',
];

const PAGAMENTO_PENDENTE_STATUSES = [
  'pendente', 'aguardando', 'aberto', 'gerado', 'vencido', 'atrasado',
  'Pendente', 'Aguardando', 'Aberto', 'Gerado', 'Vencido', 'Atrasado',
];

function formatDateBr(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return String(d);
  }
}

function diasAteValidadeSicaf(sicafValidade) {
  if (!sicafValidade) return null;
  const val = new Date(sicafValidade);
  if (Number.isNaN(val.getTime())) return null;
  const now = new Date();
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const valUtc = Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate());
  return Math.ceil((valUtc - nowUtc) / 86_400_000);
}

function isCredencialVigente(sicafValidade, sicafStatus) {
  if (sicafStatus === 'Vencido') return false;
  const dias = diasAteValidadeSicaf(sicafValidade);
  return dias !== null && dias > 0;
}

/** Mesma regra do card "Pagamento SICAF" no modal de detalhe (Resumo). */
function derivePagamentoSicafResumo({
  sicafStatus,
  sicafValidade,
  temTaxaAberta,
  temPagamentoPendente,
}) {
  const temAberto = temTaxaAberta || temPagamentoPendente;
  const vigente = isCredencialVigente(sicafValidade, sicafStatus);
  const dias = diasAteValidadeSicaf(sicafValidade);
  const validadeFmt = formatDateBr(sicafValidade);

  if (vigente && validadeFmt) {
    const vencendoEmBreve = dias !== null && dias <= 30;
    if (temAberto) {
      return {
        pagou: true,
        pagamentoSicafStatus: vencendoEmBreve ? 'Vencendo' : 'Vigente',
        pagamentoSicafDetalhe: `Válido até ${validadeFmt} · renovação em aberto`,
      };
    }
    return {
      pagou: true,
      pagamentoSicafStatus: vencendoEmBreve ? 'Vencendo' : 'Em dia',
      pagamentoSicafDetalhe: vencendoEmBreve
        ? `Válido até ${validadeFmt}`
        : 'Taxa SICAF quitada',
    };
  }

  if (dias !== null && dias <= 0) {
    return {
      pagou: false,
      pagamentoSicafStatus: 'Vencido',
      pagamentoSicafDetalhe: validadeFmt
        ? `Validade expirada em ${validadeFmt}`
        : 'Credenciamento expirado',
    };
  }

  if (temAberto) {
    return {
      pagou: false,
      pagamentoSicafStatus: 'Pendente',
      pagamentoSicafDetalhe: 'Taxa pendente · sem vigência ativa no cadastro',
    };
  }

  if (sicafStatus === 'Vencido') {
    return {
      pagou: false,
      pagamentoSicafStatus: 'Vencido',
      pagamentoSicafDetalhe: 'SICAF vencido',
    };
  }

  return {
    pagou: false,
    pagamentoSicafStatus: 'Sem vigência',
    pagamentoSicafDetalhe: 'Nenhum credenciamento SICAF vigente',
  };
}

const NIVEL_APTO_SQL = `sn.habilitado = 1 AND (
  LOWER(CAST(sn.status AS CHAR)) LIKE '%valid%'
  OR LOWER(CAST(sn.status AS CHAR)) LIKE '%habilit%'
  OR LOWER(CAST(sn.status AS CHAR)) LIKE '%vencend%'
  OR LOWER(CAST(sn.status AS CHAR)) LIKE '%vencid%'
)`;

async function fetchGlobalAdminStats() {
  const db = getDb();
  if (!db) return { totalClientes: 0, totalCnpjs: 0, emRisco: 0, mrr: 0 };
  try {
    const [cnpjRow, userRow, riscoRow, mrrRow] = await Promise.all([
      db('clientes').count({ total: 'id' }).first(),
      db('clientes').whereNotNull('usuario_id').countDistinct({ total: 'usuario_id' }).first().catch(() => ({ total: 0 })),
      db('clientes as c')
        .leftJoin('sicaf_cadastros as s', 'c.id', 's.cliente_id')
        .where(function () {
          this.where('s.status', 'Vencido').orWhereNull('s.id');
        })
        .countDistinct({ total: 'c.id' })
        .first(),
      db('manutencoes')
        .whereIn('status', MANUTENCAO_ATIVA)
        .sum({ total: 'valor' })
        .first()
        .catch(() => ({ total: 0 })),
    ]);
    return {
      totalClientes: parseInt(userRow?.total, 10) || 0,
      totalCnpjs: parseInt(cnpjRow?.total, 10) || 0,
      emRisco: parseInt(riscoRow?.total, 10) || 0,
      mrr: parseFloat(mrrRow?.total) || 0,
    };
  } catch (_) {
    return { totalClientes: 0, totalCnpjs: 0, emRisco: 0, mrr: 0 };
  }
}

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

  let taxaAbertaMap = {};
  let pendenteSicafMap = {};
  if (clientIds.length && db) {
    try {
      const taxasAbertas = await db('taxas_sicaf')
        .whereIn('cliente_id', clientIds)
        .whereIn('status', TAXA_SICAF_ABERTA_STATUSES)
        .groupBy('cliente_id')
        .select('cliente_id')
        .count('* as total');
      for (const row of taxasAbertas) {
        taxaAbertaMap[row.cliente_id] = parseInt(row.total, 10) > 0;
      }
    } catch (_) {}

    try {
      const hasPagamentos = await db.schema.hasTable('pagamentos');
      if (hasPagamentos) {
        const pendentesV2 = await db('pagamentos')
          .whereIn('cliente_id', clientIds)
          .where('origem', 'sicaf')
          .whereIn('status', PAGAMENTO_PENDENTE_STATUSES)
          .groupBy('cliente_id')
          .select('cliente_id')
          .count('* as total');
        for (const p of pendentesV2) {
          pendenteSicafMap[p.cliente_id] = parseInt(p.total, 10) > 0;
        }
      }
    } catch (_) {}

    try {
      const pendentesGn = await db('pagamentos_gerencianet')
        .whereIn('cliente_id', clientIds)
        .where('origem', 'sicaf')
        .whereIn('status', PAGAMENTO_PENDENTE_STATUSES)
        .groupBy('cliente_id')
        .select('cliente_id')
        .count('* as total');
      for (const p of pendentesGn) {
        if (!pendenteSicafMap[p.cliente_id]) {
          pendenteSicafMap[p.cliente_id] = parseInt(p.total, 10) > 0;
        }
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
    const temTaxaAberta = !!taxaAbertaMap[c.id];
    const temPagamentoSicafPendente = !!pendenteSicafMap[c.id];
    const sicafPago = !!sicafPagoMap[c.id];
    const pagamento = derivePagamentoSicafResumo({
      sicafStatus: c.sicafStatus,
      sicafValidade: c.sicafValidade,
      temTaxaAberta,
      temPagamentoPendente: temPagamentoSicafPendente,
    });
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
      pagou: pagamento.pagou,
      pagamentoSicafStatus: pagamento.pagamentoSicafStatus,
      pagamentoSicafDetalhe: pagamento.pagamentoSicafDetalhe,
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
 * Após busca por CNPJ/e-mail, expande portfólio do login — apenas para modal de grupo, não na listagem paginada.
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
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 25));
  const adminFiltro = params.filtro || params.adminFiltro || 'todos';

  const [result, globalStats] = await Promise.all([
    clientsService.listClients({
      search: hasUsuarioFilter ? '' : search,
      status: params.status || 'all',
      sicaf: params.sicaf || 'all',
      city: params.city || 'all',
      page,
      limit,
      usuarioIds: hasUsuarioFilter ? params.usuarioIds : undefined,
      adminFiltro: hasUsuarioFilter ? 'todos' : adminFiltro,
    }),
    hasUsuarioFilter ? Promise.resolve(null) : fetchGlobalAdminStats(),
  ]);
  if (!result.ok) return result;

  const clients = result.clients || [];
  const enriched = await enrichClients(clients);
  const total = parseInt(result.total, 10) || 0;

  const response = {
    ok: true,
    clients: enriched,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
    stats: globalStats || buildStats(enriched, buildGroups(enriched)),
  };

  if (params.includeGroups) {
    response.groups = buildGroups(enriched);
  }

  return response;
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
    const result = await listClientsForAdmin({ usuarioIds: [usuarioId], limit: 500, includeGroups: true });
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
