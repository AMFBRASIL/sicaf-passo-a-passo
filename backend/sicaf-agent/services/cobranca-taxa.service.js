/**
 * Cobrança de taxa SICAF pendente — listagem admin, envio de e-mail e histórico.
 */
const { getDb } = require('../database/connection');
const { sendCobrancaTaxaEmail } = require('./cobranca-taxa-email.service');
const { getPublicPayBaseUrl } = require('../utils/pay-link.util');

const TAXA_ABERTA_STATUSES = [
  'Pendente', 'pendente', 'Aguardando', 'aguardando', 'Gerado', 'gerado',
  'Vencido', 'vencido', 'Atrasado', 'atrasado',
];

const PAGAMENTO_PENDENTE_STATUSES = [
  'pendente', 'aguardando', 'aberto', 'gerado', 'vencido', 'atrasado',
  'Pendente', 'Aguardando', 'Aberto', 'Gerado', 'Vencido', 'Atrasado',
];

const PAY_CODE_RE = /^(t|p|c)-(\d+)$/i;

function parsePayCode(code) {
  const raw = String(code || '').trim().toLowerCase();
  const m = raw.match(PAY_CODE_RE);
  if (!m) return null;
  const id = parseInt(m[2], 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  const type = m[1] === 't' ? 'taxa' : m[1] === 'p' ? 'pagamento' : 'cliente';
  return { type, id, code: `${m[1]}-${id}` };
}

function buildPayCode({ taxaId, pagamentoId, clienteId }) {
  if (taxaId) return `t-${taxaId}`;
  if (pagamentoId) return `p-${pagamentoId}`;
  return `c-${clienteId}`;
}

function buildPayLink(opts) {
  const code = buildPayCode(opts);
  return `${getPublicPayBaseUrl()}/pay/${code}`;
}

function calcSeveridade(diasPendente, status) {
  const dias = toNumber(diasPendente);
  if (status === 'Vencido' && dias >= 15) return 'critica';
  if (dias >= 30 || status === 'Vencido') return 'critica';
  if (dias >= 14) return 'media';
  return 'leve';
}

function maskEmail(email) {
  const e = String(email || '').trim();
  if (!e || !e.includes('@')) return '—';
  const [user, domain] = e.split('@');
  if (!domain) return '***';
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}***@${domain}`;
}

function maskDocument(doc) {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`;
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  return '***';
}

function mapGuiaStatus(item) {
  if (!item.pendente) return 'pago';
  if (item.vencido) return 'vencido';
  return 'pendente';
}

