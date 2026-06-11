/**
 * Funil Comercial Admin — etapas com dados reais e insights de conversão.
 */
const { getDb } = require('../database/connection');

const TAXA_SICAF_PAGA_WHERE =
  "(LOWER(TRIM(CAST(t.status AS CHAR))) IN ('pago','paga','aprovado','aprovada','liberado','liberada','paid') OR t.status IN ('Pago','Paga','Aprovado','Aprovada','Liberado','Liberada'))";

const PG_PAGO_WHERE =
  "(LOWER(TRIM(CAST(p.status AS CHAR))) IN ('pago','paga','aprovado','aprovada','paid') OR p.status IN ('Pago','Paga','Aprovado','Aprovada'))";

const MANUTENCAO_ATIVA_WHERE =
  "(LOWER(TRIM(CAST(m.status AS CHAR))) IN ('ativo','a vencer','vencendo') OR m.status IN ('Ativo','A Vencer','Vencendo'))";

const ETAPA_CORES = [
  'from-blue-500 to-blue-600',
  'from-indigo-500 to-indigo-600',
  'from-rose-500 to-rose-600',
  'from-violet-500 to-violet-600',
  'from-fuchsia-500 to-fuchsia-600',
  'from-pink-500 to-pink-600',
  'from-amber-500 to-amber-600',
  'from-emerald-500 to-emerald-600',
];

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function aggregateNumber(row, preferredKey = 'total') {
  if (!row || typeof row !== 'object') return 0;
  const pref = row[preferredKey];
  if (pref !== undefined && pref !== null && pref !== '') return toNumber(pref);
  const keys = Object.keys(row);
  if (keys.length === 1) return toNumber(row[keys[0]]);
  return 0;
}

function sinceDate(days) {
  const d = Math.min(Math.max(parseInt(days, 10) || 90, 1), 365);
  const since = new Date();
  since.setDate(since.getDate() - d);
  return { days: d, sinceStr: since.toISOString().split('T')[0] };
}

async function safeQuery(fallback, fn) {
  try {
    return await fn();
  } catch (e) {
    console.warn('[AdminFunil] Consulta ignorada:', e.message);
    return fallback;
  }
}

async function hasTable(db, name) {
  return safeQuery(false, () => db.schema.hasTable(name));
}

/** Clientes com ao menos um pagamento quitado (taxa SICAF ou Gerencianet). */
async function fetchClienteIdsPagos(db) {
  const ids = new Set();
  const hasTaxas = await hasTable(db, 'taxas_sicaf');
  const hasPg = await hasTable(db, 'pagamentos_gerencianet');

  if (hasTaxas) {
    const rows = await safeQuery([], () =>
      db('taxas_sicaf as t')
        .whereRaw(TAXA_SICAF_PAGA_WHERE)
        .whereNotNull('t.cliente_id')
        .distinct('t.cliente_id')
        .select('t.cliente_id'),
    );
    rows.forEach((r) => {
      if (r.cliente_id) ids.add(r.cliente_id);
    });
  }

  if (hasPg) {
    const rows = await safeQuery([], () =>
      db('pagamentos_gerencianet as p')
        .whereRaw(PG_PAGO_WHERE)
        .whereNotNull('p.cliente_id')
        .distinct('p.cliente_id')
        .select('p.cliente_id'),
    );
    rows.forEach((r) => {
      if (r.cliente_id) ids.add(r.cliente_id);
    });
  }

  return ids;
}

function buildEtapas(metrics) {
  const naoPagou = Math.max(0, metrics.cadastros - metrics.pagou);
  const raw = [
    { nome: 'Visitou site', v: metrics.visitou, perda: false },
    { nome: 'Criou cadastro', v: metrics.cadastros, perda: false },
    { nome: 'Não pagou', v: naoPagou, perda: true },
    { nome: 'Pagou', v: metrics.pagou, perda: false },
    { nome: 'Enviou documentos', v: metrics.documentos, perda: false },
    { nome: 'Atualizou SICAF', v: metrics.sicafOk, perda: false },
    { nome: 'Entrou em manutenção', v: metrics.manutencao, perda: false },
    { nome: 'Renovou', v: metrics.renovou, perda: false },
  ];

  return raw.map((e, i) => {
    const prev = i > 0 ? raw[i - 1] : null;
    const convAnterior = prev && prev.v > 0 ? Math.round((e.v / prev.v) * 1000) / 10 : null;
    return {
      ...e,
      color: ETAPA_CORES[i] || ETAPA_CORES[0],
      convAnterior,
      pctDoTopo: metrics.visitou > 0 ? Math.round((e.v / metrics.visitou) * 1000) / 10 : 0,
    };
  });
}

