/**
 * Google Ads Intelligence Admin — palavras-chave com pagamentos reais validados.
 */
const { getDb } = require('../database/connection');
const { fixMojibake } = require('../utils/text-encoding');

const TAXA_SICAF_PAGA_WHERE =
  "(LOWER(TRIM(CAST(t.status AS CHAR))) IN ('pago','paga','aprovado','aprovada','liberado','liberada','paid') OR t.status IN ('Pago','Paga','Aprovado','Aprovada','Liberado','Liberada'))";

const PG_PAGO_WHERE =
  "(LOWER(TRIM(CAST(p.status AS CHAR))) IN ('pago','paga','aprovado','aprovada','paid') OR p.status IN ('Pago','Paga','Aprovado','Aprovada'))";

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

function formatCurrencyBR(value) {
  return toNumber(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sinceDate(days) {
  const d = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
  const since = new Date();
  since.setDate(since.getDate() - d);
  return { days: d, sinceStr: since.toISOString().split('T')[0] };
}

function googleAdsFilter(qb) {
  qb.where(function () {
    this.whereNotNull('ts.gclid').where('ts.gclid', '!=', '').orWhereRaw("LOWER(TRIM(ts.utm_source)) = 'google'");
  });
}

async function safeQuery(fallback, fn) {
  try {
    return await fn();
  } catch (e) {
    console.warn('[AdminGoogleAds] Consulta ignorada:', e.message);
    return fallback;
  }
}

async function hasTable(db, name) {
  return safeQuery(false, () => db.schema.hasTable(name));
}

async function fetchInvestimento(db, sinceStr) {
  const hasCamp = await hasTable(db, 'google_ads_campanhas');
  if (!hasCamp) return 0;

  const rows = await safeQuery([], () =>
    db('google_ads_campanhas')
      .where(function () {
        this.whereNull('sincronizado_em').orWhere('sincronizado_em', '>=', sinceStr);
      })
      .select('metricas_json', 'orcamento_diario', 'inicio', 'fim'),
  );

  let total = 0;
  for (const row of rows) {
    let metrics = row.metricas_json;
    if (typeof metrics === 'string') {
      try {
        metrics = JSON.parse(metrics);
      } catch {
        metrics = null;
      }
    }
    if (metrics && metrics.custo != null) total += toNumber(metrics.custo);
    else if (metrics && metrics.cost != null) total += toNumber(metrics.cost);
    else if (row.orcamento_diario) total += toNumber(row.orcamento_diario) * 30;
  }
  return total;
}

async function fetchPalavrasValidadas(db, sinceStr) {
  const keywordRows = await safeQuery([], () => {
    const q = db('tracking_sessoes as ts')
      .where('ts.created_at', '>=', sinceStr)
      .whereNotNull('ts.utm_term')
      .where('ts.utm_term', '!=', '');
    googleAdsFilter(q);
    return q
      .groupByRaw('LOWER(TRIM(ts.utm_term))')
      .select(
        db.raw('LOWER(TRIM(ts.utm_term)) as palavra'),
        db.raw('COUNT(*) as clicks'),
        db.raw('COUNT(DISTINCT ts.cliente_id) as cadastros'),
        db.raw('COUNT(DISTINCT ts.usuario_id) as usuarios'),
        db.raw('SUM(CASE WHEN ts.converted = 1 THEN 1 ELSE 0 END) as conversoes_tracking'),
      )
      .orderBy('clicks', 'desc')
      .limit(100);
  });

  const pagosRows = await safeQuery([], async () => {
    const hasPg = await hasTable(db, 'pagamentos_gerencianet');
    const hasTaxa = await hasTable(db, 'taxas_sicaf');
    if (!hasPg && !hasTaxa) return [];

    const unions = [];
    const bindings = [];

    if (hasPg) {
      unions.push(`
        SELECT DISTINCT
          LOWER(TRIM(ts.utm_term)) AS palavra,
          ts.cliente_id,
          CONCAT('pg:', p.id) AS pagamento_key,
          COALESCE(p.valor, 0) AS valor_pago
        FROM tracking_sessoes ts
        INNER JOIN pagamentos_gerencianet p ON p.cliente_id = ts.cliente_id
          AND COALESCE(p.data_pagamento, p.updated_at, p.created_at) >= ?
          AND ${PG_PAGO_WHERE}
        WHERE ts.created_at >= ?
          AND ts.utm_term IS NOT NULL AND TRIM(ts.utm_term) <> ''
          AND ts.cliente_id IS NOT NULL
          AND (ts.gclid IS NOT NULL AND TRIM(ts.gclid) <> '' OR LOWER(TRIM(ts.utm_source)) = 'google')
      `);
      bindings.push(sinceStr, sinceStr);
    }

    if (hasTaxa) {
      unions.push(`
        SELECT DISTINCT
          LOWER(TRIM(ts.utm_term)) AS palavra,
          ts.cliente_id,
          CONCAT('tx:', t.id) AS pagamento_key,
          COALESCE(t.valor, 0) AS valor_pago
        FROM tracking_sessoes ts
        INNER JOIN taxas_sicaf t ON t.cliente_id = ts.cliente_id
          AND COALESCE(t.data_pagamento, t.created_at) >= ?
          AND ${TAXA_SICAF_PAGA_WHERE}
        WHERE ts.created_at >= ?
          AND ts.utm_term IS NOT NULL AND TRIM(ts.utm_term) <> ''
          AND ts.cliente_id IS NOT NULL
          AND (ts.gclid IS NOT NULL AND TRIM(ts.gclid) <> '' OR LOWER(TRIM(ts.utm_source)) = 'google')
      `);
      bindings.push(sinceStr, sinceStr);
    }

    if (!unions.length) return [];

    const sql = `
      SELECT palavra,
             COUNT(DISTINCT cliente_id) AS pagos,
             COUNT(DISTINCT pagamento_key) AS qtd_pagamentos,
             COALESCE(SUM(valor_pago), 0) AS receita
      FROM (${unions.join(' UNION ALL ')}) AS pagos_attr
      GROUP BY palavra
    `;
    const raw = await db.raw(sql, bindings);
    return raw[0] || [];
  });

  const pagosMap = Object.fromEntries(
    pagosRows.map((r) => [
      String(r.palavra || '').toLowerCase().trim(),
      {
        pagos: toNumber(r.pagos),
        qtdPagamentos: toNumber(r.qtd_pagamentos),
        receita: toNumber(r.receita),
      },
    ]),
  );

  return keywordRows.map((row) => {
    const palavra = fixMojibake(String(row.palavra || '').trim());
    const key = palavra.toLowerCase();
    const pago = pagosMap[key] || { pagos: 0, qtdPagamentos: 0, receita: 0 };
    const clicks = toNumber(row.clicks);
    const cadastros = Math.max(toNumber(row.cadastros), toNumber(row.usuarios));
    const pagos = pago.pagos;
    const receita = pago.receita;

    return {
      palavra,
      clicks,
      cadastros,
      pagos,
      pagosValidados: pagos > 0,
      qtdPagamentos: pago.qtdPagamentos,
      conversoesTracking: toNumber(row.conversoes_tracking),
      receita,
      receitaFormatada: formatCurrencyBR(receita),
    };
  });
}

async function fetchClientesPorPalavra(db, sinceStr, palavra) {
  if (!palavra?.trim()) return [];

  const term = palavra.trim().toLowerCase();
  const links = await safeQuery([], () =>
    db('tracking_sessoes as ts')
      .innerJoin('clientes as c', 'ts.cliente_id', 'c.id')
      .where('ts.created_at', '>=', sinceStr)
      .whereRaw('LOWER(TRIM(ts.utm_term)) = ?', [term])
      .modify((qb) => googleAdsFilter(qb))
      .groupBy('ts.cliente_id', 'c.razao_social', 'c.nome_fantasia', 'c.documento')
      .select(
        'ts.cliente_id',
        'c.razao_social',
        'c.nome_fantasia',
        'c.documento',
        db.raw('COUNT(*) as sessoes'),
        db.raw('MAX(ts.created_at) as ultima_sessao'),
      )
      .orderBy('sessoes', 'desc')
      .limit(50),
  );

  const clienteIds = links.map((l) => l.cliente_id).filter(Boolean);
  const pagosSet = new Set();

  if (clienteIds.length) {
    const hasPg = await hasTable(db, 'pagamentos_gerencianet');
    const hasTaxa = await hasTable(db, 'taxas_sicaf');

    if (hasPg) {
      const pg = await db('pagamentos_gerencianet')
        .whereIn('cliente_id', clienteIds)
        .whereRaw(PG_PAGO_WHERE)
        .where('created_at', '>=', sinceStr)
        .distinct('cliente_id')
        .select('cliente_id');
      pg.forEach((r) => pagosSet.add(r.cliente_id));
    }
    if (hasTaxa) {
      const tx = await db('taxas_sicaf as t')
        .whereIn('t.cliente_id', clienteIds)
        .whereRaw(TAXA_SICAF_PAGA_WHERE)
        .whereRaw('COALESCE(t.data_pagamento, t.created_at) >= ?', [sinceStr])
        .distinct('t.cliente_id')
        .select('t.cliente_id');
      tx.forEach((r) => pagosSet.add(r.cliente_id));
    }
  }

  return links.map((row) => ({
    clienteId: row.cliente_id,
    nome: fixMojibake(row.razao_social || row.nome_fantasia || 'Cliente'),
    documento: row.documento,
    sessoes: toNumber(row.sessoes),
    ultimaSessao: row.ultima_sessao,
    comprou: pagosSet.has(row.cliente_id),
  }));
}

async function fetchPagosDetalhePorPalavra(db, sinceStr, palavra) {
  if (!palavra?.trim()) {
    return {
      clientes: [],
      resumo: { totalClientes: 0, totalPagamentos: 0, totalValor: 0, totalValorFormatado: formatCurrencyBR(0) },
    };
  }

  const term = palavra.trim().toLowerCase();
  const sessoes = await safeQuery([], () =>
    db('tracking_sessoes as ts')
      .where('ts.created_at', '>=', sinceStr)
      .whereRaw('LOWER(TRIM(ts.utm_term)) = ?', [term])
      .modify((qb) => googleAdsFilter(qb))
      .whereNotNull('ts.cliente_id')
      .groupBy('ts.cliente_id')
      .select(
        'ts.cliente_id',
        db.raw('COUNT(*) as sessoes'),
        db.raw('MIN(ts.created_at) as primeira_sessao'),
        db.raw('MAX(ts.created_at) as ultima_sessao'),
      ),
  );

  const clienteIds = sessoes.map((s) => s.cliente_id).filter(Boolean);
  if (!clienteIds.length) {
    return {
      clientes: [],
      resumo: { totalClientes: 0, totalPagamentos: 0, totalValor: 0, totalValorFormatado: formatCurrencyBR(0) },
    };
  }

  const sessoesMap = Object.fromEntries(sessoes.map((s) => [s.cliente_id, s]));
  const clientesRows = await safeQuery([], () =>
    db('clientes')
      .whereIn('id', clienteIds)
      .select('id', 'razao_social', 'nome_fantasia', 'documento', 'email', 'telefone', 'created_at'),
  );

  const pagamentos = [];
  const hasPg = await hasTable(db, 'pagamentos_gerencianet');
  const hasTaxa = await hasTable(db, 'taxas_sicaf');

  if (hasPg) {
    const pgRows = await safeQuery([], () =>
      db('pagamentos_gerencianet as p')
        .whereIn('p.cliente_id', clienteIds)
        .whereRaw(PG_PAGO_WHERE)
        .whereRaw('COALESCE(p.data_pagamento, p.updated_at, p.created_at) >= ?', [sinceStr])
        .select(
          'p.id',
          'p.cliente_id',
          'p.valor',
          'p.status',
          'p.data_pagamento',
          'p.created_at',
          'p.updated_at',
          'p.tipo',
          'p.descricao',
        ),
    );
    for (const r of pgRows) {
      pagamentos.push({
        id: `pg-${r.id}`,
        clienteId: r.cliente_id,
        origem: 'gerencianet',
        origemLabel: 'Gerencianet',
        valor: toNumber(r.valor),
        dataPagamento: r.data_pagamento || r.updated_at || r.created_at,
        status: r.status,
        descricao: r.descricao || r.tipo || 'Pagamento',
        forma: r.tipo || null,
      });
    }
  }

  if (hasTaxa) {
    const txRows = await safeQuery([], () =>
      db('taxas_sicaf as t')
        .whereIn('t.cliente_id', clienteIds)
        .whereRaw(TAXA_SICAF_PAGA_WHERE)
        .whereRaw('COALESCE(t.data_pagamento, t.created_at) >= ?', [sinceStr])
        .select(
          't.id',
          't.cliente_id',
          't.valor',
          't.status',
          't.data_pagamento',
          't.created_at',
          't.descricao',
          't.ano_referencia',
          't.forma_pagamento',
        ),
    );
    for (const r of txRows) {
      pagamentos.push({
        id: `tx-${r.id}`,
        clienteId: r.cliente_id,
        origem: 'sicaf',
        origemLabel: 'Taxa SICAF',
        valor: toNumber(r.valor),
        dataPagamento: r.data_pagamento || r.created_at,
        status: r.status,
        descricao: r.descricao || (r.ano_referencia ? `Taxa SICAF ${r.ano_referencia}` : 'Taxa SICAF'),
        forma: r.forma_pagamento || null,
      });
    }
  }

  const byCliente = new Map();
  for (const p of pagamentos) {
    if (!byCliente.has(p.clienteId)) byCliente.set(p.clienteId, []);
    byCliente.get(p.clienteId).push(p);
  }

  const clientes = [];
  for (const c of clientesRows) {
    const pays = byCliente.get(c.id);
    if (!pays?.length) continue;

    const sess = sessoesMap[c.id];
    const valorTotal = pays.reduce((s, p) => s + p.valor, 0);
    const datas = pays
      .map((p) => new Date(p.dataPagamento))
      .filter((d) => !Number.isNaN(d.getTime()));
    const primeiroPagamento = datas.length
      ? new Date(Math.min(...datas.map((d) => d.getTime()))).toISOString()
      : null;
    const ultimoPagamento = datas.length
      ? new Date(Math.max(...datas.map((d) => d.getTime()))).toISOString()
      : null;

    let diasAtePagar = null;
    if (sess?.primeira_sessao && primeiroPagamento) {
      const diff = new Date(primeiroPagamento).getTime() - new Date(sess.primeira_sessao).getTime();
      diasAtePagar = Math.max(0, Math.ceil(diff / 86400000));
    }

    clientes.push({
      clienteId: c.id,
      nome: fixMojibake(c.razao_social || c.nome_fantasia || 'Cliente'),
      documento: c.documento,
      email: c.email || null,
      telefone: c.telefone || null,
      cadastroEm: c.created_at,
      sessoes: toNumber(sess?.sessoes),
      primeiraSessao: sess?.primeira_sessao || null,
      ultimaSessao: sess?.ultima_sessao || null,
      pagamentos: pays.sort(
        (a, b) => new Date(b.dataPagamento).getTime() - new Date(a.dataPagamento).getTime(),
      ),
      valorTotal,
      valorTotalFormatado: formatCurrencyBR(valorTotal),
      qtdPagamentos: pays.length,
      primeiroPagamento,
      ultimoPagamento,
      diasAtePagar,
    });
  }

  clientes.sort((a, b) => b.valorTotal - a.valorTotal);
  const totalValor = clientes.reduce((s, c) => s + c.valorTotal, 0);

  return {
    clientes,
    resumo: {
      totalClientes: clientes.length,
      totalPagamentos: pagamentos.length,
      totalValor,
      totalValorFormatado: formatCurrencyBR(totalValor),
    },
  };
}

function enrichPalavrasMetrics(palavras, investimento) {
  const totalReceita = palavras.reduce((s, p) => s + p.receita, 0);
  const totalPagos = palavras.reduce((s, p) => s + p.pagos, 0);
  const invest = toNumber(investimento);

  return palavras.map((p) => {
    const share = totalReceita > 0 ? p.receita / totalReceita : 0;
    const investPalavra = invest > 0 ? invest * share : 0;
    const roas = investPalavra > 0 ? Math.round((p.receita / investPalavra) * 10) / 10 : null;
    const cpa = p.pagos > 0 && investPalavra > 0 ? Math.round(investPalavra / p.pagos) : null;

    return {
      ...p,
      investimentoEstimado: Math.round(investPalavra),
      roas,
      cpa,
      fat: Math.round(p.receita),
    };
  });
}

async function getAdminGoogleAds(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const hasTracking = await hasTable(db, 'tracking_sessoes');
  if (!hasTracking) {
    return { ok: true, periodo: sinceDate(opts.days), kpis: {}, palavras: [], clientesPorPalavra: [] };
  }

  const { days, sinceStr } = sinceDate(opts.days);
  const palavraDetalhe = String(opts.palavra || '').trim();
  const somentePagos =
    opts.pagos === true || opts.pagos === 1 || opts.pagos === '1' || opts.pagos === 'true';

  if (palavraDetalhe && somentePagos) {
    const pagosDetalhe = await fetchPagosDetalhePorPalavra(db, sinceStr, palavraDetalhe);
    return {
      ok: true,
      periodo: { days, since: sinceStr },
      palavra: palavraDetalhe,
      pagosDetalhe,
    };
  }

  const [totalsRow, investimento, palavrasBase, clientesPorPalavra] = await Promise.all([
    safeQuery({}, () => {
      const q = db('tracking_sessoes as ts').where('ts.created_at', '>=', sinceStr);
      googleAdsFilter(q);
      return q
        .select(
          db.raw('COUNT(*) as clicks'),
          db.raw('COUNT(DISTINCT ts.cliente_id) as cadastros'),
          db.raw('SUM(CASE WHEN ts.converted = 1 THEN 1 ELSE 0 END) as conversoes_tracking'),
        )
        .first();
    }),
    fetchInvestimento(db, sinceStr),
    fetchPalavrasValidadas(db, sinceStr),
    palavraDetalhe ? fetchClientesPorPalavra(db, sinceStr, palavraDetalhe) : Promise.resolve([]),
  ]);

  const palavras = enrichPalavrasMetrics(palavrasBase, investimento);
  const receitaTotal = palavras.reduce((s, p) => s + p.receita, 0);
  const pagosTotal = palavras.reduce((s, p) => s + p.pagos, 0);
  const clicksTotal = aggregateNumber(totalsRow, 'clicks');
  const cadastrosTotal = aggregateNumber(totalsRow, 'cadastros');
  const roasMedio =
    investimento > 0 && receitaTotal > 0 ? Math.round((receitaTotal / investimento) * 10) / 10 : null;

  return {
    ok: true,
    periodo: { days, since: sinceStr },
    kpis: {
      investimento: Math.round(investimento),
      investimentoFormatado: formatCurrencyBR(investimento),
      clicks: clicksTotal,
      cadastros: cadastrosTotal,
      pagos: pagosTotal,
      receita: Math.round(receitaTotal),
      receitaFormatada: formatCurrencyBR(receitaTotal),
      roasMedio,
      conversoesTracking: aggregateNumber(totalsRow, 'conversoes_tracking'),
    },
    palavras,
    clientesPorPalavra,
    notas: [
      'Pagos = clientes com taxa SICAF ou pagamento Gerencianet quitado no período, atribuídos à palavra-chave da sessão Google Ads.',
      'Receita = soma dos pagamentos reais desses clientes (não usa apenas o flag converted do tracking).',
      investimento > 0
        ? 'ROAS/CPA usam investimento das campanhas sincronizadas em google_ads_campanhas.'
        : 'Investimento não sincronizado — ROAS/CPA exibidos por palavra só quando houver custo em campanhas.',
    ],
  };
}

module.exports = { getAdminGoogleAds };
