/**
 * Solicitações de cancelamento — listagem admin, disputa, respostas e e-mail.
 */
const { getDb } = require('../database/connection');
const emailService = require('./email.service');
const storageService = require('./storage.service');

const LOG_PREFIX = '[SolicitacoesCancelamento]';

const STATUS_VALIDOS = [
  'solicitada',
  'em_andamento',
  'em_analise',
  'analisada',
  'procedente',
  'improcedente',
  'processada',
  'cancelada',
  'revertida',
];

const STATUS_LABELS = {
  solicitada: 'Solicitada',
  em_andamento: 'Em andamento',
  em_analise: 'Em análise',
  analisada: 'Analisada',
  procedente: 'Procedente',
  improcedente: 'Improcedente',
  processada: 'Processada',
  cancelada: 'Cancelada',
  revertida: 'Revertida',
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseJsonSafe(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}

function normalizeStatus(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  const aliases = {
    solicitando: 'solicitada',
    solicitacao: 'solicitada',
    pendente: 'solicitada',
    novo: 'solicitada',
    nova: 'solicitada',
    aberto: 'solicitada',
    aberta: 'solicitada',
    andamento: 'em_andamento',
    emandamento: 'em_andamento',
    analise: 'em_analise',
    emanalise: 'em_analise',
    analisado: 'analisada',
    processado: 'processada',
    cancelado: 'cancelada',
    reverter: 'revertida',
    revertido: 'revertida',
  };

  if (STATUS_VALIDOS.includes(s)) return s;
  if (aliases[s]) return aliases[s];
  return 'solicitada';
}

/** Valores brutos no banco que mapeiam para o status canônico (filtro de listagem). */
function statusAliases(canonical) {
  const map = {
    solicitada: ['solicitada', 'solicitando', 'solicitação', 'solicitacao', 'pendente', 'novo', 'nova', 'aberto', 'aberta'],
    em_andamento: ['em_andamento', 'em andamento', 'andamento'],
    em_analise: ['em_analise', 'em análise', 'em analise', 'análise', 'analise'],
    analisada: ['analisada', 'analisado'],
    procedente: ['procedente'],
    improcedente: ['improcedente'],
    processada: ['processada', 'processado'],
    cancelada: ['cancelada', 'cancelado'],
    revertida: ['revertida', 'revertido', 'reverter'],
  };
  return map[canonical] || [canonical];
}

async function hasTable(db, name) {
  try {
    return await db.schema.hasTable(name);
  } catch (_) {
    return false;
  }
}

async function ensureColumn(db, table, column, ddl) {
  try {
    const has = await db.schema.hasColumn(table, column);
    if (!has) await db.raw(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  } catch (_) {}
}

async function ensureTables(db) {
  const hasMain = await hasTable(db, 'solicitacoes_cancelamento');
  if (!hasMain) {
    await db.raw(`
      CREATE TABLE solicitacoes_cancelamento (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        cliente_id INT NULL,
        protocolo VARCHAR(80) NULL,
        documento VARCHAR(30) NULL,
        razao_social VARCHAR(255) NULL,
        protocolo_cadastro VARCHAR(80) NULL,
        email VARCHAR(190) NULL,
        telefone VARCHAR(40) NULL,
        cidade VARCHAR(120) NULL,
        estado VARCHAR(2) NULL,
        motivos_json JSON NULL,
        servico_esperado VARCHAR(120) NULL,
        servico_esperado_outro TEXT NULL,
        dados_reembolso_json JSON NULL,
        deseja_monitoramento TINYINT(1) NOT NULL DEFAULT 0,
        reverter_cancelamento TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(40) NOT NULL DEFAULT 'solicitada',
        observacoes TEXT NULL,
        tracking_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sol_canc_status (status),
        KEY idx_sol_canc_cliente (cliente_id),
        KEY idx_sol_canc_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log(`${LOG_PREFIX} Tabela solicitacoes_cancelamento criada.`);
  }

  const hasResp = await hasTable(db, 'solicitacoes_cancelamento_respostas');
  if (!hasResp) {
    await db.raw(`
      CREATE TABLE solicitacoes_cancelamento_respostas (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        solicitacao_id BIGINT UNSIGNED NOT NULL,
        usuario_id INT NULL,
        status_anterior VARCHAR(40) NULL,
        status_novo VARCHAR(40) NOT NULL,
        assunto VARCHAR(255) NULL,
        mensagem TEXT NOT NULL,
        interno TINYINT(1) NOT NULL DEFAULT 0,
        email_enviado TINYINT(1) NOT NULL DEFAULT 0,
        email_destino VARCHAR(190) NULL,
        email_erro TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sol_canc_resp_sol (solicitacao_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log(`${LOG_PREFIX} Tabela solicitacoes_cancelamento_respostas criada.`);
  }

  const hasAnexos = await hasTable(db, 'solicitacoes_cancelamento_anexos');
  if (!hasAnexos) {
    await db.raw(`
      CREATE TABLE solicitacoes_cancelamento_anexos (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        solicitacao_id BIGINT UNSIGNED NOT NULL,
        resposta_id BIGINT UNSIGNED NULL,
        usuario_id INT NULL,
        nome_original VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NULL,
        tamanho INT NOT NULL DEFAULT 0,
        url VARCHAR(500) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sol_canc_anx_sol (solicitacao_id),
        KEY idx_sol_canc_anx_resp (resposta_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log(`${LOG_PREFIX} Tabela solicitacoes_cancelamento_anexos criada.`);
  }

  await ensureColumn(db, 'solicitacoes_cancelamento', 'status', "status VARCHAR(40) NOT NULL DEFAULT 'solicitada'");
  await ensureColumn(db, 'solicitacoes_cancelamento', 'observacoes', 'observacoes TEXT NULL');
  await ensureColumn(db, 'solicitacoes_cancelamento', 'tracking_json', 'tracking_json JSON NULL');
}

function mapMotivos(motivosJson) {
  const parsed = parseJsonSafe(motivosJson, []);
  if (Array.isArray(parsed)) {
    return parsed.map((m) => {
      if (typeof m === 'string') return m;
      if (m && typeof m === 'object') return m.label || m.motivo || m.texto || JSON.stringify(m);
      return String(m);
    });
  }
  if (parsed && typeof parsed === 'object') {
    return Object.values(parsed).map((v) => String(v));
  }
  return [];
}

function mapRow(row) {
  if (!row) return null;
  const status = normalizeStatus(row.status);
  return {
    id: Number(row.id),
    clienteId: row.cliente_id != null ? Number(row.cliente_id) : null,
    protocolo: row.protocolo || null,
    documento: row.documento || null,
    razaoSocial: row.razao_social || null,
    protocoloCadastro: row.protocolo_cadastro || null,
    email: row.email || null,
    telefone: row.telefone || null,
    cidade: row.cidade || null,
    estado: row.estado || null,
    motivos: mapMotivos(row.motivos_json),
    motivosRaw: parseJsonSafe(row.motivos_json, null),
    servicoEsperado: row.servico_esperado || null,
    servicoEsperadoOutro: row.servico_esperado_outro || null,
    dadosReembolso: parseJsonSafe(row.dados_reembolso_json, null),
    desejaMonitoramento: !!row.deseja_monitoramento,
    reverterCancelamento: !!row.reverter_cancelamento,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    observacoes: row.observacoes || null,
    tracking: parseJsonSafe(row.tracking_json, null),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapResposta(row) {
  return {
    id: Number(row.id),
    solicitacaoId: Number(row.solicitacao_id),
    usuarioId: row.usuario_id != null ? Number(row.usuario_id) : null,
    usuarioNome: row.usuario_nome || null,
    statusAnterior: row.status_anterior || null,
    statusNovo: normalizeStatus(row.status_novo),
    statusNovoLabel: STATUS_LABELS[normalizeStatus(row.status_novo)] || row.status_novo,
    assunto: row.assunto || null,
    mensagem: row.mensagem || '',
    interno: !!row.interno,
    emailEnviado: !!row.email_enviado,
    emailDestino: row.email_destino || null,
    emailErro: row.email_erro || null,
    createdAt: row.created_at || null,
  };
}

function mapAnexo(row) {
  return {
    id: Number(row.id),
    solicitacaoId: Number(row.solicitacao_id),
    respostaId: row.resposta_id != null ? Number(row.resposta_id) : null,
    usuarioId: row.usuario_id != null ? Number(row.usuario_id) : null,
    nomeOriginal: row.nome_original,
    mimeType: row.mime_type || null,
    tamanho: Number(row.tamanho) || 0,
    url: row.url,
    createdAt: row.created_at || null,
  };
}

function portalBaseUrl() {
  return (
    process.env.PORTAL_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://fornecedor.cadbrasil.com.br'
  ).replace(/\/$/, '');
}

function buildRespostaEmailHtml({ solicitacao, assunto, mensagem, statusNovo, anexos }) {
  const empresa = solicitacao.razaoSocial || 'sua empresa';
  const protocolo = solicitacao.protocolo || `#${solicitacao.id}`;
  const statusLabel = STATUS_LABELS[statusNovo] || statusNovo;
  const portal = portalBaseUrl();
  const listaAnexos =
    anexos && anexos.length
      ? `<p style="margin:16px 0 8px;font-size:13px;color:#64748b"><strong>Anexos:</strong></p>
         <ul style="margin:0;padding-left:18px;color:#334155;font-size:13px">${anexos
           .map((a) => `<li><a href="${escapeHtml(a.url)}" style="color:#2563eb">${escapeHtml(a.nomeOriginal)}</a></li>`)
           .join('')}</ul>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 24px;color:#fff">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">CADBRASIL · Cancelamento</p>
      <h1 style="margin:0;font-size:20px">${escapeHtml(assunto || 'Atualização da sua solicitação')}</h1>
      <p style="margin:8px 0 0;font-size:13px;opacity:.9">Protocolo ${escapeHtml(protocolo)} · Status: ${escapeHtml(statusLabel)}</p>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">
        Olá, recebemos e estamos tratando a solicitação de cancelamento de <strong>${escapeHtml(empresa)}</strong>.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:0 0 18px;font-size:14px;line-height:1.7;color:#1e293b;white-space:pre-wrap">${escapeHtml(mensagem)}</div>
      ${listaAnexos}
      <p style="margin:20px 0 0;text-align:center">
        <a href="${escapeHtml(portal + '/suporte')}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;font-size:14px">Abrir suporte</a>
      </p>
    </div>
    <div style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;text-align:center">
      CADBRASIL · Credenciamento SICAF · ${escapeHtml(new Date().toLocaleDateString('pt-BR'))}
    </div>
  </div>
</body>
</html>`;
}

async function listSolicitacoes(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);

  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(5, parseInt(opts.pageSize, 10) || 20));
  const q = String(opts.q || '').trim().toLowerCase();
  const statusRaw = String(opts.status || 'todos').trim().toLowerCase();
  const statusFiltro =
    statusRaw && statusRaw !== 'todos' && statusRaw !== 'abertas'
      ? normalizeStatus(statusRaw)
      : null;
  const somenteAbertas = statusRaw === 'abertas';

  let query = db('solicitacoes_cancelamento as s').select('s.*');

  if (somenteAbertas) {
    const abertasAliases = [
      ...statusAliases('solicitada'),
      ...statusAliases('em_andamento'),
      ...statusAliases('em_analise'),
      ...statusAliases('analisada'),
    ];
    query = query.where(function statusWhere() {
      abertasAliases.forEach((a, i) => {
        if (i === 0) this.whereRaw('LOWER(TRIM(COALESCE(s.status, ""))) = ?', [a]);
        else this.orWhereRaw('LOWER(TRIM(COALESCE(s.status, ""))) = ?', [a]);
      });
    });
  } else if (statusFiltro) {
    const aliases = statusAliases(statusFiltro);
    query = query.where(function statusWhere() {
      aliases.forEach((a, i) => {
        if (i === 0) this.whereRaw('LOWER(TRIM(COALESCE(s.status, ""))) = ?', [a]);
        else this.orWhereRaw('LOWER(TRIM(COALESCE(s.status, ""))) = ?', [a]);
      });
    });
  }

  if (q) {
    const digits = q.replace(/\D/g, '');
    query = query.where(function search() {
      this.whereRaw('LOWER(COALESCE(s.razao_social,"")) LIKE ?', [`%${q}%`])
        .orWhereRaw('LOWER(COALESCE(s.email,"")) LIKE ?', [`%${q}%`])
        .orWhereRaw('LOWER(COALESCE(s.protocolo,"")) LIKE ?', [`%${q}%`])
        .orWhereRaw('LOWER(COALESCE(s.documento,"")) LIKE ?', [`%${q}%`]);
      if (digits.length >= 4) {
        this.orWhereRaw(
          "REPLACE(REPLACE(REPLACE(COALESCE(s.documento,''), '.', ''), '/', ''), '-', '') LIKE ?",
          [`%${digits}%`],
        );
      }
    });
  }

  const countRow = await query.clone().clearSelect().count({ total: '*' }).first();
  const total = Number(countRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const rows = await query
    .clone()
    .orderBy('s.created_at', 'desc')
    .limit(pageSize)
    .offset((safePage - 1) * pageSize);

  const items = rows.map(mapRow);

  const allForResumo = await db('solicitacoes_cancelamento').select('status');
  const resumo = {
    total: allForResumo.length,
    solicitada: 0,
    emAndamento: 0,
    emAnalise: 0,
    analisada: 0,
    procedente: 0,
    improcedente: 0,
    processada: 0,
    cancelada: 0,
    revertida: 0,
    abertas: 0,
  };

  for (const r of allForResumo) {
    const st = normalizeStatus(r.status);
    if (st === 'solicitada') resumo.solicitada += 1;
    if (st === 'em_andamento') resumo.emAndamento += 1;
    if (st === 'em_analise') resumo.emAnalise += 1;
    if (st === 'analisada') resumo.analisada += 1;
    if (st === 'procedente') resumo.procedente += 1;
    if (st === 'improcedente') resumo.improcedente += 1;
    if (st === 'processada') resumo.processada += 1;
    if (st === 'cancelada') resumo.cancelada += 1;
    if (st === 'revertida') resumo.revertida += 1;
    if (['solicitada', 'em_andamento', 'em_analise', 'analisada'].includes(st)) {
      resumo.abertas += 1;
    }
  }

  return {
    ok: true,
    items,
    pagination: { page: safePage, pageSize, total, totalPages },
    resumo,
    statusOptions: STATUS_VALIDOS.map((value) => ({ value, label: STATUS_LABELS[value] })),
  };
}

async function getSolicitacao(id) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);

  const solicitacaoId = parseInt(id, 10);
  if (!Number.isFinite(solicitacaoId) || solicitacaoId <= 0) {
    return { ok: false, error: 'ID inválido' };
  }

  const row = await db('solicitacoes_cancelamento').where('id', solicitacaoId).first();
  if (!row) return { ok: false, error: 'Solicitação não encontrada' };

  const solicitacao = mapRow(row);

  let respostas = [];
  try {
    const respRows = await db('solicitacoes_cancelamento_respostas as r')
      .leftJoin('usuarios as u', 'u.id', 'r.usuario_id')
      .where('r.solicitacao_id', solicitacaoId)
      .select('r.*', 'u.nome as usuario_nome')
      .orderBy('r.created_at', 'asc');
    respostas = respRows.map(mapResposta);
  } catch (_) {}

  let anexos = [];
  try {
    const anxRows = await db('solicitacoes_cancelamento_anexos')
      .where('solicitacao_id', solicitacaoId)
      .orderBy('created_at', 'asc');
    anexos = anxRows.map(mapAnexo);
  } catch (_) {}

  let cliente = null;
  if (solicitacao.clienteId) {
    try {
      const c = await db('clientes').where('id', solicitacao.clienteId).first();
      if (c) {
        cliente = {
          id: c.id,
          razaoSocial: c.razao_social || c.nome_fantasia,
          documento: c.documento,
          email: c.email || c.responsavel_email,
          telefone: c.telefone || c.celular,
          status: c.status,
          cidade: c.cidade,
          estado: c.estado,
        };
      }
    } catch (_) {}
  }

  return {
    ok: true,
    solicitacao,
    respostas,
    anexos,
    cliente,
    statusOptions: STATUS_VALIDOS.map((value) => ({ value, label: STATUS_LABELS[value] })),
  };
}

async function updateStatus(id, status, { usuarioId, observacoes } = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);

  const solicitacaoId = parseInt(id, 10);
  const novo = normalizeStatus(status);
  if (!STATUS_VALIDOS.includes(novo)) return { ok: false, error: 'Status inválido' };

  const row = await db('solicitacoes_cancelamento').where('id', solicitacaoId).first();
  if (!row) return { ok: false, error: 'Solicitação não encontrada' };

  const updates = { status: novo, updated_at: db.fn.now() };
  if (observacoes != null) updates.observacoes = String(observacoes);

  await db('solicitacoes_cancelamento').where('id', solicitacaoId).update(updates);

  try {
    await db('solicitacoes_cancelamento_respostas').insert({
      solicitacao_id: solicitacaoId,
      usuario_id: usuarioId || null,
      status_anterior: row.status,
      status_novo: novo,
      assunto: null,
      mensagem: `Status alterado para ${STATUS_LABELS[novo]}`,
      interno: 1,
      email_enviado: 0,
      created_at: db.fn.now(),
    });
  } catch (_) {}

  return getSolicitacao(solicitacaoId);
}

async function responderSolicitacao(id, opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);

  const solicitacaoId = parseInt(id, 10);
  const row = await db('solicitacoes_cancelamento').where('id', solicitacaoId).first();
  if (!row) return { ok: false, error: 'Solicitação não encontrada' };

  const solicitacao = mapRow(row);
  const mensagem = String(opts.mensagem || '').trim();
  if (!mensagem) return { ok: false, error: 'Informe a mensagem de resposta' };

  const statusNovo = opts.status ? normalizeStatus(opts.status) : normalizeStatus(row.status);
  if (!STATUS_VALIDOS.includes(statusNovo)) return { ok: false, error: 'Status inválido' };

  const assunto =
    String(opts.assunto || '').trim() ||
    `Atualização da solicitação ${solicitacao.protocolo || `#${solicitacao.id}`}`;
  const interno = opts.interno === true || opts.interno === 1 || opts.interno === '1';
  const enviarEmail = !interno && opts.enviarEmail !== false;
  const emailDestino = String(opts.emailDestino || solicitacao.email || '').trim();

  const [respostaId] = await db('solicitacoes_cancelamento_respostas').insert({
    solicitacao_id: solicitacaoId,
    usuario_id: opts.usuarioId || null,
    status_anterior: row.status,
    status_novo: statusNovo,
    assunto: interno ? null : assunto,
    mensagem,
    interno: interno ? 1 : 0,
    email_enviado: 0,
    email_destino: enviarEmail ? emailDestino : null,
    created_at: db.fn.now(),
  });

  const updates = {
    status: statusNovo,
    updated_at: db.fn.now(),
  };
  if (opts.observacoesInternas != null) {
    const prev = String(row.observacoes || '').trim();
    const extra = String(opts.observacoesInternas || '').trim();
    updates.observacoes = prev ? `${prev}\n\n[Resposta admin] ${extra}` : extra;
  }
  await db('solicitacoes_cancelamento').where('id', solicitacaoId).update(updates);

  const anexosSalvos = [];
  const anexosUpload = Array.isArray(opts.anexosUpload) ? opts.anexosUpload : [];
  for (const a of anexosUpload) {
    if (!a?.url) continue;
    try {
      const [anexoId] = await db('solicitacoes_cancelamento_anexos').insert({
        solicitacao_id: solicitacaoId,
        resposta_id: respostaId,
        usuario_id: opts.usuarioId || null,
        nome_original: a.nomeOriginal || 'anexo',
        mime_type: a.mimeType || null,
        tamanho: Number(a.tamanho) || 0,
        url: a.url,
        created_at: db.fn.now(),
      });
      anexosSalvos.push({
        id: anexoId,
        nomeOriginal: a.nomeOriginal || 'anexo',
        url: a.url,
      });
    } catch (e) {
      console.warn(`${LOG_PREFIX} Anexo falhou:`, e.message);
    }
  }

  const files = Array.isArray(opts.files) ? opts.files : [];
  for (const file of files) {
    try {
      const uploaded = await storageService.uploadFile(file, opts.req || {}, 'cancelamentos');
      const url = uploaded?.url || uploaded?.path || uploaded?.publicUrl;
      if (!url) continue;
      const [anexoId] = await db('solicitacoes_cancelamento_anexos').insert({
        solicitacao_id: solicitacaoId,
        resposta_id: respostaId,
        usuario_id: opts.usuarioId || null,
        nome_original: file.originalname || file.name || 'anexo',
        mime_type: file.mimetype || file.type || null,
        tamanho: file.size || 0,
        url,
        created_at: db.fn.now(),
      });
      anexosSalvos.push({
        id: anexoId,
        nomeOriginal: file.originalname || file.name || 'anexo',
        url,
      });
    } catch (e) {
      console.warn(`${LOG_PREFIX} Anexo falhou:`, e.message);
    }
  }

  let emailNotificacao = { enviado: false, motivo: interno ? 'nota_interna' : 'nao_solicitado' };

  if (enviarEmail) {
    if (!emailDestino) {
      emailNotificacao = { enviado: false, motivo: 'sem_email_destino' };
      await db('solicitacoes_cancelamento_respostas').where('id', respostaId).update({
        email_erro: 'Sem e-mail de destino',
      });
    } else {
      const html = buildRespostaEmailHtml({
        solicitacao,
        assunto,
        mensagem,
        statusNovo,
        anexos: anexosSalvos,
      });
      try {
        const envio = await emailService.send({
          to: emailDestino,
          subject: assunto,
          html,
          text: mensagem,
        });
        if (envio.ok) {
          emailNotificacao = {
            enviado: Boolean(envio.sent),
            simulado: Boolean(envio.skipped),
            para: emailDestino,
            messageId: envio.messageId,
          };
          await db('solicitacoes_cancelamento_respostas').where('id', respostaId).update({
            email_enviado: envio.sent ? 1 : 0,
            email_destino: emailDestino,
          });
        } else {
          emailNotificacao = {
            enviado: false,
            motivo: 'erro_envio',
            erro: envio.error || 'Falha ao enviar',
            para: emailDestino,
          };
          await db('solicitacoes_cancelamento_respostas').where('id', respostaId).update({
            email_erro: envio.error || 'Falha ao enviar',
            email_destino: emailDestino,
          });
        }
      } catch (e) {
        emailNotificacao = {
          enviado: false,
          motivo: 'erro_envio',
          erro: e.message,
          para: emailDestino,
        };
        await db('solicitacoes_cancelamento_respostas').where('id', respostaId).update({
          email_erro: e.message,
          email_destino: emailDestino,
        });
      }
    }
  }

  const detalhe = await getSolicitacao(solicitacaoId);
  return {
    ...detalhe,
    ok: true,
    respostaId,
    emailNotificacao,
    message: emailNotificacao.enviado
      ? `Resposta registrada e e-mail enviado para ${emailDestino}`
      : interno
        ? 'Nota interna registrada'
        : `Resposta registrada${emailNotificacao.motivo === 'sem_email_destino' ? ' (sem e-mail cadastrado)' : ''}`,
  };
}

module.exports = {
  STATUS_VALIDOS,
  STATUS_LABELS,
  normalizeStatus,
  ensureTables,
  listSolicitacoes,
  getSolicitacao,
  updateStatus,
  responderSolicitacao,
};