function buildInsights(etapas, tempoMedioDias) {
  let maiorPerda = { nome: '—', pct: 0 };
  for (let i = 1; i < etapas.length; i++) {
    const prev = etapas[i - 1];
    const cur = etapas[i];
    if (prev.perda) continue;
    if (cur.perda && prev.v > 0) {
      const pct = Math.round((cur.v / prev.v) * 1000) / 10;
      if (pct > maiorPerda.pct) maiorPerda = { nome: cur.nome, pct };
    } else if (!cur.perda && prev.v > cur.v && prev.v > 0) {
      const queda = Math.round(((prev.v - cur.v) / prev.v) * 1000) / 10;
      if (queda > maiorPerda.pct) maiorPerda = { nome: `${prev.nome} → ${cur.nome}`, pct: queda };
    }
  }

  const topo = etapas[0]?.v || 0;
  const renovou = etapas[etapas.length - 1]?.v || 0;
  const conversaoFinal = topo > 0 ? Math.round((renovou / topo) * 1000) / 10 : 0;

  return [
    {
      label: 'Maior perda',
      value: maiorPerda.nome,
      valor: maiorPerda.pct > 0 ? `${maiorPerda.pct.toLocaleString('pt-BR')}%` : '—',
      tone: 'rose',
    },
    {
      label: 'Conversão final',
      value: 'Visitante → Renovação',
      valor: `${conversaoFinal.toLocaleString('pt-BR')}%`,
      tone: 'emerald',
    },
    {
      label: 'Tempo médio de conversão',
      value: 'Pagou → SICAF OK',
      valor: tempoMedioDias != null ? `${tempoMedioDias} dias` : '—',
      tone: 'violet',
    },
  ];
}