function mapGuiaTipoLabel(tipo) {
  if (tipo === 'sicaf') return 'SICAF';
  if (tipo === 'manutencao') return 'Manutenção';
  return 'Cobrança';
}

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDateBr(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

function formatDateTimeBr(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calcDiasPendente(refDate) {
  if (!refDate) return 0;
  const d = new Date(refDate);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

function mapStatusUi(status, dataVencimento) {
  const s = String(status || '').toLowerCase();
  if (['vencido', 'atrasado', 'expirado'].includes(s)) return 'Vencido';
  if (dataVencimento) {
    const venc = new Date(dataVencimento);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    venc.setHours(0, 0, 0, 0);
    if (!Number.isNaN(venc.getTime()) && venc < hoje) return 'Vencido';
  }
  if (['pendente', 'aguardando', 'gerado'].includes(s)) return 'Aguardando';
  return status || 'Aguardando';
}

async function ensureCobrancasTable(db) {
  const has = await db.schema.hasTable('cobrancas_taxa_sicaf');
  if (has) return;
  await db.raw(`
    CREATE TABLE cobrancas_taxa_sicaf (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      taxa_sicaf_id BIGINT UNSIGNED DEFAULT NULL,
      pagamento_id BIGINT UNSIGNED DEFAULT NULL,
      cliente_id BIGINT UNSIGNED NOT NULL,
      email_destino VARCHAR(255) NOT NULL,
      enviado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      enviado_por BIGINT UNSIGNED DEFAULT NULL,
      sucesso TINYINT(1) NOT NULL DEFAULT 1,
      erro TEXT DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_cobranca_cliente (cliente_id, enviado_em),
      KEY idx_cobranca_taxa (taxa_sicaf_id, enviado_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[CobrancaTaxa] Tabela cobrancas_taxa_sicaf criada.');
}

async function hasTable(db, name) {
  try {
    return await db.schema.hasTable(name);
  } catch (_) {
    return false;
  }
}

async function loadCobrancaResumoMap(db, clienteIds) {
  const map = {};
  if (!clienteIds.length) return map;
  const hasCobrancas = await hasTable(db, 'cobrancas_taxa_sicaf');
  if (!hasCobrancas) return map;

  const rows = await db('cobrancas_taxa_sicaf')
    .whereIn('cliente_id', clienteIds)
    .where('sucesso', 1)
    .groupBy('cliente_id')
    .select(
      'cliente_id',
      db.raw('MAX(enviado_em) as ultima_cobranca_em'),
      db.raw('COUNT(*) as total_cobrancas'),
    );
  for (const row of rows) {
    map[row.cliente_id] = {
      ultimaCobrancaEm: row.ultima_cobranca_em,
      ultimaCobrancaFormatada: formatDateTimeBr(row.ultima_cobranca_em),
      totalCobrancas: parseInt(row.total_cobrancas, 10) || 0,
      foiCobrado: true,
    };
  }
  return map;
}

async function loadPagamentoVencimentoByTaxaMap(db, taxaIds) {
  const map = new Map();
  if (!taxaIds.length) return map;

  if (await hasTable(db, 'pagamentos')) {
    const rows = await db('pagamentos')
      .where('origem', 'sicaf')
      .whereIn('origem_id', taxaIds)
      .whereNull('deleted_at')
      .whereIn('status', PAGAMENTO_PENDENTE_STATUSES)
      .select('id', 'origem_id', 'data_vencimento')
      .orderBy('created_at', 'desc');
    for (const row of rows) {
      if (!map.has(row.origem_id)) {
        map.set(row.origem_id, {
          pagamentoId: row.id,
          dataVencimento: row.data_vencimento,
        });
      }
    }
  }

  if (await hasTable(db, 'pagamentos_gerencianet')) {
    const missing = taxaIds.filter((id) => !map.has(id));
    if (missing.length) {
      const rows = await db('pagamentos_gerencianet')
        .where('origem', 'sicaf')
        .whereIn('origem_id', missing)
        .whereIn('status', PAGAMENTO_PENDENTE_STATUSES)
        .select('id', 'origem_id', 'data_vencimento')
        .orderBy('created_at', 'desc');
      for (const row of rows) {
        if (!map.has(row.origem_id)) {
          map.set(row.origem_id, {
            pagamentoId: row.id,
            dataVencimento: row.data_vencimento,
          });
        }
      }
    }
  }

  return map;
}

async function loadTaxasPendentesRows(db) {
  const hasTaxas = await hasTable(db, 'taxas_sicaf');
  if (!hasTaxas) return [];

  const rows = await db('taxas_sicaf as t')
    .leftJoin('clientes as c', 'c.id', 't.cliente_id')
    .whereIn('t.status', TAXA_ABERTA_STATUSES)
    .whereNotNull('t.cliente_id')
    .select(
      't.id as taxaId',
      't.cliente_id as clienteId',
      't.descricao',
      't.valor',
      't.status',
      't.forma_pagamento as formaPagamento',
      't.created_at as pendenteDesde',
      'c.razao_social as razaoSocial',
      'c.nome_fantasia as nomeFantasia',
      'c.documento',
      'c.email',
      'c.telefone',
      'c.celular',
      'c.responsavel_nome as responsavelNome',
      'c.cidade',
      'c.estado',
    )
    .orderBy('t.created_at', 'asc');

  const taxaIds = rows.map((r) => r.taxaId);
  const vencMap = await loadPagamentoVencimentoByTaxaMap(db, taxaIds);

  const byCliente = new Map();
  for (const row of rows) {
    const venc = vencMap.get(row.taxaId);
    const enriched = {
      ...row,
      pagamentoId: venc?.pagamentoId || null,
      dataVencimento: venc?.dataVencimento || null,
    };
    if (!byCliente.has(row.clienteId)) {
      byCliente.set(row.clienteId, enriched);
    }
  }
  return Array.from(byCliente.values());
}

async function loadPagamentosPendentesRows(db) {
  const hasPagamentos = await hasTable(db, 'pagamentos');
  if (!hasPagamentos) return [];

  const rows = await db('pagamentos as p')
    .leftJoin('clientes as c', 'c.id', 'p.cliente_id')
    .whereNull('p.deleted_at')
    .whereIn('p.status', ['aguardando', 'gerado', 'pendente', 'Pendente', 'Aguardando', 'Gerado'])
    .where(function () {
      this.where('p.origem', 'sicaf').orWhereNull('p.origem');
    })
    .whereNotNull('p.cliente_id')
    .select(
      'p.id as pagamentoId',
      'p.cliente_id as clienteId',
      'p.descricao',
      'p.valor',
      'p.status',
      'p.tipo as formaPagamento',
      'p.data_vencimento as dataVencimento',
      'p.created_at as pendenteDesde',
      'c.razao_social as razaoSocial',
      'c.nome_fantasia as nomeFantasia',
      'c.documento',
      'c.email',
      'c.telefone',
      'c.celular',
      'c.responsavel_nome as responsavelNome',
      'c.cidade',
      'c.estado',
    )
    .orderBy('p.created_at', 'asc');

  return rows;
}

function mergePendencias(taxaRows, pagamentoRows) {
  const map = new Map();

  for (const row of taxaRows) {
    const cidade = [row.cidade, row.estado].filter(Boolean).join('/') || '';
    const payCode = buildPayCode({ taxaId: row.taxaId, pagamentoId: row.pagamentoId, clienteId: row.clienteId });
    map.set(row.clienteId, {
      clienteId: row.clienteId,
      taxaId: row.taxaId,
      pagamentoId: row.pagamentoId || null,
      company: row.razaoSocial || row.nomeFantasia || 'Cliente não informado',
      cnpj: row.documento || '',
      email: row.email || '',
      telefone: row.celular || row.telefone || '',
      responsavel: row.responsavelNome || '',
      cidade,
      descricao: row.descricao || 'Taxa SICAF CADBRASIL',
      valor: toNumber(row.valor),
      formaPagamento: row.formaPagamento || '—',
      dataVencimento: row.dataVencimento,
      vencimentoFormatado: formatDateBr(row.dataVencimento),
      pendenteDesde: row.pendenteDesde,
      pendenteDesdeFormatado: formatDateBr(row.pendenteDesde),
      diasPendente: calcDiasPendente(row.pendenteDesde),
      status: mapStatusUi(row.status, row.dataVencimento),
      severidade: calcSeveridade(calcDiasPendente(row.pendenteDesde), mapStatusUi(row.status, row.dataVencimento)),
      payCode,
      payLink: buildPayLink({ taxaId: row.taxaId, pagamentoId: row.pagamentoId, clienteId: row.clienteId }),
      origem: 'taxa_sicaf',
    });
  }

  for (const row of pagamentoRows) {
    if (map.has(row.clienteId)) continue;
    const cidade = [row.cidade, row.estado].filter(Boolean).join('/') || '';
    const payCode = buildPayCode({ pagamentoId: row.pagamentoId, clienteId: row.clienteId });
    map.set(row.clienteId, {
      clienteId: row.clienteId,
      taxaId: null,
      pagamentoId: row.pagamentoId,
      company: row.razaoSocial || row.nomeFantasia || 'Cliente não informado',
      cnpj: row.documento || '',
      email: row.email || '',
      telefone: row.celular || row.telefone || '',
      responsavel: row.responsavelNome || '',
      cidade,
      descricao: row.descricao || 'Taxa SICAF CADBRASIL',
      valor: toNumber(row.valor),
      formaPagamento: row.formaPagamento || '—',
      dataVencimento: row.dataVencimento,
      vencimentoFormatado: formatDateBr(row.dataVencimento),
      pendenteDesde: row.pendenteDesde,
      pendenteDesdeFormatado: formatDateBr(row.pendenteDesde),
      diasPendente: calcDiasPendente(row.pendenteDesde),
      status: mapStatusUi(row.status, row.dataVencimento),
      severidade: calcSeveridade(calcDiasPendente(row.pendenteDesde), mapStatusUi(row.status, row.dataVencimento)),
      payCode,
      payLink: buildPayLink({ pagamentoId: row.pagamentoId, clienteId: row.clienteId }),
      origem: 'pagamento',
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.pendenteDesde || 0).getTime() - new Date(b.pendenteDesde || 0).getTime(),
  );
}

function applyFiltros(rows, filtros) {
  const q = String(filtros.q || '').trim().toLowerCase();
  const cobrado = String(filtros.cobrado || 'todos').toLowerCase();
  const status = String(filtros.status || 'todos').toLowerCase();
  const diasMin = parseInt(filtros.diasMin, 10);
  const semEmail = String(filtros.semEmail || 'todos').toLowerCase();
  const severidade = String(filtros.severidade || 'todos').toLowerCase();
  const clienteId = parseInt(filtros.clienteId, 10);

  return rows.filter((row) => {
    if (Number.isFinite(clienteId) && clienteId > 0 && row.clienteId !== clienteId) return false;

    if (q) {
      const hay = [row.company, row.cnpj, row.email, row.responsavel].join(' ').toLowerCase();
      const digits = q.replace(/\D/g, '');
      const cnpjDigits = (row.cnpj || '').replace(/\D/g, '');
      const matchText = hay.includes(q);
      const matchCnpj = digits.length >= 4 && cnpjDigits.includes(digits);
      if (!matchText && !matchCnpj) return false;
    }

    if (cobrado === 'sim' && !row.foiCobrado) return false;
    if (cobrado === 'nao' && row.foiCobrado) return false;

    if (status === 'vencido' && row.status !== 'Vencido') return false;
    if (status === 'aguardando' && row.status !== 'Aguardando') return false;

    if (Number.isFinite(diasMin) && diasMin > 0 && row.diasPendente < diasMin) return false;

    if (semEmail === 'sim' && row.email) return false;
    if (semEmail === 'nao' && !row.email) return false;

    if (severidade !== 'todos' && row.severidade !== severidade) return false;

    return true;
  });
}

/**
 * @param {object} [opts]
 * @param {number} [opts.page]
 * @param {number} [opts.pageSize]
 * @param {string} [opts.q]
 * @param {string} [opts.cobrado] - todos | sim | nao
 * @param {string} [opts.status] - todos | vencido | aguardando
 * @param {number|string} [opts.diasMin]
 * @param {string} [opts.semEmail] - todos | sim | nao
 */
async function listClientesCobrancaPendentes(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureCobrancasTable(db);

  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(5, parseInt(opts.pageSize, 10) || 15));

  const [taxaRows, pagamentoRows] = await Promise.all([
    loadTaxasPendentesRows(db),
    loadPagamentosPendentesRows(db),
  ]);

  let merged = mergePendencias(taxaRows, pagamentoRows);
  const clienteIds = merged.map((r) => r.clienteId);
  const cobrancaMap = await loadCobrancaResumoMap(db, clienteIds);

  merged = merged.map((row) => {
    const cob = cobrancaMap[row.clienteId] || {
      ultimaCobrancaEm: null,
      ultimaCobrancaFormatada: '',
      totalCobrancas: 0,
      foiCobrado: false,
    };
    return { ...row, ...cob };
  });

  const filtrados = applyFiltros(merged, opts);
  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const clientes = filtrados.slice(offset, offset + pageSize);

  const resumo = {
    total,
    totalVencidos: filtrados.filter((r) => r.status === 'Vencido').length,
    totalAguardando: filtrados.filter((r) => r.status === 'Aguardando').length,
    totalCobrados: filtrados.filter((r) => r.foiCobrado).length,
    totalNaoCobrados: filtrados.filter((r) => !r.foiCobrado).length,
    totalSemEmail: filtrados.filter((r) => !r.email).length,
    valorTotal: Math.round(filtrados.reduce((acc, r) => acc + r.valor, 0) * 100) / 100,
    totalCriticos: filtrados.filter((r) => r.severidade === 'critica').length,
    mediaAtrasoDias: filtrados.length
      ? Math.round(filtrados.reduce((acc, r) => acc + r.diasPendente, 0) / filtrados.length)
      : 0,
  };

  return {
    ok: true,
    clientes,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
    resumo,
  };
}

async function loadAllClientesCobrancaPendentes() {
  const db = getDb();
  if (!db) return [];

  await ensureCobrancasTable(db);

  const [taxaRows, pagamentoRows] = await Promise.all([
    loadTaxasPendentesRows(db),
    loadPagamentosPendentesRows(db),
  ]);

  let merged = mergePendencias(taxaRows, pagamentoRows);
  const clienteIds = merged.map((r) => r.clienteId);
  const cobrancaMap = await loadCobrancaResumoMap(db, clienteIds);

  return merged.map((row) => {
    const cob = cobrancaMap[row.clienteId] || {
      ultimaCobrancaEm: null,
      ultimaCobrancaFormatada: '',
      totalCobrancas: 0,
      foiCobrado: false,
    };
    return { ...row, ...cob };
  });
}

async function enviarCobrancaTaxa({
  clienteId,
  taxaId,
  pagamentoId,
  usuarioId,
  mensagemCustom,
  modelo,
  canal,
  disparoMassaId,
  reguaEtapaId,
  skipHistoricoDuplicado,
}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cid = parseInt(clienteId, 10);
  if (!Number.isFinite(cid) || cid <= 0) {
    return { ok: false, error: 'Cliente inválido' };
  }

  await ensureCobrancasTable(db);

  const cliente = await db('clientes').where('id', cid).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  let taxa = null;
  let pagamentoIdResolved = null;
  const tid = parseInt(taxaId, 10);
  if (Number.isFinite(tid) && tid > 0) {
    taxa = await db('taxas_sicaf').where({ id: tid, cliente_id: cid }).first();
  }
  if (!taxa) {
    taxa = await db('taxas_sicaf')
      .where('cliente_id', cid)
      .whereIn('status', TAXA_ABERTA_STATUSES)
      .orderBy('created_at', 'asc')
      .first();
  }

  if (!taxa && (await hasTable(db, 'pagamentos'))) {
    const pid = parseInt(pagamentoId, 10);
    let pagamento = null;
    if (Number.isFinite(pid) && pid > 0) {
      pagamento = await db('pagamentos').where({ id: pid, cliente_id: cid }).whereNull('deleted_at').first();
    }
    if (!pagamento) {
      pagamento = await db('pagamentos')
        .where('cliente_id', cid)
        .whereNull('deleted_at')
        .whereIn('status', PAGAMENTO_PENDENTE_STATUSES)
        .orderBy('created_at', 'asc')
        .first();
    }
    if (pagamento) {
      pagamentoIdResolved = pagamento.id;
      taxa = {
        id: null,
        valor: pagamento.valor,
        descricao: pagamento.descricao || 'Taxa SICAF CADBRASIL',
        data_vencimento: pagamento.data_vencimento,
        status: pagamento.status,
      };
    }
  }

  if (!taxa) {
    return { ok: false, error: 'Nenhuma taxa ou pagamento pendente encontrado para este cliente' };
  }

  if (!taxa.data_vencimento && taxa.id) {
    const vencMap = await loadPagamentoVencimentoByTaxaMap(db, [taxa.id]);
    const venc = vencMap.get(taxa.id);
    if (venc) {
      taxa = { ...taxa, data_vencimento: venc.dataVencimento };
      if (!pagamentoIdResolved && venc.pagamentoId) {
        pagamentoIdResolved = venc.pagamentoId;
      }
    }
  }

  const envio = await sendCobrancaTaxaEmail({
    db,
    cliente,
    taxa,
    mensagemCustom: mensagemCustom || null,
  });
  const emailDestino = envio.para || cliente.email || '';

  const sucesso = envio.ok;
  if (!skipHistoricoDuplicado) {
    try {
      const histPayload = {
        taxa_sicaf_id: taxa.id || null,
        pagamento_id: pagamentoIdResolved,
        cliente_id: cid,
        email_destino: emailDestino,
        canal: canal || 'email',
        mensagem: mensagemCustom ? String(mensagemCustom).slice(0, 5000) : null,
        modelo: modelo || null,
        disparo_massa_id: disparoMassaId || null,
        regua_etapa_id: reguaEtapaId || null,
        enviado_por: usuarioId || null,
        sucesso: sucesso ? 1 : 0,
        erro: sucesso ? null : String(envio.error || 'Falha no envio').slice(0, 2000),
        enviado_em: new Date(),
      };
      await db('cobrancas_taxa_sicaf').insert(histPayload);
    } catch (e) {
      console.warn('[CobrancaTaxa] Falha ao registrar histórico:', e.message);
    }
  }

  try {
    const hasAudit = await db.schema.hasTable('auditoria_log');
    const detalhes = JSON.stringify({
      taxaId: taxa.id,
      email: emailDestino,
      assunto: envio.assunto,
      sucesso,
    });
    if (hasAudit) {
      await db('auditoria_log').insert({
        usuario_id: usuarioId || null,
        cliente_id: cid,
        acao: sucesso ? 'CUSTOM:cobranca_taxa_email' : 'CUSTOM:cobranca_taxa_email_erro',
        descricao: sucesso ? 'Cobrança de taxa enviada por e-mail' : `Falha cobrança: ${envio.error || ''}`,
        entidade: 'clientes',
        entidade_id: cid,
        dados_novos: detalhes,
        created_at: new Date(),
      });
    } else {
      await db('historico_acoes').insert({
        cliente_id: cid,
        usuario_id: usuarioId || null,
        acao: sucesso ? 'Cobrança de taxa enviada por e-mail' : `Falha na cobrança: ${envio.error || ''}`,
        entidade: taxa.id ? 'taxas_sicaf' : 'clientes',
        entidade_id: taxa.id || cid,
        created_at: new Date(),
      });
    }
  } catch (_) {}

  if (!sucesso) {
    return { ok: false, error: envio.error || 'Falha ao enviar e-mail' };
  }

  return {
    ok: true,
    message: envio.simulado
      ? 'Cobrança registrada (SMTP não configurado — modo simulação)'
      : 'E-mail de cobrança enviado com sucesso',
    simulado: Boolean(envio.simulado),
    para: emailDestino,
    assunto: envio.assunto,
    ultimaCobrancaEm: new Date().toISOString(),
    ultimaCobrancaFormatada: formatDateTimeBr(new Date()),
  };
}

async function listCobrancaHistorico(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cid = parseInt(clienteId, 10);
  if (!Number.isFinite(cid) || cid <= 0) {
    return { ok: false, error: 'Cliente inválido' };
  }

  await ensureCobrancasTable(db);

  const hasCobrancas = await hasTable(db, 'cobrancas_taxa_sicaf');
  if (!hasCobrancas) {
    return { ok: true, historico: [] };
  }

  const rows = await db('cobrancas_taxa_sicaf as c')
    .leftJoin('usuarios as u', 'u.id', 'c.enviado_por')
    .where('c.cliente_id', cid)
    .orderBy('c.enviado_em', 'desc')
    .limit(40)
    .select(
      'c.id',
      'c.email_destino',
      'c.canal',
      'c.mensagem',
      'c.modelo',
      'c.enviado_em',
      'c.sucesso',
      'c.erro',
      'u.nome as enviadoPorNome',
    );

  const canalLabel = (c) => {
    const map = {
      email: 'E-mail',
      whatsapp: 'WhatsApp',
      sms: 'SMS',
      ligacao: 'Ligação',
    };
    return map[String(c || '').toLowerCase()] || 'E-mail';
  };

  const historico = rows.map((row) => ({
    id: row.id,
    email: row.email_destino,
    enviadoEm: row.enviado_em,
    enviadoEmFormatado: formatDateTimeBr(row.enviado_em),
    sucesso: !!row.sucesso,
    erro: row.erro || null,
    enviadoPor: row.enviadoPorNome || 'Sistema',
    canal: canalLabel(row.canal),
    descricao: row.sucesso
      ? `Cobrança via ${canalLabel(row.canal)}${row.email_destino ? ` — ${row.email_destino}` : ''}`
      : `Falha ao enviar cobrança: ${row.erro || 'erro desconhecido'}`,
  }));

  return { ok: true, historico };
}

async function resolveClienteIdFromPayCode(db, parsed) {
  if (parsed.type === 'cliente') return parsed.id;

  if (parsed.type === 'taxa') {
    const taxa = await db('taxas_sicaf').where('id', parsed.id).first();
    return taxa?.cliente_id || null;
  }

  if (parsed.type === 'pagamento') {
    if (await hasTable(db, 'pagamentos')) {
      const pg = await db('pagamentos').where('id', parsed.id).whereNull('deleted_at').first();
      if (pg?.cliente_id) return pg.cliente_id;
    }
    if (await hasTable(db, 'pagamentos_gerencianet')) {
      const pg = await db('pagamentos_gerencianet').where('id', parsed.id).first();
      if (pg?.cliente_id) return pg.cliente_id;
    }
  }

  return null;
}

function mapPendenciaToGuia(item) {
  const competencia =
    item.mesReferencia != null && item.anoReferencia
      ? `${String(item.mesReferencia).padStart(2, '0')}/${item.anoReferencia}`
      : String(item.anoReferencia || item.descricao || '—');

  return {
    id: `${item.tipo}-${item.id}`,
    tipo: mapGuiaTipoLabel(item.tipo),
    descricao: item.descricao || mapGuiaTipoLabel(item.tipo),
    competencia,
    vencimento: item.dataVencimento ? formatDateBr(item.dataVencimento) : '—',
    vencimentoIso: item.dataVencimento || null,
    valor: toNumber(item.valor),
    status: mapGuiaStatus(item),
    pagamentoId: item.pagamentoId || null,
    taxaId: item.tipo === 'sicaf' ? item.id : null,
    formaPagamento: item.formaPagamento || null,
    pixCopiaCola: item.qrcodeText || null,
    pixQrImage: item.qrcodeImage || null,
    linhaDigitavel: item.barcode || null,
    linkBoleto: item.linkBoleto || null,
    linkPdf: item.linkPdf || null,
    protocolo: item.protocolo || null,
  };
}

async function getPublicPayPage(code) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const parsed = parsePayCode(code);
  if (!parsed) return { ok: false, error: 'Link de pagamento inválido' };

  const clienteId = await resolveClienteIdFromPayCode(db, parsed);
  if (!clienteId) return { ok: false, error: 'Cobrança não encontrada' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  const clientsService = require('./clients.service');
  const fin = await clientsService.getClientFinanceiro(clienteId);
  if (!fin.ok) return { ok: false, error: fin.error || 'Erro ao carregar pendências' };

  const pendencias = fin.financeiro?.pendencias || [];
  if (!pendencias.length) {
    return { ok: false, error: 'Não há pagamentos pendentes para este link' };
  }

  const guias = pendencias.map(mapPendenciaToGuia);
  const focusGuiaId =
    parsed.type === 'taxa'
      ? `sicaf-${parsed.id}`
      : parsed.type === 'pagamento'
        ? guias.find((g) => g.pagamentoId === parsed.id)?.id || guias[0]?.id
        : guias[0]?.id;

  const guiasAbertas = guias.filter((g) => g.status !== 'pago');
  const totalAberto = guiasAbertas.reduce((acc, g) => acc + g.valor, 0);

  const focusGuia = guias.find((g) => g.id === focusGuiaId) || guiasAbertas[0] || guias[0];
  const pixGuia = guiasAbertas.find((g) => g.pixCopiaCola) || focusGuia;
  const boletoGuia = guiasAbertas.find((g) => g.linhaDigitavel || g.linkPdf) || focusGuia;

  const cidade = [cliente.cidade, cliente.estado].filter(Boolean).join('/') || '';

  return {
    ok: true,
    codigo: parsed.code,
    payLink: `${getPublicPayBaseUrl()}/pay/${parsed.code}`,
    cliente: {
      nome: cliente.responsavel_nome || cliente.razao_social || 'Cliente',
      nomeMascarado: cliente.responsavel_nome
        ? `${cliente.responsavel_nome.split(' ')[0]} ***`
        : 'Cliente',
      documento: maskDocument(cliente.documento),
      email: maskEmail(cliente.email),
    },
    empresa: {
      razao: cliente.razao_social || cliente.nome_fantasia || 'Empresa',
      cnpj: cliente.documento || '',
    },
    cidade,
    guias,
    focusGuiaId,
    resumo: {
      totalGuias: guias.length,
      totalAberto: Math.round(totalAberto * 100) / 100,
      qtdVencidas: guiasAbertas.filter((g) => g.status === 'vencido').length,
    },
    pagamento: {
      pixCopiaCola: pixGuia?.pixCopiaCola || null,
      pixQrImage: pixGuia?.pixQrImage || null,
      linhaDigitavel: boletoGuia?.linhaDigitavel || null,
      linkBoleto: boletoGuia?.linkBoleto || null,
      linkPdf: boletoGuia?.linkPdf || null,
      formaPagamento: focusGuia?.formaPagamento || null,
    },
    expiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };
}

module.exports = {
  listClientesCobrancaPendentes,
  loadAllClientesCobrancaPendentes,
  enviarCobrancaTaxa,
  ensureCobrancasTable,
  listCobrancaHistorico,
  getPublicPayPage,
  buildPayLink,
  buildPayCode,
  parsePayCode,
};
