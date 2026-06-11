/**
 * Relatórios Admin — geração tabular com dados reais do banco.
 */
const { getDb } = require('../database/connection');
const adminClientsService = require('./admin-clients.service');
const adminSicafService = require('./admin-sicaf.service');
const adminGoogleAdsService = require('./admin-google-ads.service');
const ticketsService = require('./tickets.service');
const { calcDaysRemaining } = require('../utils/sicaf-status');

const TIPOS = ['clientes', 'financeiro', 'sicaf', 'suporte', 'googleads'];

const COLUNAS = {
  clientes: [
    { key: 'razao_social', label: 'Razão social' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'plano', label: 'Plano' },
    { key: 'mrr', label: 'MRR' },
    { key: 'status_sicaf', label: 'Status SICAF' },
    { key: 'responsavel', label: 'Responsável' },
    { key: 'ultima_interacao', label: 'Última interação' },
    { key: 'tags', label: 'Tags' },
  ],
  financeiro: [
    { key: 'cliente', label: 'Cliente' },
    { key: 'fatura', label: 'Fatura' },
    { key: 'vencimento', label: 'Vencimento' },
    { key: 'pago_em', label: 'Pago em' },
    { key: 'valor', label: 'Valor' },
    { key: 'forma', label: 'Forma de pagamento' },
    { key: 'status', label: 'Status' },
    { key: 'juros_multa', label: 'Juros/Multa' },
  ],
  sicaf: [
    { key: 'empresa', label: 'Empresa' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'nivel', label: 'Nível' },
    { key: 'status', label: 'Status' },
    { key: 'validade', label: 'Validade' },
    { key: 'dias_restantes', label: 'Dias restantes' },
    { key: 'pendencias', label: 'Pendências' },
    { key: 'responsavel', label: 'Responsável' },
  ],
  suporte: [
    { key: 'ticket', label: 'Ticket' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'assunto', label: 'Assunto' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'aberto_em', label: 'Aberto em' },
    { key: 'resolvido_em', label: 'Resolvido em' },
    { key: 'tempo', label: 'Tempo' },
    { key: 'avaliacao', label: 'Avaliação' },
  ],
  googleads: [
    { key: 'campanha', label: 'Campanha' },
    { key: 'palavra', label: 'Palavra-chave' },
    { key: 'impressoes', label: 'Impressões' },
    { key: 'cliques', label: 'Cliques' },
    { key: 'ctr', label: 'CTR' },
    { key: 'cpc', label: 'CPC' },
    { key: 'conversoes', label: 'Conversões' },
    { key: 'roas', label: 'ROAS' },
  ],
};

