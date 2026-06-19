/**
 * Dashboard administrativo — KPIs e visão executiva com dados reais do banco v2.
 */
const { getDb } = require('../database/connection');

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function aggregateNumber(row, preferredKey = 'total') {
  if (!row || typeof row !== 'object') return 0;
  const pref = row[preferredKey];
  if (pref !== undefined && pref !== null && pref !== '') return toNumber(pref);
  const lk = String(preferredKey).toLowerCase();
  const alt = Object.keys(row).find((k) => String(k).toLowerCase() === lk);
  if (alt) return toNumber(row[alt]);
  const keys = Object.keys(row);
  if (keys.length === 1) return toNumber(row[keys[0]]);
  return 0;
}

function formatCurrencyBR(value) {
  return toNumber(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMesAnoLegendaBR(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatDateBR(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

function formatTimeBR(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function calcChangePercent(current, previous) {
  const cur = toNumber(current);
  const prev = toNumber(previous);
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

async function safeDashboardQuery(fallback, fn) {
  try {
    return await fn();
  } catch (e) {
    console.warn('[AdminDashboard] Consulta ignorada:', e.message);
    return fallback;
  }
}

async function hasDashboardTable(db, tableName) {
  return safeDashboardQuery(false, () => db.schema.hasTable(tableName));
}

const RECEITA_MANUT_PAGO_WHERE =
  "(LOWER(TRIM(CAST(manutencao_boletos.status AS CHAR))) IN ('pago','aprovado') OR manutencao_boletos.status IN ('Pago','pago','Aprovado','aprovado'))";
const RECEITA_MANUT_REF_DIA =
  'DATE(COALESCE(manutencao_boletos.data_pagamento, manutencao_boletos.data_vencimento, manutencao_boletos.created_at))';

const RECEITA_SICAF_PAGO_WHERE =
  "(LOWER(TRIM(CAST(taxas_sicaf.status AS CHAR))) IN ('pago','paga','aprovado','aprovada') OR taxas_sicaf.status IN ('Pago','Paga','pago','paga','Aprovado','Aprovada','aprovado','aprovada'))";
const RECEITA_SICAF_REF_DIA = 'DATE(COALESCE(taxas_sicaf.data_pagamento, taxas_sicaf.created_at))';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function diaLabel(offsetFromToday) {
  const d = new Date();
  d.setDate(d.getDate() - offsetFromToday);
  if (offsetFromToday === 0) return 'Hoje';
  return DIAS_SEMANA[d.getDay()];
}

async function getAdminDashboard() {
  try {
    return await loadAdminDashboardData();
  } catch (e) {
    console.error('[AdminDashboard] Erro fatal:', e);
    return { ok: false, error: e.message || 'Erro ao carregar dashboard' };
  }
}

async function loadAdminDashboardData() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const [
    hasUsuarios,
    hasClientes,
    hasSicaf,
    hasManutencoes,
    hasManutBoletos,
    hasTaxas,
    hasCertidoes,
    hasLicitacoes,
    hasTickets,
    hasAuditoria,
    hasTracking,
    hasNiveis,
    hasDocumentos,
  ] = await Promise.all([
    hasDashboardTable(db, 'usuarios'),
    hasDashboardTable(db, 'clientes'),
    hasDashboardTable(db, 'sicaf_cadastros'),
    hasDashboardTable(db, 'manutencoes'),
    hasDashboardTable(db, 'manutencao_boletos'),
    hasDashboardTable(db, 'taxas_sicaf'),
    hasDashboardTable(db, 'certidoes'),
    hasDashboardTable(db, 'licitacoes'),
    hasDashboardTable(db, 'tickets'),
    hasDashboardTable(db, 'auditoria_log'),
    hasDashboardTable(db, 'tracking_sessoes'),
    hasDashboardTable(db, 'sicaf_niveis'),
    hasDashboardTable(db, 'documentos'),
  ]);

  const scalar = async (fallback, queryFn, key = 'total') => {
    const row = await safeDashboardQuery(null, queryFn);
    return row ? aggregateNumber(row, key) : fallback;
  };

  const receitaManutPagoWhere = (q) => q.whereRaw(RECEITA_MANUT_PAGO_WHERE);
  const receitaSicafPagoWhere = (q) => q.whereRaw(RECEITA_SICAF_PAGO_WHERE);
  const scalarWhen = (cond, queryFn, key = 'total') => (cond ? scalar(0, queryFn, key) : Promise.resolve(0));
  const usuariosSemSicafQuery = () =>
    db('clientes as c').leftJoin('taxas_sicaf as t', 't.cliente_id', 'c.id').whereNull('t.id');
  const taxaPagaAliasWhere =
    "(LOWER(TRIM(CAST(t.status AS CHAR))) IN ('pago','paga','aprovado','aprovada') OR t.status IN ('Pago','Paga','pago','paga','Aprovado','Aprovada','aprovado','aprovada'))";

  const [
    manutAtivas,
    manutAtivasMes,
    manutAtivasMesAnterior,
    sicafHoje,
    sicafOntem,
    sicafTotal,
    sicafMes,
    sicafMesAnterior,
    usuariosSemSicaf,
    usuariosSemSicafSemana,
    usuariosSemSicafSemanaAnterior,
    certidoesVencidas,
    certidoesVencidasMes,
    certidoesVencidasMesAnterior,
    certidoesVencidasSemana,
    receitaManutTotal,
    receitaManutMes,
    receitaManutMesAnterior,
    receitaManutHoje,
    receitaManutOntem,
    receitaSicafPagoMes,
    receitaSicafPagoMesAnterior,
    receitaSicafPagoTotal,
    receitaSicafHoje,
    receitaSicafOntem,
    sicafPagosHoje,
    sicafPagosOntem,
    sicafPagosMes,
    licitacoesAtivas,
    licitacoesSemana,
    licitacoesSemanaAnterior,
    ticketsAbertos,
    ticketsForaSla,
    ticketsSemana,
    ticketsSemanaAnterior,
    chamadasPendentes,
    chamadasPendentesOntem,
    manutVencendo,
    manutVencidas,
    manutCanceladas,
    taxasGeradas,
    boletosPendentesManut,
    boletosPendentesSicaf,
    inadimplenciaManut,
    inadimplenciaSicaf,
    clientesInadimplentes,
    sicafAtivos,
    sicafPendentes,
    sicafVencendo7d,
    sicafNiveisAmarelo,
    sicafNiveisVermelho,
    novosClientesHoje,
    novosClientesOntem,
    novosClientesMes,
    novosClientesPagos,
    visitasSite,
    cadastrosTotal,
    pagaramTotal,
    docsEnviados,
    renovaram,
    sessionsGads,
    convertedGads,
    receitaGads,
  ] = await Promise.all([
    scalarWhen(hasManutencoes, () => db('manutencoes').where('status', 'Ativo').count({ total: '*' }).first()),
    scalarWhen(hasManutencoes, () =>
      db('manutencoes')
        .where('status', 'Ativo')
        .whereRaw("created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')")
        .count({ total: '*' })
        .first()),
    scalarWhen(hasManutencoes, () =>
      db('manutencoes')
        .where('status', 'Ativo')
        .whereRaw("created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')")
        .whereRaw("created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')")
        .count({ total: '*' })
        .first()),
    scalarWhen(hasSicaf, () => db('sicaf_cadastros').whereRaw('DATE(created_at) = CURDATE()').count({ total: '*' }).first()),
    scalarWhen(hasSicaf, () =>
      db('sicaf_cadastros').whereRaw('DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)').count({ total: '*' }).first()),
    scalarWhen(hasSicaf, () => db('sicaf_cadastros').count({ total: '*' }).first()),
    scalarWhen(hasSicaf, () =>
      db('sicaf_cadastros').whereRaw("created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')").count({ total: '*' }).first()),
    scalarWhen(hasSicaf, () =>
      db('sicaf_cadastros')
        .whereRaw("created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')")
        .whereRaw("created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')")
        .count({ total: '*' })
        .first()),
    scalarWhen(hasClientes && hasTaxas, () => usuariosSemSicafQuery().countDistinct({ total: 'c.id' }).first()),
    scalarWhen(hasClientes && hasTaxas, () =>
      usuariosSemSicafQuery()
        .whereRaw('c.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)')
        .countDistinct({ total: 'c.id' })
        .first()),
    scalarWhen(hasClientes && hasTaxas, () =>
      usuariosSemSicafQuery()
        .whereRaw('c.created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)')
        .whereRaw('c.created_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)')
        .countDistinct({ total: 'c.id' })
        .first()),
    scalarWhen(hasCertidoes, () =>
      db('certidoes')
        .where(function () {
          this.where('status', 'Vencida').orWhereRaw('DATE(data_validade) < CURDATE()');
        })
        .count({ total: '*' })
        .first()),
    scalarWhen(hasCertidoes, () =>
      db('certidoes')
        .whereRaw("data_validade >= DATE_FORMAT(CURDATE(), '%Y-%m-01')")
        .whereRaw('DATE(data_validade) < CURDATE()')
        .count({ total: '*' })
        .first()),
    scalarWhen(hasCertidoes, () =>
      db('certidoes')
        .whereRaw("data_validade >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')")
        .whereRaw("data_validade < DATE_FORMAT(CURDATE(), '%Y-%m-01')")
        .count({ total: '*' })
        .first()),
    scalarWhen(hasCertidoes, () =>
      db('certidoes')
        .whereRaw('DATE(data_validade) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)')
        .whereRaw('DATE(data_validade) < CURDATE()')
        .count({ total: '*' })
        .first()),
    scalarWhen(hasManutBoletos, () => receitaManutPagoWhere(db('manutencao_boletos')).sum({ total: 'valor' }).first()),
    scalarWhen(hasManutBoletos, () =>
      receitaManutPagoWhere(db('manutencao_boletos'))
        .whereRaw(`${RECEITA_MANUT_REF_DIA} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .whereRaw(`${RECEITA_MANUT_REF_DIA} < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`)
        .sum({ total: 'valor' })
        .first()),
    scalarWhen(hasManutBoletos, () =>
      receitaManutPagoWhere(db('manutencao_boletos'))
        .whereRaw(`${RECEITA_MANUT_REF_DIA} >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')`)
        .whereRaw(`${RECEITA_MANUT_REF_DIA} < DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .sum({ total: 'valor' })
        .first()),
    scalarWhen(hasManutBoletos, () =>
      receitaManutPagoWhere(db('manutencao_boletos')).whereRaw(`${RECEITA_MANUT_REF_DIA} = CURDATE()`).sum({ total: 'valor' }).first()),
    scalarWhen(hasManutBoletos, () =>
      receitaManutPagoWhere(db('manutencao_boletos'))
        .whereRaw(`${RECEITA_MANUT_REF_DIA} = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`)
        .sum({ total: 'valor' })
        .first()),
    scalarWhen(hasTaxas, () =>
      receitaSicafPagoWhere(db('taxas_sicaf'))
        .whereRaw(`${RECEITA_SICAF_REF_DIA} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .whereRaw(`${RECEITA_SICAF_REF_DIA} < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`)
        .sum({ total: 'valor' })
        .first()),
    scalarWhen(hasTaxas, () =>
      receitaSicafPagoWhere(db('taxas_sicaf'))
        .whereRaw(`${RECEITA_SICAF_REF_DIA} >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')`)
        .whereRaw(`${RECEITA_SICAF_REF_DIA} < DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .sum({ total: 'valor' })
        .first()),
    scalarWhen(hasTaxas, () => receitaSicafPagoWhere(db('taxas_sicaf')).sum({ total: 'valor' }).first()),
    scalarWhen(hasTaxas, () =>
      receitaSicafPagoWhere(db('taxas_sicaf')).whereRaw(`${RECEITA_SICAF_REF_DIA} = CURDATE()`).sum({ total: 'valor' }).first()),
    scalarWhen(hasTaxas, () =>
      receitaSicafPagoWhere(db('taxas_sicaf'))
        .whereRaw(`${RECEITA_SICAF_REF_DIA} = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`)
        .sum({ total: 'valor' })
        .first()),
    scalarWhen(hasTaxas, () =>
      receitaSicafPagoWhere(db('taxas_sicaf'))
        .whereRaw(`${RECEITA_SICAF_REF_DIA} = CURDATE()`)
        .countDistinct({ total: 'cliente_id' })
        .first()),
    scalarWhen(hasTaxas, () =>
      receitaSicafPagoWhere(db('taxas_sicaf'))
        .whereRaw(`${RECEITA_SICAF_REF_DIA} = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`)
        .countDistinct({ total: 'cliente_id' })
        .first()),
    scalarWhen(hasTaxas, () =>
      receitaSicafPagoWhere(db('taxas_sicaf'))
        .whereRaw(`${RECEITA_SICAF_REF_DIA} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .whereRaw(`${RECEITA_SICAF_REF_DIA} < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`)
        .countDistinct({ total: 'cliente_id' })
        .first()),
    scalarWhen(hasLicitacoes, () =>
      db('licitacoes').whereIn('status', ['Ativa', 'Aberta', 'Em Andamento']).count({ total: '*' }).first()),
    scalarWhen(hasLicitacoes, () =>
      db('licitacoes').whereRaw('created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)').count({ total: '*' }).first()),
    scalarWhen(hasLicitacoes, () =>
      db('licitacoes')
        .whereRaw('created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)')
        .whereRaw('created_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)')
        .count({ total: '*' })
        .first()),
    scalarWhen(hasTickets, () => db('tickets').whereIn('status', ['aberto', 'em_andamento']).count({ total: '*' }).first()),
    scalarWhen(hasTickets, () =>
      db('tickets')
        .whereIn('status', ['aberto', 'em_andamento'])
        .where(function () {
          this.where('sla_minutos_restantes', '<=', 0).orWhereRaw('sla_prazo IS NOT NULL AND sla_prazo < NOW()');
        })
        .count({ total: '*' })
        .first()),
    scalarWhen(hasTickets, () =>
      db('tickets')
        .whereIn('status', ['aberto', 'em_andamento'])
        .whereRaw('created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)')
        .count({ total: '*' })
        .first()),
    scalarWhen(hasTickets, () =>
      db('tickets')
        .whereIn('status', ['aberto', 'em_andamento'])
        .whereRaw('created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)')
        .whereRaw('created_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)')
        .count({ total: '*' })
        .first()),
    scalarWhen(hasTickets, () => db('tickets').where('status', 'aguardando_cliente').count({ total: '*' }).first()),
    scalarWhen(hasTickets, () =>
      db('tickets')
        .where('status', 'aguardando_cliente')
        .whereRaw('DATE(updated_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)')
        .count({ total: '*' })
        .first()),
    scalarWhen(hasManutencoes, () =>
      db('manutencoes')
        .where(function () {
          this.whereIn('status', ['A Vencer', 'Vencendo']).orWhereRaw(
            "(status = 'Ativo' AND data_fim BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))"
          );
        })
        .count({ total: '*' })
        .first()),
    scalarWhen(hasManutencoes, () =>
      db('manutencoes')
        .where(function () {
          this.whereIn('status', ['Vencido', 'Vencida']).orWhereRaw("(status = 'Ativo' AND data_fim < CURDATE())");
        })
        .count({ total: '*' })
        .first()),
    scalarWhen(hasManutencoes, () =>
      db('manutencoes').whereIn('status', ['Cancelado', 'Cancelada']).count({ total: '*' }).first()),
    scalarWhen(hasTaxas, () =>
      db('taxas_sicaf').whereRaw("created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')").sum({ total: 'valor' }).first()),
    scalarWhen(hasManutBoletos, () =>
      db('manutencao_boletos').whereIn('status', ['Pendente', 'Aguardando']).sum({ total: 'valor' }).first()),
    scalarWhen(hasTaxas, () =>
      db('taxas_sicaf').whereIn('status', ['Pendente', 'Aguardando']).sum({ total: 'valor' }).first()),
    scalarWhen(hasManutBoletos, () =>
      db('manutencao_boletos').whereIn('status', ['Atrasado', 'Vencido']).sum({ total: 'valor' }).first()),
    scalarWhen(hasTaxas, () =>
      db('taxas_sicaf').whereIn('status', ['Atrasado', 'Vencido']).sum({ total: 'valor' }).first()),
    scalarWhen(hasManutBoletos || hasTaxas, async () => {
      const ids = new Set();
      if (hasManutBoletos) {
        const rows = await db('manutencao_boletos')
          .whereIn('status', ['Atrasado', 'Vencido'])
          .distinct('cliente_id');
        rows.forEach((r) => ids.add(r.cliente_id));
      }
      if (hasTaxas) {
        const rows = await db('taxas_sicaf').whereIn('status', ['Atrasado', 'Vencido']).distinct('cliente_id');
        rows.forEach((r) => ids.add(r.cliente_id));
      }
      return { total: ids.size };
    }),
    scalarWhen(hasSicaf, () => db('sicaf_cadastros').where('status', 'Ativo').count({ total: '*' }).first()),
    scalarWhen(hasSicaf, () => db('sicaf_cadastros').where('status', 'Pendente').count({ total: '*' }).first()),
    scalarWhen(hasSicaf, () =>
      db('sicaf_cadastros')
        .whereRaw('data_validade IS NOT NULL')
        .whereRaw('DATE(data_validade) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)')
        .count({ total: '*' })
        .first()),
    scalarWhen(hasNiveis, () =>
      db('sicaf_niveis')
        .where(function () {
          this.whereRaw("LOWER(COALESCE(status,'')) LIKE '%pendente%'")
            .orWhereRaw("LOWER(COALESCE(status,'')) LIKE '%vencendo%'")
            .orWhereRaw("LOWER(COALESCE(status,'')) LIKE '%a vencer%'");
        })
        .count({ total: '*' })
        .first()),
    scalarWhen(hasNiveis, () =>
      db('sicaf_niveis').whereRaw("LOWER(COALESCE(status,'')) LIKE '%vencido%'").count({ total: '*' }).first()),
    scalarWhen(hasClientes, () => db('clientes').whereRaw('DATE(created_at) = CURDATE()').count({ total: '*' }).first()),
    scalarWhen(hasClientes, () =>
      db('clientes').whereRaw('DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)').count({ total: '*' }).first()),
    scalarWhen(hasClientes, () =>
      db('clientes').whereRaw("created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')").count({ total: '*' }).first()),
    scalarWhen(hasClientes && hasTaxas, () =>
      db('clientes as c')
        .innerJoin('taxas_sicaf as t', 't.cliente_id', 'c.id')
        .whereRaw("c.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')")
        .whereRaw(taxaPagaAliasWhere)
        .countDistinct({ total: 'c.id' })
        .first()),
    scalarWhen(hasTracking, () => db('tracking_sessoes').count({ total: '*' }).first()),
    scalarWhen(hasUsuarios, () => db('usuarios').count({ total: '*' }).first()),
    scalarWhen(hasTaxas, () =>
      receitaSicafPagoWhere(db('taxas_sicaf')).countDistinct({ total: 'cliente_id' }).first()),
    scalarWhen(hasClientes && hasDocumentos, () =>
      db('clientes as c')
        .innerJoin('documentos as d', 'd.cliente_id', 'c.id')
        .countDistinct({ total: 'c.id' })
        .first()),
    scalarWhen(hasSicaf, () => db('sicaf_cadastros').where('credenciamento_anual', 1).count({ total: '*' }).first()),
    scalarWhen(hasTracking, () => db('tracking_sessoes').whereNotNull('gclid').count({ total: '*' }).first()),
    scalarWhen(hasTracking, () =>
      db('tracking_sessoes').whereNotNull('gclid').where('converted', 1).count({ total: '*' }).first()),
    scalarWhen(hasTracking, () =>
      db('tracking_sessoes').whereNotNull('gclid').sum({ total: 'conversion_value' }).first()),
  ]);


  const refMesAtual = new Date();
  const refMesAnterior = new Date(refMesAtual.getFullYear(), refMesAtual.getMonth() - 1, 15);
  const legendaMesAtual = formatMesAnoLegendaBR(refMesAtual);
  const legendaMesAnterior = formatMesAnoLegendaBR(refMesAnterior);


  const [
    recentSicafRows,
    usersWithoutRows,
    activityRows,
    manutFatRows,
    sicafFatRows,
  ] = await Promise.all([
    hasSicaf && hasClientes
      ? safeDashboardQuery([], () =>
          db('sicaf_cadastros as s')
            .leftJoin('clientes as c', 'c.id', 's.cliente_id')
            .leftJoin('sicaf_niveis as sn', 'sn.sicaf_id', 's.id')
            .whereRaw('DATE(s.created_at) = CURDATE()')
            .groupBy('s.id', 'c.razao_social', 'c.nome_fantasia', 's.status', 's.credenciamento_anual', 's.created_at')
            .select(
              's.id',
              'c.razao_social',
              'c.nome_fantasia',
              's.status',
              's.credenciamento_anual',
              's.created_at',
              db.raw('MAX(sn.nivel) as nivel')
            )
            .orderBy('s.created_at', 'desc')
            .limit(5)
        )
      : Promise.resolve([]),
    hasUsuarios && hasClientes && hasTaxas
      ? safeDashboardQuery([], () =>
          db('clientes as c')
            .leftJoin('usuarios as u', 'u.id', 'c.usuario_id')
            .leftJoin('taxas_sicaf as t', 't.cliente_id', 'c.id')
            .whereNull('t.id')
            .groupBy('c.id', 'c.razao_social', 'c.nome_fantasia', 'c.created_at', 'u.nome', 'u.email')
            .select('c.id', 'c.razao_social', 'c.nome_fantasia', 'c.created_at', 'u.nome', 'u.email')
            .orderBy('c.created_at', 'desc')
            .limit(3)
        )
      : Promise.resolve([]),
    hasAuditoria
      ? safeDashboardQuery([], () =>
          db('auditoria_log as h')
            .leftJoin('usuarios as u', 'u.id', 'h.usuario_id')
            .select('h.id', 'h.acao', 'h.entidade', 'h.descricao', 'h.created_at', 'u.nome as usuario_nome')
            .orderBy('h.created_at', 'desc')
            .limit(6)
        )
      : Promise.resolve([]),
    hasManutBoletos
      ? safeDashboardQuery([], () =>
          receitaManutPagoWhere(db('manutencao_boletos'))
            .whereRaw(`${RECEITA_MANUT_REF_DIA} >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`)
            .select(
              db.raw(`DATEDIFF(CURDATE(), ${RECEITA_MANUT_REF_DIA}) as offset_dia`),
              db.raw('SUM(valor) as total')
            )
            .groupByRaw(`DATEDIFF(CURDATE(), ${RECEITA_MANUT_REF_DIA})`)
        )
      : Promise.resolve([]),
    hasTaxas
      ? safeDashboardQuery([], () =>
          receitaSicafPagoWhere(db('taxas_sicaf'))
            .whereRaw(`${RECEITA_SICAF_REF_DIA} >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`)
            .select(
              db.raw(`DATEDIFF(CURDATE(), ${RECEITA_SICAF_REF_DIA}) as offset_dia`),
              db.raw('SUM(valor) as total')
            )
            .groupByRaw(`DATEDIFF(CURDATE(), ${RECEITA_SICAF_REF_DIA})`)
        )
      : Promise.resolve([]),
  ]);

  const faturamento7Dias = [];
  const fatByOffset = new Map();
  for (let i = 0; i <= 6; i += 1) fatByOffset.set(i, 0);

  for (const row of manutFatRows) {
    const off = toNumber(row.offset_dia);
    if (off >= 0 && off <= 6) fatByOffset.set(off, (fatByOffset.get(off) || 0) + toNumber(row.total));
  }
  for (const row of sicafFatRows) {
    const off = toNumber(row.offset_dia);
    if (off >= 0 && off <= 6) fatByOffset.set(off, (fatByOffset.get(off) || 0) + toNumber(row.total));
  }
  for (let i = 6; i >= 0; i -= 1) {
    const v = Math.round((fatByOffset.get(i) || 0) * 100) / 100;
    faturamento7Dias.push({ d: diaLabel(i), v });
  }
  const faturamento7Total = faturamento7Dias.reduce((acc, row) => acc + row.v, 0);

  const faturamentoHoje = receitaManutHoje + receitaSicafHoje;
  const faturamentoOntem = receitaManutOntem + receitaSicafOntem;
  const faturamentoMes = receitaManutMes + receitaSicafPagoMes;
  const faturamentoMesAnterior = receitaManutMesAnterior + receitaSicafPagoMesAnterior;

  const manutencaoTotal = manutAtivas;

  const funilData = [
    { etapa: 'Visitou site', v: visitasSite },
    { etapa: 'Cadastrou', v: cadastrosTotal },
    { etapa: 'Pagou', v: pagaramTotal },
    { etapa: 'Enviou docs', v: docsEnviados },
    { etapa: 'SICAF OK', v: sicafAtivos },
    { etapa: 'Manutenção', v: manutencaoTotal },
    { etapa: 'Renovou', v: renovaram },
  ];

  const alertas = [];
  if (hasCertidoes && hasClientes) {
    const certRows = await safeDashboardQuery([], () =>
      db('certidoes as ce')
        .leftJoin('clientes as c', 'c.id', 'ce.cliente_id')
        .leftJoin('tipo_certidoes as tc', 'tc.id', 'ce.tipo_certidao_id')
        .whereRaw('DATE(ce.data_validade) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)')
        .whereNot('ce.status', 'Vencida')
        .select('c.razao_social', 'c.nome_fantasia', 'ce.data_validade', 'tc.nome as tipo_nome')
        .orderBy('ce.data_validade', 'asc')
        .limit(2)
    );
    for (const row of certRows) {
      const dias = Math.max(
        0,
        Math.ceil((new Date(row.data_validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );
      alertas.push({
        tipo: `${row.tipo_nome || 'Certidão'} vencendo`,
        cliente: row.razao_social || row.nome_fantasia || 'Cliente',
        em: dias === 0 ? 'Hoje' : `${dias} dias`,
        tom: dias <= 3 ? 'rose' : 'amber',
      });
    }
  }
  if (hasManutBoletos && hasClientes) {
    const boletoRows = await safeDashboardQuery([], () =>
      db('manutencao_boletos as b')
        .leftJoin('clientes as c', 'c.id', 'b.cliente_id')
        .whereIn('b.status', ['Atrasado', 'Vencido'])
        .select('c.razao_social', 'c.nome_fantasia', 'b.data_vencimento')
        .orderBy('b.data_vencimento', 'asc')
        .limit(1)
    );
    for (const row of boletoRows) {
      alertas.push({
        tipo: 'Boleto vencido',
        cliente: row.razao_social || row.nome_fantasia || 'Cliente',
        em: formatDateBR(row.data_vencimento) || '—',
        tom: 'amber',
      });
    }
  }
  if (hasTickets && hasClientes) {
    const ticketRows = await safeDashboardQuery([], () =>
      db('tickets as t')
        .leftJoin('clientes as c', 'c.id', 't.cliente_id')
        .whereIn('t.status', ['aberto', 'em_andamento'])
        .where(function () {
          this.where('t.sla_minutos_restantes', '<=', 0).orWhereRaw('t.sla_prazo IS NOT NULL AND t.sla_prazo < NOW()');
        })
        .select('t.titulo', 'c.razao_social', 'c.nome_fantasia', 't.sla_minutos_restantes')
        .orderBy('t.created_at', 'asc')
        .limit(1)
    );
    for (const row of ticketRows) {
      alertas.push({
        tipo: 'Ticket sem resposta',
        cliente: row.razao_social || row.nome_fantasia || row.titulo || 'Cliente',
        em: row.sla_minutos_restantes <= 0 ? 'SLA estourado' : 'SLA crítico',
        tom: 'rose',
      });
    }
  }
  if (hasSicaf && hasClientes) {
    const sicafRows = await safeDashboardQuery([], () =>
      db('sicaf_cadastros as s')
        .leftJoin('clientes as c', 'c.id', 's.cliente_id')
        .where('s.status', 'Pendente')
        .select('c.razao_social', 'c.nome_fantasia', 's.updated_at')
        .orderBy('s.updated_at', 'desc')
        .limit(1)
    );
    for (const row of sicafRows) {
      alertas.push({
        tipo: 'SICAF Pendente',
        cliente: row.razao_social || row.nome_fantasia || 'Cliente',
        em: 'Hoje',
        tom: 'amber',
      });
    }
  }

  const palavrasRows = hasTracking
    ? await safeDashboardQuery([], () =>
        db('tracking_sessoes')
          .whereNotNull('utm_term')
          .where('utm_term', '!=', '')
          .where(function () {
            this.whereNotNull('gclid').orWhere('utm_source', 'google');
          })
          .select(
            db.raw('utm_term as palavra'),
            db.raw('COUNT(*) as clicks'),
            db.raw('SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as pagos'),
            db.raw('SUM(COALESCE(conversion_value, 0)) as receita')
          )
          .groupBy('utm_term')
          .orderBy('receita', 'desc')
          .limit(4)
      )
    : [];

  const equipeRows =
    hasTickets && hasUsuarios
      ? await safeDashboardQuery([], () =>
          db('tickets as t')
            .innerJoin('usuarios as u', 'u.id', 't.atribuido_a')
            .whereIn('t.status', ['aberto', 'em_andamento', 'resolvido', 'fechado'])
            .whereRaw('t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)')
            .groupBy('u.id', 'u.nome')
            .select(
              'u.nome',
              db.raw('COUNT(t.id) as tickets'),
              db.raw(
                "ROUND(100 * SUM(CASE WHEN t.status IN ('resolvido','fechado') AND (t.sla_minutos_restantes >= 0 OR t.sla_minutos_restantes IS NULL) THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0), 0) as sla_pct"
              ),
              db.raw(
                'ROUND(AVG(TIMESTAMPDIFF(MINUTE, t.created_at, COALESCE(t.fechado_em, NOW()))), 0) as media_min'
              )
            )
            .orderBy('tickets', 'desc')
            .limit(4)
        )
      : [];

  const conversaoGoogleAds =
    sessionsGads > 0 ? Math.round((convertedGads / sessionsGads) * 1000) / 10 : 0;
  const roasGoogleAds = sessionsGads > 0 && receitaGads > 0 ? Math.round((receitaGads / sessionsGads) * 10) / 10 : null;

  return {
    ok: true,
    todayLabel: new Date().toLocaleDateString('pt-BR'),
    kpis: [
      { label: 'Manutenções Ativas', value: String(manutAtivas), change: calcChangePercent(manutAtivasMes, manutAtivasMesAnterior), changeLabel: 'vs. mês anterior' },
      { label: 'Solicitações SICAF Hoje', value: String(sicafHoje), change: calcChangePercent(sicafHoje, sicafOntem), changeLabel: 'vs. ontem' },
      {
        label: 'Clientes SICAF Pagos Hoje',
        value: String(sicafPagosHoje),
        change: calcChangePercent(sicafPagosHoje, sicafPagosOntem),
        changeLabel: 'vs. ontem',
        sublabel: sicafPagosMes > 0 ? `${sicafPagosMes} no mês` : undefined,
      },
      { label: 'Total Solicitações SICAF', value: String(sicafTotal), change: calcChangePercent(sicafMes, sicafMesAnterior), changeLabel: 'vs. mês anterior' },
      { label: 'Usuários Sem SICAF', value: String(usuariosSemSicaf), change: calcChangePercent(usuariosSemSicafSemana, usuariosSemSicafSemanaAnterior), changeLabel: 'vs. semana passada' },
      { label: 'Certidões Vencidas', value: String(certidoesVencidas), change: calcChangePercent(certidoesVencidasMes, certidoesVencidasMesAnterior), changeLabel: 'vs. mês anterior' },
      {
        label: 'Receita Manutenções',
        value: formatCurrencyBR(receitaManutMes),
        receitaAtualPeriodo: legendaMesAtual,
        receitaAtualValor: formatCurrencyBR(receitaManutMes),
        receitaAnteriorPeriodo: legendaMesAnterior,
        receitaAnteriorValor: formatCurrencyBR(receitaManutMesAnterior),
        change: calcChangePercent(receitaManutMes, receitaManutMesAnterior),
        changeLabel: 'variação mês a mês',
      },
      {
        label: 'Receita SICAF (taxas pagas)',
        value: formatCurrencyBR(receitaSicafPagoMes),
        receitaAtualPeriodo: legendaMesAtual,
        receitaAtualValor: formatCurrencyBR(receitaSicafPagoMes),
        receitaAnteriorPeriodo: legendaMesAnterior,
        receitaAnteriorValor: formatCurrencyBR(receitaSicafPagoMesAnterior),
        change: calcChangePercent(receitaSicafPagoMes, receitaSicafPagoMesAnterior),
        changeLabel: 'variação mês a mês',
      },
      { label: 'Licitações Ativas', value: String(licitacoesAtivas), change: calcChangePercent(licitacoesSemana, licitacoesSemanaAnterior), changeLabel: 'novas esta semana' },
      { label: 'Tickets Abertos', value: String(ticketsAbertos), change: calcChangePercent(ticketsSemana, ticketsSemanaAnterior), changeLabel: 'vs. semana passada' },
    ],
    recentSicafRequests: recentSicafRows.map((row) => ({
      id: row.id,
      company: row.razao_social || row.nome_fantasia || 'Cliente sem nome',
      type: Number(row.credenciamento_anual || 0) === 1 ? 'Renovação' : 'Cadastro Novo',
      level: row.nivel ? `Nível ${row.nivel}` : 'Nível I',
      time: formatTimeBR(row.created_at),
      status: row.status || 'Pendente',
    })),
    maintenanceSummary: [
      { label: 'Ativas', value: manutAtivas, color: 'bg-emerald-500' },
      { label: 'Vencendo', value: manutVencendo, color: 'bg-amber-500' },
      { label: 'Vencidas', value: manutVencidas, color: 'bg-red-500' },
      { label: 'Canceladas', value: manutCanceladas, color: 'bg-muted-foreground' },
    ],
    usersWithoutSicaf: usersWithoutRows.map((row) => ({
      id: row.id,
      name: row.nome || row.razao_social || row.nome_fantasia || 'Usuário sem nome',
      company: row.razao_social || row.nome_fantasia || 'Empresa não informada',
      registeredAt: formatDateBR(row.created_at),
      email: row.email || '',
    })),
    usersWithoutSicafTotal: usuariosSemSicaf,
    financialOverview: [
      {
        label: 'Receita Manutenções',
        value: [
          `Atual · ${legendaMesAtual}: ${formatCurrencyBR(receitaManutMes)} · Anterior: ${formatCurrencyBR(receitaManutMesAnterior)}`,
          `Total: ${formatCurrencyBR(receitaManutTotal)}`,
        ].join('\n'),
      },
      {
        label: 'SICAF — taxas pagas',
        value: [
          `Atual · ${legendaMesAtual}: ${formatCurrencyBR(receitaSicafPagoMes)} · Anterior: ${formatCurrencyBR(receitaSicafPagoMesAnterior)}`,
          `Total: ${formatCurrencyBR(receitaSicafPagoTotal)}`,
        ].join('\n'),
      },
      { label: 'Taxas SICAF (mês)', value: formatCurrencyBR(taxasGeradas) },
      { label: 'Pendentes (manut + SICAF)', value: formatCurrencyBR(boletosPendentesManut + boletosPendentesSicaf) },
      { label: 'Inadimplência (manut + SICAF)', value: formatCurrencyBR(inadimplenciaManut + inadimplenciaSicaf) },
    ],
    activityLog: activityRows.map((row) => ({
      id: row.id,
      action: row.acao || row.descricao || 'Atividade registrada',
      user: row.usuario_nome || 'Sistema',
      target: row.entidade || '',
      time: formatTimeBR(row.created_at),
    })),
    executive: {
      faturamento: {
        hoje: faturamentoHoje,
        ontem: faturamentoOntem,
        mes: faturamentoMes,
        mesAnterior: faturamentoMesAnterior,
        changeHoje: calcChangePercent(faturamentoHoje, faturamentoOntem),
        changeMes: calcChangePercent(faturamentoMes, faturamentoMesAnterior),
        chart7d: faturamento7Dias,
        total7d: faturamento7Total,
      },
      novosClientes: {
        hoje: novosClientesHoje,
        ontem: novosClientesOntem,
        mes: novosClientesMes,
        pagos: novosClientesPagos,
        pendentes: Math.max(0, novosClientesMes - novosClientesPagos),
        changeHoje: calcChangePercent(novosClientesHoje, novosClientesOntem),
      },
      sicaf: {
        atualizados: sicafAtivos,
        meta: 150,
        pendentes: sicafPendentes,
        vencendo7d: sicafVencendo7d,
        amarelo: sicafNiveisAmarelo,
        vermelho: sicafNiveisVermelho,
      },
      tickets: {
        abertos: ticketsAbertos,
        foraSla: ticketsForaSla,
      },
      chamadasPendentes: {
        total: chamadasPendentes,
        changeOntem: calcChangePercent(chamadasPendentes, chamadasPendentesOntem),
      },
      googleAds: {
        conversao: conversaoGoogleAds,
        roas: roasGoogleAds,
        sessions: sessionsGads,
        converted: convertedGads,
      },
      boletosVencidos: {
        valor: inadimplenciaManut + inadimplenciaSicaf,
        clientes: clientesInadimplentes,
      },
      certidoesVencidas: {
        total: certidoesVencidas,
        changeSemana: certidoesVencidasSemana,
      },
      funil: funilData,
      alertas,
      palavras: palavrasRows.map((row) => ({
        palavra: row.palavra,
        clicks: toNumber(row.clicks),
        pagos: toNumber(row.pagos),
        receita: toNumber(row.receita),
      })),
      equipe: equipeRows.map((row) => ({
        nome: row.nome || 'Equipe',
        tickets: toNumber(row.tickets),
        sla: `${toNumber(row.sla_pct)}%`,
        mediaMin: toNumber(row.media_min),
      })),
    },
  };
}

module.exports = { getAdminDashboard };