async function getAdminFunil(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const { days, sinceStr } = sinceDate(opts.days);

  const [hasTracking, hasClientes, hasUsuarios, hasDocumentos, hasSicaf, hasManutencoes, hasTaxas] =
    await Promise.all([
      hasTable(db, 'tracking_sessoes'),
      hasTable(db, 'clientes'),
      hasTable(db, 'usuarios'),
      hasTable(db, 'documentos'),
      hasTable(db, 'sicaf_cadastros'),
      hasTable(db, 'manutencoes'),
      hasTable(db, 'taxas_sicaf'),
    ]);

  const trackingVisitas = hasTracking
    ? await safeQuery(0, () =>
        db('tracking_sessoes')
          .where('created_at', '>=', sinceStr)
          .count({ total: '*' })
          .first()
          .then((r) => aggregateNumber(r, 'total')),
      )
    : 0;

  const cadastros = hasClientes
    ? await safeQuery(0, () =>
        db('clientes')
          .where('created_at', '>=', sinceStr)
          .count({ total: '*' })
          .first()
          .then((r) => aggregateNumber(r, 'total')),
      )
    : hasUsuarios
      ? await safeQuery(0, () =>
          db('usuarios')
            .where('created_at', '>=', sinceStr)
            .count({ total: '*' })
            .first()
            .then((r) => aggregateNumber(r, 'total')),
        )
      : 0;

  // Topo do funil: sessões rastreadas; se tracking for menor que cadastros, usa cadastros como piso.
  const visitou = Math.max(trackingVisitas, cadastros);

  const pagosIds = await fetchClienteIdsPagos(db);
  const pagosArr = pagosIds.size ? Array.from(pagosIds) : [];

  const cohortBase = () => {
    if (!hasClientes) return null;
    return db('clientes as c').where('c.created_at', '>=', sinceStr);
  };

  let pagou = 0;
  if (cohortBase() && pagosArr.length) {
    pagou = await safeQuery(0, () =>
      cohortBase()
        .whereIn('c.id', pagosArr)
        .count({ total: '*' })
        .first()
        .then((r) => aggregateNumber(r, 'total')),
    );
  }

  let documentos = 0;
  if (cohortBase() && hasDocumentos && pagosArr.length) {
    documentos = await safeQuery(0, () =>
      cohortBase()
        .whereIn('c.id', pagosArr)
        .innerJoin('documentos as d', 'd.cliente_id', 'c.id')
        .whereNull('d.deleted_at')
        .countDistinct({ total: 'c.id' })
        .first()
        .then((r) => aggregateNumber(r, 'total')),
    );
  }

  let sicafOk = 0;
  if (cohortBase() && hasSicaf && pagosArr.length) {
    sicafOk = await safeQuery(0, () =>
      cohortBase()
        .whereIn('c.id', pagosArr)
        .innerJoin('sicaf_cadastros as s', 's.cliente_id', 'c.id')
        .where(function () {
          this.where('s.status', 'Ativo').orWhereRaw(
            's.data_validade IS NOT NULL AND DATE(s.data_validade) >= CURDATE()',
          );
        })
        .countDistinct({ total: 'c.id' })
        .first()
        .then((r) => aggregateNumber(r, 'total')),
    );
  }

  let manutencao = 0;
  if (cohortBase() && hasManutencoes && pagosArr.length) {
    manutencao = await safeQuery(0, () =>
      cohortBase()
        .whereIn('c.id', pagosArr)
        .innerJoin('manutencoes as m', 'm.cliente_id', 'c.id')
        .whereRaw(MANUTENCAO_ATIVA_WHERE)
        .countDistinct({ total: 'c.id' })
        .first()
        .then((r) => aggregateNumber(r, 'total')),
    );
  }

  let renovou = 0;
  if (cohortBase() && hasSicaf && pagosArr.length) {
    renovou = await safeQuery(0, () =>
      cohortBase()
        .whereIn('c.id', pagosArr)
        .innerJoin('sicaf_cadastros as s', 's.cliente_id', 'c.id')
        .where('s.credenciamento_anual', 1)
        .countDistinct({ total: 'c.id' })
        .first()
        .then((r) => aggregateNumber(r, 'total')),
    );
  }

  // Garantir monotonia descendente nas etapas pós-pagamento
  documentos = Math.min(documentos, pagou);
  sicafOk = Math.min(sicafOk, pagou);
  manutencao = Math.min(manutencao, sicafOk);
  renovou = Math.min(renovou, sicafOk);

  let tempoMedioDias = null;
  if (hasClientes && hasTaxas) {
    const tempoRow = await safeQuery(null, () =>
      db.raw(
        `
        SELECT ROUND(AVG(DATEDIFF(sicaf_ok.em, primeiro_pago.em)), 0) AS media_dias
        FROM (
          SELECT t.cliente_id,
                 MIN(COALESCE(t.data_pagamento, t.created_at)) AS em
          FROM taxas_sicaf t
          WHERE ${TAXA_SICAF_PAGA_WHERE}
            AND COALESCE(t.data_pagamento, t.created_at) >= ?
          GROUP BY t.cliente_id
        ) AS primeiro_pago
        INNER JOIN clientes c ON c.id = primeiro_pago.cliente_id AND c.created_at >= ?
        INNER JOIN (
          SELECT s.cliente_id,
                 MIN(COALESCE(s.data_ultima_atualizacao, s.updated_at, s.created_at)) AS em
          FROM sicaf_cadastros s
          WHERE s.status = 'Ativo'
             OR (s.data_validade IS NOT NULL AND DATE(s.data_validade) >= CURDATE())
          GROUP BY s.cliente_id
        ) AS sicaf_ok ON sicaf_ok.cliente_id = primeiro_pago.cliente_id
        WHERE sicaf_ok.em >= primeiro_pago.em
        `,
        [sinceStr, sinceStr],
      ).then((r) => r[0]?.[0]),
    );
    if (tempoRow?.media_dias != null) tempoMedioDias = toNumber(tempoRow.media_dias);
  }

  const metrics = {
    visitou,
    cadastros,
    pagou,
    documentos,
    sicafOk,
    manutencao,
    renovou,
  };

  const etapas = buildEtapas(metrics);
  const insights = buildInsights(etapas, tempoMedioDias);

  return {
    ok: true,
    periodo: { days, since: sinceStr },
    etapas,
    insights,
    resumo: {
      taxaCadastro: visitou > 0 ? Math.round((cadastros / visitou) * 1000) / 10 : 0,
      taxaPagamento: cadastros > 0 ? Math.round((pagou / cadastros) * 1000) / 10 : 0,
      taxaSicaf: pagou > 0 ? Math.round((sicafOk / pagou) * 1000) / 10 : 0,
      sessoesRastreadas: trackingVisitas,
    },
  };
}

module.exports = { getAdminFunil };
