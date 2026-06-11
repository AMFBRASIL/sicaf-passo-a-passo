/**
 * Painel Financeiro Admin — KPIs, gráficos e movimentos com dados reais.
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
  const keys = Object.keys(row);
  if (keys.length === 1) return toNumber(row[keys[0]]);
  return 0;
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
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function isToday(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isYesterday(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
}

function formatDataMovimento(row) {
  const ref = row.data_pagamento || row.data_vencimento || row.created_at;
  if (!ref) return '—';
  if (row.statusUi === 'Recebido') {
    if (isToday(ref)) return `Hoje ${formatTimeBR(ref)}`;
    if (isYesterday(ref)) return `Ontem ${formatTimeBR(ref)}`;
    return formatDateBR(ref);
  }
  if (row.statusUi === 'Aguardando' || row.statusUi === 'Vencido') {
    if (row.data_vencimento) return `Vence ${formatDateBR(row.data_vencimento)}`;
    return formatDateBR(row.created_at);
  }
  return formatDateBR(ref);
}

function mapTipoMeio(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'pix') return 'PIX';
  if (t === 'cartao' || t === 'cartão') return 'Cartão';
  if (t === 'boleto') return 'Boleto';
  if (t === 'transferencia' || t === 'transferência') return 'Transferência';
  return 'Outro';
}

function mapStatusUi(status, dataVencimento) {
  const s = String(status || '').toLowerCase();
  if (['pago', 'paga', 'aprovado', 'aprovada', 'paid', 'quitado'].includes(s)) return 'Recebido';
  if (['estornado', 'estornada', 'refunded'].includes(s)) return 'Estornado';
  if (['cancelado', 'cancelada', 'expirado', 'erro'].includes(s)) return 'Vencido';
  if (dataVencimento) {
    const venc = new Date(dataVencimento);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    venc.setHours(0, 0, 0, 0);
    if (!Number.isNaN(venc.getTime()) && venc < hoje) return 'Vencido';
  }
  return 'Aguardando';
}

const RECEITA_MANUT_PAGO_WHERE =
  "(LOWER(TRIM(CAST(manutencao_boletos.status AS CHAR))) IN ('pago','aprovado') OR manutencao_boletos.status IN ('Pago','pago','Aprovado','aprovado'))";
const RECEITA_MANUT_REF_DIA =
  'DATE(COALESCE(manutencao_boletos.data_pagamento, manutencao_boletos.data_vencimento, manutencao_boletos.created_at))';

const RECEITA_SICAF_PAGO_WHERE =
  "(LOWER(TRIM(CAST(taxas_sicaf.status AS CHAR))) IN ('pago','paga','aprovado','aprovada') OR taxas_sicaf.status IN ('Pago','Paga','pago','paga','Aprovado','Aprovada','aprovado','aprovada'))";
const RECEITA_SICAF_REF_DIA = 'DATE(COALESCE(taxas_sicaf.data_pagamento, taxas_sicaf.created_at))';

const PAGO_PAGAMENTOS_WHERE =
  "(LOWER(TRIM(CAST(p.status AS CHAR))) IN ('pago','paga','aprovado','aprovada','paid') OR p.status IN ('pago','Pago','paga','Paga'))";
const REF_PAGAMENTO_DIA = 'DATE(COALESCE(p.data_pagamento, p.updated_at, p.created_at))';

async function safeQuery(fallback, fn) {
  try {
    return await fn();
  } catch (e) {
    console.warn('[AdminFinanceiro] Consulta ignorada:', e.message);
    return fallback;
  }
}

async function hasTable(db, name) {
  return safeQuery(false, () => db.schema.hasTable(name));
}

async function scalar(db, queryFn, key = 'total') {
  const row = await safeQuery(null, queryFn);
  return row ? aggregateNumber(row, key) : 0;
}

async function loadPagamentosRows(db, limit = 80) {
  const rows = [];

  const mapRow = (p, clienteNome) => ({
    id: p.id,
    cliente: clienteNome || p.cliente_nome || 'Cliente não informado',
    tipo: mapTipoMeio(p.tipo),
    valor: toNumber(p.valor),
    status: p.status,
    statusUi: mapStatusUi(p.status, p.data_vencimento),
    data_pagamento: p.data_pagamento,
    data_vencimento: p.data_vencimento,
    created_at: p.created_at,
    origem: p.origem,
    descricao: p.descricao,
  });

  if (await hasTable(db, 'pagamentos')) {
    const pg = await safeQuery([], () =>
      db('pagamentos as p')
        .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
        .whereNull('p.deleted_at')
        .select(
          'p.id',
          'p.cliente_id',
          'p.origem',
          'p.tipo',
          'p.valor',
          'p.descricao',
          'p.status',
          'p.data_vencimento',
          'p.data_pagamento',
          'p.created_at',
          'p.cliente_nome',
          'c.razao_social',
          'c.nome_fantasia',
        )
        .orderBy('p.updated_at', 'desc')
        .limit(limit),
    );
    for (const p of pg) {
      rows.push(mapRow(p, p.razao_social || p.nome_fantasia));
    }
  }

  if (rows.length === 0 && (await hasTable(db, 'pagamentos_gerencianet'))) {
    const gn = await safeQuery([], () =>
      db('pagamentos_gerencianet as p')
        .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
        .select(
          'p.id',
          'p.cliente_id',
          'p.origem',
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
        .limit(limit),
    );
    for (const p of gn) {
      rows.push(mapRow({ ...p, cliente_nome: null }, p.razao_social || p.nome_fantasia));
    }
  }

  return rows;
}

async function getAdminFinanceiro() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const [hasPagamentosTable, hasPagamentosGn, hasManutBoletos, hasTaxas, hasManutencoes, hasSicaf] =
    await Promise.all([
      hasTable(db, 'pagamentos'),
      hasTable(db, 'pagamentos_gerencianet'),
      hasTable(db, 'manutencao_boletos'),
      hasTable(db, 'taxas_sicaf'),
      hasTable(db, 'manutencoes'),
      hasTable(db, 'sicaf_cadastros'),
    ]);
  const hasPagamentos = hasPagamentosTable || hasPagamentosGn;

  const receitaManutPagoWhere = (q) => q.whereRaw(RECEITA_MANUT_PAGO_WHERE);
  const receitaSicafPagoWhere = (q) => q.whereRaw(RECEITA_SICAF_PAGO_WHERE);

  const receitaManutHoje = hasManutBoletos
    ? await scalar(db, () =>
        receitaManutPagoWhere(db('manutencao_boletos'))
          .whereRaw(`${RECEITA_MANUT_REF_DIA} = CURDATE()`)
          .sum({ total: 'valor' })
          .first(),
      )
    : 0;
  const receitaManutOntem = hasManutBoletos
    ? await scalar(db, () =>
        receitaManutPagoWhere(db('manutencao_boletos'))
          .whereRaw(`${RECEITA_MANUT_REF_DIA} = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`)
          .sum({ total: 'valor' })
          .first(),
      )
    : 0;
  const receitaManutMes = hasManutBoletos
    ? await scalar(db, () =>
        receitaManutPagoWhere(db('manutencao_boletos'))
          .whereRaw(`${RECEITA_MANUT_REF_DIA} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
          .whereRaw(`${RECEITA_MANUT_REF_DIA} < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`)
          .sum({ total: 'valor' })
          .first(),
      )
    : 0;
  const receitaManutMesAnterior = hasManutBoletos
    ? await scalar(db, () =>
        receitaManutPagoWhere(db('manutencao_boletos'))
          .whereRaw(`${RECEITA_MANUT_REF_DIA} >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')`)
          .whereRaw(`${RECEITA_MANUT_REF_DIA} < DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
          .sum({ total: 'valor' })
          .first(),
      )
    : 0;

  const receitaSicafHoje = hasTaxas
    ? await scalar(db, () =>
        receitaSicafPagoWhere(db('taxas_sicaf'))
          .whereRaw(`${RECEITA_SICAF_REF_DIA} = CURDATE()`)
          .sum({ total: 'valor' })
          .first(),
      )
    : 0;
  const receitaSicafOntem = hasTaxas
    ? await scalar(db, () =>
        receitaSicafPagoWhere(db('taxas_sicaf'))
          .whereRaw(`${RECEITA_SICAF_REF_DIA} = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`)
          .sum({ total: 'valor' })
          .first(),
      )
    : 0;
  const receitaSicafMes = hasTaxas
    ? await scalar(db, () =>
        receitaSicafPagoWhere(db('taxas_sicaf'))
          .whereRaw(`${RECEITA_SICAF_REF_DIA} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
          .whereRaw(`${RECEITA_SICAF_REF_DIA} < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`)
          .sum({ total: 'valor' })
          .first(),
      )
    : 0;
  const receitaSicafMesAnterior = hasTaxas
    ? await scalar(db, () =>
        receitaSicafPagoWhere(db('taxas_sicaf'))
          .whereRaw(`${RECEITA_SICAF_REF_DIA} >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')`)
          .whereRaw(`${RECEITA_SICAF_REF_DIA} < DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
          .sum({ total: 'valor' })
          .first(),
      )
    : 0;

  let receitaPagHoje = 0;
  let receitaPagMes = 0;
  let receitaPagMesAnterior = 0;
  if (await hasTable(db, 'pagamentos')) {
    receitaPagHoje = await scalar(db, () =>
      db('pagamentos as p')
        .whereNull('p.deleted_at')
        .whereRaw(PAGO_PAGAMENTOS_WHERE)
        .whereRaw(`${REF_PAGAMENTO_DIA} = CURDATE()`)
        .sum({ total: 'p.valor' })
        .first(),
    );
    receitaPagMes = await scalar(db, () =>
      db('pagamentos as p')
        .whereNull('p.deleted_at')
        .whereRaw(PAGO_PAGAMENTOS_WHERE)
        .whereRaw(`${REF_PAGAMENTO_DIA} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .whereRaw(`${REF_PAGAMENTO_DIA} < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`)
        .sum({ total: 'p.valor' })
        .first(),
    );
    receitaPagMesAnterior = await scalar(db, () =>
      db('pagamentos as p')
        .whereNull('p.deleted_at')
        .whereRaw(PAGO_PAGAMENTOS_WHERE)
        .whereRaw(`${REF_PAGAMENTO_DIA} >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')`)
        .whereRaw(`${REF_PAGAMENTO_DIA} < DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .sum({ total: 'p.valor' })
        .first(),
    );
  }

  const recebimentosHoje = receitaManutHoje + receitaSicafHoje + receitaPagHoje;
  const recebimentosOntem = receitaManutOntem + receitaSicafOntem;
  const recebimentosMes = receitaManutMes + receitaSicafMes + receitaPagMes;
  const recebimentosMesAnterior = receitaManutMesAnterior + receitaSicafMesAnterior + receitaPagMesAnterior;

  const inadimplenciaManut = hasManutBoletos
    ? await scalar(db, () =>
        db('manutencao_boletos').whereIn('status', ['Atrasado', 'Vencido', 'vencido', 'atrasado']).sum({ total: 'valor' }).first(),
      )
    : 0;
  const inadimplenciaSicaf = hasTaxas
    ? await scalar(db, () =>
        db('taxas_sicaf').whereIn('status', ['Atrasado', 'Vencido', 'vencido', 'atrasado', 'Pendente', 'pendente']).sum({ total: 'valor' }).first(),
      )
    : 0;

  const clientesInadimplentes = await scalar(db, async () => {
    const ids = new Set();
    if (hasManutBoletos) {
      const rows = await db('manutencao_boletos')
        .whereIn('status', ['Atrasado', 'Vencido', 'vencido', 'atrasado'])
        .whereNotNull('cliente_id')
        .distinct('cliente_id');
      rows.forEach((r) => ids.add(r.cliente_id));
    }
    if (hasTaxas) {
      const rows = await db('taxas_sicaf')
        .whereIn('status', ['Atrasado', 'Vencido', 'vencido', 'atrasado', 'Pendente', 'pendente'])
        .distinct('cliente_id');
      rows.forEach((r) => ids.add(r.cliente_id));
    }
    if (await hasTable(db, 'pagamentos')) {
      const rows = await db('pagamentos')
        .whereNull('deleted_at')
        .whereIn('status', ['aguardando', 'gerado', 'expirado'])
        .whereRaw('data_vencimento IS NOT NULL AND DATE(data_vencimento) < CURDATE()')
        .whereNotNull('cliente_id')
        .distinct('cliente_id');
      rows.forEach((r) => ids.add(r.cliente_id));
    }
    return { total: ids.size };
  });

  const renovacoes30d = hasSicaf
    ? await scalar(db, () =>
        db('sicaf_cadastros')
          .where('credenciamento_anual', 1)
          .whereRaw('updated_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)')
          .count({ total: '*' })
          .first(),
      )
    : 0;
  const renovacoes30dAnterior = hasSicaf
    ? await scalar(db, () =>
        db('sicaf_cadastros')
          .where('credenciamento_anual', 1)
          .whereRaw('updated_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)')
          .whereRaw('updated_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY)')
          .count({ total: '*' })
          .first(),
      )
    : 0;

  const cancelamentos30d = hasManutencoes
    ? await scalar(db, () =>
        db('manutencoes')
          .whereIn('status', ['Cancelado', 'Cancelada', 'cancelado'])
          .whereRaw('updated_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)')
          .count({ total: '*' })
          .first(),
      )
    : 0;
  const cancelamentos30dAnterior = hasManutencoes
    ? await scalar(db, () =>
        db('manutencoes')
          .whereIn('status', ['Cancelado', 'Cancelada', 'cancelado'])
          .whereRaw('updated_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)')
          .whereRaw('updated_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY)')
          .count({ total: '*' })
          .first(),
      )
    : 0;

  const serieMes = [];
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const fatByDay = new Map();
  for (let d = 1; d <= diaAtual; d += 1) fatByDay.set(d, 0);

  const addFat = (rows, refExpr) => {
    for (const row of rows) {
      const day = toNumber(row.dia);
      if (day >= 1 && day <= diaAtual) {
        fatByDay.set(day, (fatByDay.get(day) || 0) + toNumber(row.total));
      }
    }
  };

  if (hasManutBoletos) {
    const rows = await safeQuery([], () =>
      receitaManutPagoWhere(db('manutencao_boletos'))
        .whereRaw(`${RECEITA_MANUT_REF_DIA} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .whereRaw(`${RECEITA_MANUT_REF_DIA} < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`)
        .select(db.raw(`DAY(${RECEITA_MANUT_REF_DIA}) as dia`), db.raw('SUM(valor) as total'))
        .groupByRaw(`DAY(${RECEITA_MANUT_REF_DIA})`),
    );
    addFat(rows);
  }
  if (hasTaxas) {
    const rows = await safeQuery([], () =>
      receitaSicafPagoWhere(db('taxas_sicaf'))
        .whereRaw(`${RECEITA_SICAF_REF_DIA} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .whereRaw(`${RECEITA_SICAF_REF_DIA} < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`)
        .select(db.raw(`DAY(${RECEITA_SICAF_REF_DIA}) as dia`), db.raw('SUM(valor) as total'))
        .groupByRaw(`DAY(${RECEITA_SICAF_REF_DIA})`),
    );
    addFat(rows);
  }
  if (await hasTable(db, 'pagamentos')) {
    const rows = await safeQuery([], () =>
      db('pagamentos as p')
        .whereNull('p.deleted_at')
        .whereRaw(PAGO_PAGAMENTOS_WHERE)
        .whereRaw(`${REF_PAGAMENTO_DIA} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`)
        .whereRaw(`${REF_PAGAMENTO_DIA} < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`)
        .select(db.raw(`DAY(${REF_PAGAMENTO_DIA}) as dia`), db.raw('SUM(p.valor) as total'))
        .groupByRaw(`DAY(${REF_PAGAMENTO_DIA})`),
    );
    addFat(rows);
  }

  for (let d = 1; d <= diaAtual; d += 1) {
    const label = d === diaAtual ? 'Hoje' : String(d).padStart(2, '0');
    serieMes.push({ d: label, v: Math.round((fatByDay.get(d) || 0) * 100) / 100 });
  }

  const mixRaw = { PIX: 0, Cartão: 0, Boleto: 0, Outro: 0 };
  if (await hasTable(db, 'pagamentos')) {
    const mixRows = await safeQuery([], () =>
      db('pagamentos as p')
        .whereNull('p.deleted_at')
        .whereRaw(PAGO_PAGAMENTOS_WHERE)
        .whereRaw(`${REF_PAGAMENTO_DIA} >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`)
        .select('p.tipo', db.raw('SUM(p.valor) as total'))
        .groupBy('p.tipo'),
    );
    for (const row of mixRows) {
      const meio = mapTipoMeio(row.tipo);
      const key = meio === 'Transferência' ? 'Outro' : meio;
      mixRaw[key] = (mixRaw[key] || 0) + toNumber(row.total);
    }
  } else if (await hasTable(db, 'pagamentos_gerencianet')) {
    const mixRows = await safeQuery([], () =>
      db('pagamentos_gerencianet as p')
        .whereRaw("LOWER(TRIM(CAST(p.status AS CHAR))) IN ('pago','paga','aprovado','aprovada')")
        .whereRaw('DATE(COALESCE(p.data_pagamento, p.created_at)) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)')
        .select('p.tipo', db.raw('SUM(p.valor) as total'))
        .groupBy('p.tipo'),
    );
    for (const row of mixRows) {
      const meio = mapTipoMeio(row.tipo);
      const key = meio === 'Transferência' ? 'Outro' : meio;
      mixRaw[key] = (mixRaw[key] || 0) + toNumber(row.total);
    }
  }

  const mixTotal = Object.values(mixRaw).reduce((a, b) => a + b, 0);
  const mixCores = { PIX: '#10b981', Cartão: '#6366f1', Boleto: '#f59e0b', Outro: '#94a3b8' };
  const meios = Object.entries(mixRaw)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value: mixTotal > 0 ? Math.round((value / mixTotal) * 1000) / 10 : 0,
      valor: Math.round(value * 100) / 100,
      color: mixCores[name] || '#94a3b8',
    }));

  const pagRows = await loadPagamentosRows(db, 60);
  const movimentos = pagRows.slice(0, 30).map((r) => ({
    id: r.id,
    cliente: r.cliente,
    meio: r.tipo,
    valor: r.valor,
    status: r.statusUi,
    data: formatDataMovimento(r),
    origem: r.origem,
    descricao: r.descricao,
  }));

  return {
    ok: true,
    kpis: {
      recebimentosHoje,
      recebimentosOntem,
      changeHoje: calcChangePercent(recebimentosHoje, recebimentosOntem),
      recebimentosMes,
      recebimentosMesAnterior,
      changeMes: calcChangePercent(recebimentosMes, recebimentosMesAnterior),
      inadimplentes: clientesInadimplentes,
      inadimplenciaValor: inadimplenciaManut + inadimplenciaSicaf,
      renovacoes30d,
      renovacoesDelta: renovacoes30d - renovacoes30dAnterior,
      cancelamentos30d,
      cancelamentosDelta: cancelamentos30d - cancelamentos30dAnterior,
    },
    serieMes,
    meios,
    movimentos,
  };
}

async function listPagamentosPendentes() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const rows = [];

  if (await hasTable(db, 'pagamentos')) {
    const pg = await safeQuery([], () =>
      db('pagamentos as p')
        .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
        .whereNull('p.deleted_at')
        .whereIn('p.status', ['aguardando', 'gerado'])
        .select(
          'p.id',
          'p.origem',
          'p.tipo',
          'p.valor',
          'p.descricao',
          'p.status',
          'p.data_vencimento',
          'p.created_at',
          'c.razao_social',
          'c.nome_fantasia',
          'c.documento',
        )
        .orderByRaw('CASE WHEN p.data_vencimento IS NOT NULL AND DATE(p.data_vencimento) < CURDATE() THEN 0 ELSE 1 END')
        .orderBy('p.data_vencimento', 'asc')
        .orderBy('p.created_at', 'desc')
        .limit(100),
    );
    for (const row of pg) {
      const vencido = row.data_vencimento && new Date(row.data_vencimento) < new Date(new Date().toDateString());
      rows.push({
        id: row.id,
        company: row.razao_social || row.nome_fantasia || 'Cliente não informado',
        cnpj: row.documento || '',
        type: row.descricao || (row.origem === 'manutencao' ? 'Manutenção SICAF' : 'Taxa SICAF'),
        method: mapTipoMeio(row.tipo),
        amountNumber: toNumber(row.valor),
        dueDate: formatDateBR(row.data_vencimento),
        generatedAt: formatDateBR(row.created_at),
        status: vencido ? 'Vencido' : mapStatusUi(row.status, row.data_vencimento),
      });
    }
  }

  if (rows.length === 0 && (await hasTable(db, 'pagamentos_gerencianet'))) {
    const gn = await safeQuery([], () =>
      db('pagamentos_gerencianet as p')
        .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
        .whereNotIn('p.status', ['pago', 'Pago', 'Aprovado', 'aprovado', 'cancelado', 'Cancelado'])
        .select(
          'p.id',
          'p.origem',
          'p.tipo',
          'p.valor',
          'p.descricao',
          'p.status',
          'p.data_vencimento',
          'p.created_at',
          'c.razao_social',
          'c.nome_fantasia',
          'c.documento',
        )
        .orderBy('p.data_vencimento', 'asc')
        .limit(100),
    );
    for (const row of gn) {
      const vencido = row.data_vencimento && new Date(row.data_vencimento) < new Date(new Date().toDateString());
      rows.push({
        id: row.id,
        company: row.razao_social || row.nome_fantasia || 'Cliente não informado',
        cnpj: row.documento || '',
        type: row.descricao || (row.origem === 'manutencao' ? 'Manutenção SICAF' : 'Taxa SICAF'),
        method: mapTipoMeio(row.tipo),
        amountNumber: toNumber(row.valor),
        dueDate: formatDateBR(row.data_vencimento),
        generatedAt: formatDateBR(row.created_at),
        status: vencido ? 'Vencido' : mapStatusUi(row.status, row.data_vencimento),
      });
    }
  }

  return { ok: true, pagamentos: rows, total: rows.length };
}

module.exports = {
  getAdminFinanceiro,
  listPagamentosPendentes,
};