const ROMAN_LEVELS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDateBR(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

function formatDateTimeBR(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatCurrencyBR(value) {
  return toNumber(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatRelative(when) {
  if (!when) return 'Nunca gerado';
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `Gerado há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Gerado há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Gerado ontem';
  if (diffD < 7) return `Gerado há ${diffD} dias`;
  return formatDateTimeBR(when);
}

function resolvePeriodRange(periodo, dataIni, dataFim) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (String(periodo || '30d')) {
    case 'hoje':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case 'mes':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'trimestre': {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case 'ano':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'custom':
      if (dataIni) start = new Date(`${dataIni}T00:00:00`);
      if (dataFim) end = new Date(`${dataFim}T23:59:59`);
      break;
    case '30d':
    default:
      start.setDate(start.getDate() - 30);
      break;
  }

  return {
    since: start.toISOString().split('T')[0],
    until: end.toISOString().split('T')[0],
  };
}

function periodoToDays(periodo) {
  const map = { hoje: 1, '7d': 7, '30d': 30, mes: 31, trimestre: 90, ano: 365 };
  return map[periodo] || 30;
}

function filterColumns(tipo, colunasSelecionadas) {
  const all = COLUNAS[tipo] || [];
  if (!colunasSelecionadas?.length) return all;
  const set = new Set(colunasSelecionadas);
  const filtered = all.filter((c) => set.has(c.label) || set.has(c.key));
  return filtered.length ? filtered : all;
}

function rowsToExport(columns, rows) {
  const headers = columns.map((c) => c.label);
  const data = rows.map((row) => columns.map((c) => row[c.key] ?? ''));
  return { headers, rows: data };
}

function buildFilename(tipo, formato, periodo) {
  const stamp = new Date().toISOString().split('T')[0];
  const ext = formato === 'pdf' ? 'pdf' : formato === 'xlsx' ? 'xlsx' : 'csv';
  const names = {
    clientes: 'base_clientes',
    financeiro: 'financeiro',
    sicaf: 'gestao_sicaf',
    suporte: 'suporte_sla',
    googleads: 'google_ads',
  };
  return `${names[tipo] || tipo}_${periodo || '30d'}_${stamp}.${ext}`;
}

function deriveClientTags(c) {
  const tags = [];
  if (c.novo) tags.push('Novo');
  if (c.manutencaoAtiva) tags.push('Manutenção');
  if (c.sicafPago) tags.push('SICAF pago');
  if (!c.pagou) tags.push('Inadimplente');
  if (c.sicafStatus === 'Vencido') tags.push('SICAF vencido');
  return tags.join(', ');
}

function mapPlanoFilter(plano) {
  const p = String(plano || '').toLowerCase();
  if (p === 'essencial' || p === 'onboarding') return 'onboarding';
  if (p === 'profissional' || p === 'sicaf') return 'sicaf';
  if (p === 'corporativo' || p === 'manutencao') return 'manutencao';
  return null;
}

function clientMatchesStatus(c, status) {
  const s = String(status || 'todos');
  if (s === 'todos') return true;
  if (s === 'ativo') return c.pagou && c.sicafStatus !== 'Vencido';
  if (s === 'inadimplente') return !c.pagou || c.sicafStatus === 'Vencido';
  if (s === 'cancelado') return c.status === 'inativo' || c.status === 'cancelado';
  return true;
}

async function gerarClientes(filtros, range) {
  const result = await adminClientsService.listClientsForAdmin({
    status: 'all',
    sicaf: 'all',
    limit: 5000,
    page: 1,
  });
  if (!result.ok) return result;

  let clients = result.clients || [];
  const planoF = mapPlanoFilter(filtros.plano);
  const mrrMin = filtros.mrrMin ? toNumber(filtros.mrrMin) : 0;

  clients = clients.filter((c) => {
    if (planoF === 'manutencao' && !c.manutencaoAtiva) return false;
    if (planoF === 'sicaf' && (!c.sicafId || c.manutencaoAtiva)) return false;
    if (planoF === 'onboarding' && (c.sicafId || c.manutencaoAtiva)) return false;
    if (!clientMatchesStatus(c, filtros.status)) return false;
    if (mrrMin > 0 && (c.mrr || 0) < mrrMin) return false;
    return true;
  });

  const rows = clients.map((c) => ({
    razao_social: c.name || '',
    cnpj: c.documento || '',
    plano: c.plano || '',
    mrr: formatCurrencyBR(c.mrr || 0),
    status_sicaf: c.sicafStatus || 'Sem cadastro',
    responsavel: c.usuarioNome || '',
    ultima_interacao: formatDateBR(c.usuarioDesde || c.createdAt),
    tags: deriveClientTags(c),
  }));

  return { ok: true, rows, total: rows.length };
}

function mapTipoMeio(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'pix') return 'PIX';
  if (t === 'cartao' || t === 'cartão') return 'Cartão';
  if (t === 'boleto') return 'Boleto';
  return 'Outro';
}

function mapStatusPg(status, dataVencimento) {
  const s = String(status || '').toLowerCase();
  if (['pago', 'paga', 'aprovado', 'aprovada', 'paid'].includes(s)) return 'Pago';
  if (['estornado', 'estornada', 'refunded'].includes(s)) return 'Estornado';
  if (['cancelado', 'cancelada', 'expirado', 'erro'].includes(s)) return 'Vencido';
  if (dataVencimento) {
    const venc = new Date(dataVencimento);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    venc.setHours(0, 0, 0, 0);
    if (!Number.isNaN(venc.getTime()) && venc < hoje) return 'Vencido';
  }
  return 'Pendente';
}

async function gerarFinanceiro(filtros, range) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const rows = [];
  const statusF = String(filtros.statusPg || 'todos');
  const formaF = String(filtros.forma || 'todas');
  const valorMin = filtros.valorMin ? toNumber(filtros.valorMin) : 0;
  const valorMax = filtros.valorMax ? toNumber(filtros.valorMax) : Infinity;

  const pushRow = (p, clienteNome) => {
    const refDate = p.data_pagamento || p.data_vencimento || p.created_at;
    if (refDate) {
      const d = new Date(refDate).toISOString().split('T')[0];
      if (d < range.since || d > range.until) return;
    }
    const status = mapStatusPg(p.status, p.data_vencimento);
    const forma = mapTipoMeio(p.tipo);
    const valor = toNumber(p.valor);
    if (statusF !== 'todos') {
      const map = { pago: 'Pago', pendente: 'Pendente', vencido: 'Vencido', estorno: 'Estornado' };
      if (status !== map[statusF]) return;
    }
    if (formaF !== 'todas') {
      const map = { pix: 'PIX', boleto: 'Boleto', cartao: 'Cartão' };
      if (forma !== map[formaF]) return;
    }
    if (valor < valorMin || valor > valorMax) return;

    rows.push({
      cliente: clienteNome || 'Cliente não informado',
      fatura: p.descricao || `PG-${p.id}`,
      vencimento: formatDateBR(p.data_vencimento),
      pago_em: formatDateBR(p.data_pagamento),
      valor: formatCurrencyBR(valor),
      forma,
      status,
      juros_multa: '—',
    });
  };

  try {
    const hasPag = await db.schema.hasTable('pagamentos');
    if (hasPag) {
      const pg = await db('pagamentos as p')
        .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
        .whereNull('p.deleted_at')
        .select(
          'p.id',
          'p.tipo',
          'p.valor',
          'p.descricao',
          'p.status',
          'p.data_vencimento',
          'p.data_pagamento',
          'p.created_at',
          'c.razao_social',
          'c.nome_fantasia',
        )
        .orderBy('p.updated_at', 'desc')
        .limit(5000);
      for (const p of pg) pushRow(p, p.razao_social || p.nome_fantasia);
    } else if (await db.schema.hasTable('pagamentos_gerencianet')) {
      const gn = await db('pagamentos_gerencianet as p')
        .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
        .select(
          'p.id',
          'p.tipo',
          'p.valor',
          'p.descricao',
          'p.status',
          'p.data_vencimento',
          'p.data_pagamento',
          'p.created_at',
          'c.razao_social',
          'c.nome_fantasia',
        )
        .orderBy('p.created_at', 'desc')
        .limit(5000);
      for (const p of gn) pushRow(p, p.razao_social || p.nome_fantasia);
    }
  } catch (e) {
    console.error('[AdminRelatorios] Erro financeiro:', e.message);
    return { ok: false, error: e.message };
  }

  return { ok: true, rows, total: rows.length };
}

function countPendencias(niveisDetalhe) {
  if (!niveisDetalhe) return 0;
  return ROMAN_LEVELS.filter((r) => {
    const s = niveisDetalhe[r];
    return s && s !== 'validado';
  }).length;
}

function nivelMaximo(niveisDetalhe) {
  for (let i = ROMAN_LEVELS.length - 1; i >= 0; i -= 1) {
    const r = ROMAN_LEVELS[i];
    if (niveisDetalhe?.[r] === 'validado') return r;
  }
  for (const r of ROMAN_LEVELS) {
    if (niveisDetalhe?.[r] && niveisDetalhe[r] !== 'nao_cadastrado') return r;
  }
  return '—';
}

function sicafMatchesSit(row, sit) {
  const s = String(sit || 'todas');
  if (s === 'todas') return true;
  if (s === 'ok') return row.status === 'completo';
  if (s === 'vencendo') return row.status === 'vencendo';
  if (s === 'vencido') return row.status === 'vencido';
  if (s === 'pendente') return row.status === 'incompleto';
  return true;
}

async function gerarSicaf(filtros) {
  const result = await adminSicafService.getAdminSicaf({ limit: 5000 });
  if (!result.ok) return result;

  let rowsData = (result.rows || []).map((r) => ({
    empresa: r.cli,
    cnpj: r.cnpj,
    nivel: nivelMaximo(r.niveisDetalhe),
    status: r.status,
    validade: formatDateBR(r.sicafValidade),
    dias_restantes: r.diasVenc ?? '',
    pendencias: countPendencias(r.niveisDetalhe),
    responsavel: '—',
  }));

  const nivelF = String(filtros.nivel || 'todos');
  if (nivelF !== 'todos') {
    rowsData = rowsData.filter((r) => r.nivel === nivelF);
  }
  rowsData = rowsData.filter((r) => sicafMatchesSit(
    { status: r.status },
    filtros.sit,
  ));

  return { ok: true, rows: rowsData, total: rowsData.length };
}

function ticketDuration(createdAt, resolvedAt) {
  if (!createdAt) return '—';
  const start = new Date(createdAt);
  const end = resolvedAt ? new Date(resolvedAt) : new Date();
  if (Number.isNaN(start.getTime())) return '—';
  const hours = Math.round((end.getTime() - start.getTime()) / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

async function gerarSuporte(filtros, range) {
  const statusMap = {
    aberto: 'aberto',
    andamento: 'em_andamento',
    resolvido: 'resolvido',
    fechado: 'fechado',
  };
  const statusF = filtros.stTk && filtros.stTk !== 'todos' ? statusMap[filtros.stTk] || filtros.stTk : undefined;

  const result = await ticketsService.listarTicketsAdmin({ status: statusF });
  if (!result.ok) return result;

  const db = getDb();
  let rawTickets = [];
  if (db) {
    try {
      let q = db('tickets as t')
        .leftJoin('clientes as c', 't.cliente_id', 'c.id')
        .select('t.*', 'c.razao_social as cliente_nome')
        .where('t.created_at', '>=', `${range.since} 00:00:00`)
        .where('t.created_at', '<=', `${range.until} 23:59:59`)
        .orderBy('t.created_at', 'desc')
        .limit(5000);
      if (statusF) q = q.where('t.status', statusF);
      if (filtros.cat && filtros.cat !== 'todas') q = q.where('t.categoria', filtros.cat);
      rawTickets = await q;
    } catch (e) {
      console.warn('[AdminRelatorios] Fallback tickets:', e.message);
    }
  }

  const source = rawTickets.length ? rawTickets : (result.tickets || []);
  const rows = [];

  for (const t of source) {
    const created = t.created_at || t.createdAt;
    const resolved =
      ['resolvido', 'fechado'].includes(t.status) ? t.updated_at || t.resolvedAt : null;
    rows.push({
      ticket: t.codigo || t.id,
      cliente: t.cliente_nome || t.client || '—',
      assunto: t.titulo || t.title || '',
      categoria: t.categoria || t.category || '',
      aberto_em: formatDateTimeBR(created),
      resolvido_em: resolved ? formatDateTimeBR(resolved) : '—',
      tempo: ticketDuration(created, resolved),
      avaliacao: '—',
    });
  }

  return { ok: true, rows, total: rows.length };
}

async function gerarGoogleAds(filtros, range) {
  const days = periodoToDays(filtros.periodo) || Math.max(
    1,
    Math.ceil((new Date(range.until) - new Date(range.since)) / 86400000),
  );
  const result = await adminGoogleAdsService.getAdminGoogleAds({ days });
  if (!result.ok) return result;

  const rows = (result.palavras || []).map((p) => {
    const clicks = toNumber(p.clicks);
    const impressoes = toNumber(p.impressoes || clicks * 12);
    const ctr = impressoes > 0 ? `${((clicks / impressoes) * 100).toFixed(2)}%` : '—';
    const invest = toNumber(p.investimentoEstimado);
    const cpc = clicks > 0 && invest > 0 ? formatCurrencyBR(invest / clicks) : '—';
    return {
      campanha: 'Google Search',
      palavra: p.palavra || '',
      impressoes,
      cliques: clicks,
      ctr,
      cpc,
      conversoes: toNumber(p.pagos),
      roas: p.roas != null ? String(p.roas) : '—',
    };
  });

  return { ok: true, rows, total: rows.length };
}

async function gerarRelatorio(opts = {}) {
  const tipo = String(opts.tipo || '').toLowerCase();
  if (!TIPOS.includes(tipo)) {
    return { ok: false, error: `Tipo de relatório inválido: ${tipo}` };
  }

  const filtros = opts.filtros || {};
  const range = resolvePeriodRange(opts.periodo, opts.dataIni, opts.dataFim);
  filtros.periodo = opts.periodo;

  let generated;
  switch (tipo) {
    case 'clientes':
      generated = await gerarClientes(filtros, range);
      break;
    case 'financeiro':
      generated = await gerarFinanceiro(filtros, range);
      break;
    case 'sicaf':
      generated = await gerarSicaf(filtros);
      break;
    case 'suporte':
      generated = await gerarSuporte(filtros, range);
      break;
    case 'googleads':
      generated = await gerarGoogleAds(filtros, range);
      break;
    default:
      return { ok: false, error: 'Tipo não suportado' };
  }

  if (!generated.ok) return generated;

  const columns = filterColumns(tipo, opts.colunas);
  const exportData = rowsToExport(columns, generated.rows);
  const formato = ['csv', 'xlsx', 'pdf'].includes(opts.formato) ? opts.formato : 'csv';
  const filename = buildFilename(tipo, formato, opts.periodo || '30d');

  return {
    ok: true,
    tipo,
    filename,
    formato,
    periodo: range,
    total: generated.total,
    columns: columns.map((c) => c.label),
    headers: exportData.headers,
    rows: exportData.rows,
  };
}

async function registrarExportacao(usuarioId, payload) {
  const db = getDb();
  if (!db || !usuarioId) return;
  try {
    const hasAud = await db.schema.hasTable('auditoria_log');
    if (!hasAud) return;
    await db('auditoria_log').insert({
      usuario_id: usuarioId,
      acao: 'RELATORIO_EXPORT',
      entidade: payload.tipo,
      descricao: `${payload.filename} · ${payload.total} linhas · ${payload.formato}`,
      dados_novos: JSON.stringify({
        filename: payload.filename,
        formato: payload.formato,
        total: payload.total,
        periodo: payload.periodo,
      }),
    });
  } catch (e) {
    console.warn('[AdminRelatorios] Falha ao registrar exportação:', e.message);
  }
}

async function salvarAgendamento(usuarioId, opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const tipo = String(opts.tipo || '');
  if (!TIPOS.includes(tipo)) return { ok: false, error: 'Tipo inválido' };

  try {
    const hasTable = await db.schema.hasTable('relatorios_salvos');
    if (!hasTable) return { ok: false, error: 'Tabela relatorios_salvos não disponível' };

    const nome = opts.nome || `Agendamento ${tipo}`;
    const [id] = await db('relatorios_salvos').insert({
      usuario_id: usuarioId,
      tipo,
      nome,
      filtros: JSON.stringify({
        periodo: opts.periodo,
        dataIni: opts.dataIni,
        dataFim: opts.dataFim,
        filtros: opts.filtros || {},
        colunas: opts.colunas || null,
        formato: opts.formato,
      }),
      colunas: opts.colunas ? JSON.stringify(opts.colunas) : null,
      agendamento: JSON.stringify({
        ativo: true,
        frequencia: opts.frequencia || 'semanal',
        emails: opts.emails || [],
      }),
    });

    return { ok: true, id };
  } catch (e) {
    console.error('[AdminRelatorios] Erro agendamento:', e.message);
    return { ok: false, error: e.message };
  }
}

async function fetchHistorico() {
  const db = getDb();
  if (!db) return [];

  try {
    const hasAud = await db.schema.hasTable('auditoria_log');
    if (!hasAud) return [];

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const rows = await db('auditoria_log as a')
      .leftJoin('usuarios as u', 'a.usuario_id', 'u.id')
      .where('a.acao', 'RELATORIO_EXPORT')
      .where('a.created_at', '>=', since)
      .orderBy('a.created_at', 'desc')
      .limit(30)
      .select('a.*', 'u.nome as usuario_nome');

    return rows.map((r) => {
      let meta = {};
      try {
        meta = typeof r.dados_novos === 'string' ? JSON.parse(r.dados_novos) : r.dados_novos || {};
      } catch (_) {}
      const filename = meta.filename || r.descricao?.split(' · ')[0] || 'relatorio.csv';
      const formato = meta.formato || (filename.endsWith('.pdf') ? 'pdf' : filename.endsWith('.xlsx') ? 'xlsx' : 'csv');
      return {
        id: r.id,
        filename,
        formato: String(formato).toUpperCase(),
        usuario: r.usuario_nome || 'Sistema',
        quando: r.created_at,
        quandoLabel: formatRelative(r.created_at),
        total: meta.total || null,
        tipo: r.entidade,
      };
    });
  } catch (e) {
    console.warn('[AdminRelatorios] Histórico indisponível:', e.message);
    return [];
  }
}

async function fetchContagens() {
  const db = getDb();
  const counts = {};
  if (!db) {
    for (const t of TIPOS) counts[t] = 0;
    return counts;
  }

  try {
    const [clientes, sicaf, tickets] = await Promise.all([
      db('clientes').count({ total: '*' }).first().catch(() => ({ total: 0 })),
      db.schema.hasTable('sicaf_cadastros').then((has) =>
        has ? db('sicaf_cadastros').count({ total: '*' }).first() : { total: 0 },
      ),
      db.schema.hasTable('tickets').then((has) =>
        has ? db('tickets').count({ total: '*' }).first() : { total: 0 },
      ),
    ]);
    counts.clientes = parseInt(clientes?.total, 10) || 0;
    counts.sicaf = parseInt(sicaf?.total, 10) || 0;
    counts.suporte = parseInt(tickets?.total, 10) || 0;

    const hasPg = await db.schema.hasTable('pagamentos');
    const hasGn = await db.schema.hasTable('pagamentos_gerencianet');
    if (hasPg) {
      const f = await db('pagamentos').whereNull('deleted_at').count({ total: '*' }).first();
      counts.financeiro = parseInt(f?.total, 10) || 0;
    } else if (hasGn) {
      const f = await db('pagamentos_gerencianet').count({ total: '*' }).first();
      counts.financeiro = parseInt(f?.total, 10) || 0;
    } else {
      counts.financeiro = 0;
    }

    const hasTrack = await db.schema.hasTable('tracking_sessoes');
    if (hasTrack) {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const g = await db('tracking_sessoes')
        .where('created_at', '>=', since.toISOString().split('T')[0])
        .whereNotNull('utm_term')
        .where('utm_term', '!=', '')
        .countDistinct('utm_term as total')
        .first();
      counts.googleads = parseInt(g?.total, 10) || 0;
    } else {
      counts.googleads = 0;
    }
  } catch (e) {
    console.warn('[AdminRelatorios] Contagens:', e.message);
    for (const t of TIPOS) if (counts[t] == null) counts[t] = 0;
  }

  return counts;
}

async function fetchUltimaGeracaoPorTipo() {
  const db = getDb();
  const out = {};
  for (const t of TIPOS) out[t] = null;
  if (!db) return out;

  try {
    const hasAud = await db.schema.hasTable('auditoria_log');
    if (!hasAud) return out;

    const rows = await db('auditoria_log')
      .where('acao', 'RELATORIO_EXPORT')
      .whereIn('entidade', TIPOS)
      .select('entidade', db.raw('MAX(created_at) as ultima'))
      .groupBy('entidade');

    for (const r of rows) {
      out[r.entidade] = r.ultima;
    }
  } catch (_) {}

  return out;
}

async function getAdminRelatorios() {
  const [contagens, historico, ultimas] = await Promise.all([
    fetchContagens(),
    fetchHistorico(),
    fetchUltimaGeracaoPorTipo(),
  ]);

  const cards = TIPOS.map((key) => ({
    key,
    registros: contagens[key] || 0,
    ultimaGeracao: ultimas[key],
    ultimaLabel: formatRelative(ultimas[key]),
  }));

  const totalArquivos = historico.length;
  const tamanhoEstimadoMb = Math.round(totalArquivos * 0.8 * 10) / 10;

  return {
    ok: true,
    cards,
    historico,
    resumo: {
      totalArquivos,
      tamanhoEstimadoMb,
    },
    colunas: COLUNAS,
  };
}

module.exports = {
  getAdminRelatorios,
  gerarRelatorio,
  registrarExportacao,
  salvarAgendamento,
  COLUNAS,
  TIPOS,
};
