/**
 * Suporte remoto — sessões com código, chat e signaling WebRTC P2P.
 * O cliente compartilha a tela via getDisplayMedia; o atendente apenas visualiza.
 */
const { getDb } = require('../database/connection');

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const ONLINE_MS = 12_000;

let tablesReady = false;

function nowSql() {
  return new Date();
}

function formatCode(digits) {
  const d = String(digits || '').replace(/\D/g, '').slice(0, 6);
  if (d.length !== 6) return d;
  return `${d.slice(0, 3)} ${d.slice(3)}`;
}

function normalizeCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function ensureTables(db) {
  if (tablesReady) return;
  const hasSessoes = await db.schema.hasTable('suporte_remoto_sessoes');
  if (!hasSessoes) {
    await db.schema.createTable('suporte_remoto_sessoes', (t) => {
      t.bigIncrements('id').primary();
      t.string('codigo', 6).notNullable();
      t.bigInteger('cliente_id').unsigned().notNullable();
      t.string('cliente_nome', 180).nullable();
      t.bigInteger('atendente_id').unsigned().nullable();
      t.string('atendente_nome', 180).nullable();
      t.string('status', 40).notNullable().defaultTo('waiting_attendant');
      t.string('resolucao', 40).nullable();
      t.string('webrtc_state', 40).nullable();
      t.datetime('cliente_visto_em').nullable();
      t.datetime('atendente_visto_em').nullable();
      t.datetime('connected_at').nullable();
      t.datetime('sharing_at').nullable();
      t.datetime('sharing_started_at').nullable();
      t.integer('sharing_seconds').unsigned().notNullable().defaultTo(0);
      t.integer('duracao_segundos').unsigned().nullable();
      t.string('ended_by', 20).nullable();
      t.datetime('ended_at').nullable();
      t.datetime('expires_at').nullable();
      t.timestamps(true, true);
      t.index(['codigo']);
      t.index(['status']);
      t.index(['cliente_id']);
    });
  }

  const hasSinais = await db.schema.hasTable('suporte_remoto_sinais');
  if (!hasSinais) {
    await db.schema.createTable('suporte_remoto_sinais', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('sessao_id').unsigned().notNullable().index();
      t.string('remetente', 20).notNullable();
      t.string('tipo', 20).notNullable();
      t.text('payload').notNullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  const hasMsgs = await db.schema.hasTable('suporte_remoto_mensagens');
  if (!hasMsgs) {
    await db.schema.createTable('suporte_remoto_mensagens', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('sessao_id').unsigned().notNullable().index();
      t.string('remetente', 20).notNullable();
      t.string('remetente_nome', 180).nullable();
      t.text('texto').notNullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  await ensureColumn(db, 'suporte_remoto_sessoes', 'sharing_started_at', (t) => {
    t.datetime('sharing_started_at').nullable();
  });
  await ensureColumn(db, 'suporte_remoto_sessoes', 'sharing_seconds', (t) => {
    t.integer('sharing_seconds').unsigned().notNullable().defaultTo(0);
  });
  await ensureColumn(db, 'suporte_remoto_sessoes', 'duracao_segundos', (t) => {
    t.integer('duracao_segundos').unsigned().nullable();
  });
  await ensureColumn(db, 'suporte_remoto_sessoes', 'ended_by', (t) => {
    t.string('ended_by', 20).nullable();
  });

  tablesReady = true;
}

async function ensureColumn(db, table, column, alterFn) {
  const has = await db.schema.hasColumn(table, column);
  if (!has) await db.schema.alterTable(table, alterFn);
}

function ts(value) {
  if (!value) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function secondsBetween(from, to) {
  const a = ts(from);
  const b = ts(to);
  if (!a || !b || b <= a) return 0;
  return Math.max(0, Math.round((b - a) / 1000));
}

function formatDuration(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function flushSharingSeconds(row, at = nowSql()) {
  const current = Number(row.sharing_seconds || 0) || 0;
  const started = row.sharing_started_at || (row.status === 'sharing' ? row.sharing_at : null);
  return current + secondsBetween(started, at);
}

async function getUsuarioNome(db, usuarioId) {
  if (!usuarioId) return null;
  const row = await db('usuarios').where('id', usuarioId).select('nome').first();
  return row?.nome || null;
}

function isOnline(ts) {
  if (!ts) return false;
  const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
  return Number.isFinite(t) && Date.now() - t < ONLINE_MS;
}

function mapSessao(row, extras = {}) {
  if (!row) return null;
  const status = row.status || 'waiting_attendant';
  return {
    id: Number(row.id),
    codigo: row.codigo,
    codigoFormatado: formatCode(row.codigo),
    clienteId: Number(row.cliente_id),
    clienteNome: row.cliente_nome || 'Cliente',
    atendenteId: row.atendente_id ? Number(row.atendente_id) : null,
    atendenteNome: row.atendente_nome || null,
    status,
    resolucao: row.resolucao || null,
    webrtcState: row.webrtc_state || null,
    clienteOnline: isOnline(row.cliente_visto_em),
    atendenteOnline: isOnline(row.atendente_visto_em),
    connectedAt: row.connected_at || null,
    sharingAt: row.sharing_at || null,
    sharingStartedAt: row.sharing_started_at || null,
    sharingSeconds: Number(row.sharing_seconds || 0) || 0,
    duracaoSegundos: row.duracao_segundos != null ? Number(row.duracao_segundos) : null,
    endedBy: row.ended_by || null,
    endedAt: row.ended_at || null,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at || null,
    ...extras,
  };
}

function parsePayload(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

async function expireStale(db) {
  const stale = await db('suporte_remoto_sessoes')
    .whereNot('status', 'ended')
    .whereNotNull('expires_at')
    .where('expires_at', '<', nowSql());
  const endedAt = nowSql();
  for (const row of stale) {
    await db('suporte_remoto_sessoes').where('id', row.id).update({
      status: 'ended',
      ended_by: 'expiracao',
      ended_at: endedAt,
      sharing_seconds: flushSharingSeconds(row, endedAt),
      sharing_started_at: null,
      duracao_segundos: secondsBetween(row.connected_at || row.created_at, endedAt),
      updated_at: endedAt,
    });
  }
}

async function loadSessao(db, id) {
  return db('suporte_remoto_sessoes').where('id', id).first();
}

function canAccess(row, usuarioId, role) {
  if (!row) return false;
  if (role === 'cliente') return Number(row.cliente_id) === Number(usuarioId);
  if (role === 'atendente') {
    if (!row.atendente_id) return true;
    return Number(row.atendente_id) === Number(usuarioId);
  }
  return false;
}

async function criarSessao(usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);
  await expireStale(db);

  const ativa = await db('suporte_remoto_sessoes')
    .where('cliente_id', usuarioId)
    .whereNot('status', 'ended')
    .orderBy('id', 'desc')
    .first();
  if (ativa) {
    await db('suporte_remoto_sessoes').where('id', ativa.id).update({
      cliente_visto_em: nowSql(),
      updated_at: nowSql(),
    });
    const fresh = await loadSessao(db, ativa.id);
    return { ok: true, sessao: mapSessao(fresh) };
  }

  const nome = await getUsuarioNome(db, usuarioId);
  let codigo = randomCode();
  for (let i = 0; i < 12; i += 1) {
    const clash = await db('suporte_remoto_sessoes')
      .where({ codigo })
      .whereNot('status', 'ended')
      .first();
    if (!clash) break;
    codigo = randomCode();
  }

  const expires = new Date(Date.now() + SESSION_TTL_MS);
  const [id] = await db('suporte_remoto_sessoes').insert({
    codigo,
    cliente_id: usuarioId,
    cliente_nome: nome || 'Cliente',
    status: 'waiting_attendant',
    cliente_visto_em: nowSql(),
    expires_at: expires,
    created_at: nowSql(),
    updated_at: nowSql(),
  });

  const row = await loadSessao(db, id);
  return { ok: true, sessao: mapSessao(row) };
}

async function entrarComoAtendente(usuarioId, codigoRaw) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);
  await expireStale(db);

  const codigo = normalizeCode(codigoRaw);
  if (codigo.length !== 6) {
    return { ok: false, error: 'Informe o código de 6 dígitos exibido na tela do cliente.' };
  }

  const row = await db('suporte_remoto_sessoes')
    .where({ codigo })
    .whereNot('status', 'ended')
    .orderBy('id', 'desc')
    .first();
  if (!row) return { ok: false, error: 'Código inválido ou atendimento já encerrado.' };

  if (row.atendente_id && Number(row.atendente_id) !== Number(usuarioId)) {
    return { ok: false, error: 'Este atendimento já está com outro atendente.' };
  }

  const nome = await getUsuarioNome(db, usuarioId);
  const updates = {
    atendente_id: usuarioId,
    atendente_nome: nome || 'Atendente',
    atendente_visto_em: nowSql(),
    updated_at: nowSql(),
  };
  if (!row.atendente_id || row.status === 'waiting_attendant') {
    updates.status = row.status === 'sharing' ? 'sharing' : 'attendant_joined';
    updates.connected_at = row.connected_at || nowSql();
  }

  await db('suporte_remoto_sessoes').where('id', row.id).update(updates);
  const fresh = await loadSessao(db, row.id);
  return { ok: true, sessao: mapSessao(fresh) };
}

async function pollSessao(usuarioId, sessaoId, opts = {}, role) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);

  const row = await loadSessao(db, sessaoId);
  if (!row) return { ok: false, error: 'Atendimento não encontrado.' };
  if (!canAccess(row, usuarioId, role)) {
    return { ok: false, error: 'Você não tem acesso a este atendimento.' };
  }

  const seenCol = role === 'atendente' ? 'atendente_visto_em' : 'cliente_visto_em';
  await db('suporte_remoto_sessoes').where('id', sessaoId).update({
    [seenCol]: nowSql(),
    updated_at: nowSql(),
  });

  const afterMessage = Number(opts.afterMessage || 0) || 0;
  const afterSignal = Number(opts.afterSignal || 0) || 0;

  const msgs = await db('suporte_remoto_mensagens')
    .where('sessao_id', sessaoId)
    .andWhere('id', '>', afterMessage)
    .orderBy('id', 'asc')
    .limit(200);

  const sinais = await db('suporte_remoto_sinais')
    .where('sessao_id', sessaoId)
    .andWhere('id', '>', afterSignal)
    .whereNot('remetente', role === 'atendente' ? 'atendente' : 'cliente')
    .orderBy('id', 'asc')
    .limit(200);

  const fresh = await loadSessao(db, sessaoId);
  return {
    ok: true,
    sessao: mapSessao(fresh),
    mensagens: msgs.map((m) => ({
      id: Number(m.id),
      remetente: m.remetente,
      remetenteNome: m.remetente_nome || (m.remetente === 'atendente' ? 'Atendente' : 'Cliente'),
      texto: m.texto,
      createdAt: m.created_at,
    })),
    sinais: sinais.map((s) => ({
      id: Number(s.id),
      remetente: s.remetente,
      tipo: s.tipo,
      payload: parsePayload(s.payload),
      createdAt: s.created_at,
    })),
  };
}

async function enviarMensagem(usuarioId, sessaoId, textoRaw, role) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);

  const texto = String(textoRaw || '').trim();
  if (!texto) return { ok: false, error: 'Digite uma mensagem.' };
  if (texto.length > 4000) return { ok: false, error: 'Mensagem muito longa.' };

  const row = await loadSessao(db, sessaoId);
  if (!row || row.status === 'ended') return { ok: false, error: 'Atendimento encerrado.' };
  if (!canAccess(row, usuarioId, role)) {
    return { ok: false, error: 'Você não tem acesso a este atendimento.' };
  }

  const nome =
    role === 'atendente'
      ? row.atendente_nome || (await getUsuarioNome(db, usuarioId)) || 'Atendente'
      : row.cliente_nome || (await getUsuarioNome(db, usuarioId)) || 'Cliente';

  const [id] = await db('suporte_remoto_mensagens').insert({
    sessao_id: sessaoId,
    remetente: role,
    remetente_nome: nome,
    texto,
    created_at: nowSql(),
  });

  const msg = await db('suporte_remoto_mensagens').where('id', id).first();
  return {
    ok: true,
    mensagem: {
      id: Number(msg.id),
      remetente: msg.remetente,
      remetenteNome: msg.remetente_nome,
      texto: msg.texto,
      createdAt: msg.created_at,
    },
  };
}

async function enviarSinal(usuarioId, sessaoId, dados, role) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);

  const tipo = String(dados?.tipo || '').toLowerCase();
  if (!['offer', 'answer', 'ice', 'pointer', 'click'].includes(tipo)) {
    return { ok: false, error: 'Sinal WebRTC inválido.' };
  }
  if (dados?.payload == null) return { ok: false, error: 'Payload do sinal ausente.' };

  const row = await loadSessao(db, sessaoId);
  if (!row || row.status === 'ended') return { ok: false, error: 'Atendimento encerrado.' };
  if (!canAccess(row, usuarioId, role)) {
    return { ok: false, error: 'Você não tem acesso a este atendimento.' };
  }

  await db('suporte_remoto_sinais').insert({
    sessao_id: sessaoId,
    remetente: role,
    tipo,
    payload: JSON.stringify(dados.payload),
    created_at: nowSql(),
  });

  const updates = { updated_at: nowSql() };
  if (tipo === 'offer' && role === 'cliente' && row.status !== 'ended') {
    updates.status = 'sharing';
    updates.sharing_at = row.sharing_at || nowSql();
    updates.sharing_started_at = row.sharing_started_at || nowSql();
    if (dados.resolucao) updates.resolucao = String(dados.resolucao).slice(0, 40);
    if (dados.webrtcState) updates.webrtc_state = String(dados.webrtcState).slice(0, 40);
  }
  if (dados.resolucao) updates.resolucao = String(dados.resolucao).slice(0, 40);
  if (dados.webrtcState) updates.webrtc_state = String(dados.webrtcState).slice(0, 40);

  await db('suporte_remoto_sessoes').where('id', sessaoId).update(updates);
  return { ok: true };
}

async function atualizarStatus(usuarioId, sessaoId, dados, role) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);

  const row = await loadSessao(db, sessaoId);
  if (!row) return { ok: false, error: 'Atendimento não encontrado.' };
  if (!canAccess(row, usuarioId, role)) {
    return { ok: false, error: 'Você não tem acesso a este atendimento.' };
  }

  const acao = String(dados?.acao || '').toLowerCase();
  const updates = { updated_at: nowSql() };

  if (acao === 'encerrar' || dados?.status === 'ended') {
    const endedAt = nowSql();
    updates.status = 'ended';
    updates.ended_at = endedAt;
    updates.ended_by = role;
    updates.sharing_seconds = flushSharingSeconds(row, endedAt);
    updates.sharing_started_at = null;
    updates.duracao_segundos = secondsBetween(row.connected_at || row.created_at, endedAt);
  } else if (acao === 'parar-compartilhamento') {
    if (row.status !== 'ended') {
      const stoppedAt = nowSql();
      updates.status = row.atendente_id ? 'attendant_joined' : 'waiting_attendant';
      updates.sharing_seconds = flushSharingSeconds(row, stoppedAt);
      updates.sharing_started_at = null;
      updates.webrtc_state = 'closed';
    }
  } else if (acao === 'compartilhando') {
    if (row.status !== 'ended') {
      updates.status = 'sharing';
      updates.sharing_at = row.sharing_at || nowSql();
      updates.sharing_started_at = row.sharing_started_at || nowSql();
    }
  }

  if (dados?.resolucao) updates.resolucao = String(dados.resolucao).slice(0, 40);
  if (dados?.webrtcState) updates.webrtc_state = String(dados.webrtcState).slice(0, 40);

  await db('suporte_remoto_sessoes').where('id', sessaoId).update(updates);
  const fresh = await loadSessao(db, sessaoId);
  return { ok: true, sessao: mapSessao(fresh) };
}

function formatDateTimeBR(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatChatTranscript(mensagens) {
  if (!mensagens?.length) return '';
  return mensagens
    .map((m) => {
      const when = formatDateTimeBR(m.created_at);
      const who = m.remetente_nome || (m.remetente === 'atendente' ? 'Atendente' : 'Cliente');
      const papel = m.remetente === 'atendente' ? 'atendente' : 'cliente';
      return `[${when}] ${who} (${papel}): ${m.texto || ''}`;
    })
    .join('\n');
}

async function listarSessoesRelatorio(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);
  await expireStale(db);

  const since = opts.since ? `${opts.since} 00:00:00` : null;
  const until = opts.until ? `${opts.until} 23:59:59` : null;
  const somenteConcluidos = opts.somenteConcluidos !== false;
  const comTela = String(opts.comTela || '').toLowerCase();

  let q = db('suporte_remoto_sessoes as s').select('s.*').orderBy('s.id', 'desc').limit(5000);
  if (somenteConcluidos) q = q.where('s.status', 'ended').whereNotNull('s.atendente_id');
  if (since) q = q.whereRaw('COALESCE(s.ended_at, s.created_at) >= ?', [since]);
  if (until) q = q.whereRaw('COALESCE(s.ended_at, s.created_at) <= ?', [until]);
  if (comTela === 'sim') q = q.where((b) => b.whereNotNull('s.sharing_at').orWhere('s.sharing_seconds', '>', 0));
  if (comTela === 'nao') q = q.whereNull('s.sharing_at').andWhere((b) => b.whereNull('s.sharing_seconds').orWhere('s.sharing_seconds', 0));

  const sessoes = await q;
  const ids = sessoes.map((s) => s.id);
  const msgsBySessao = new Map();
  if (ids.length) {
    const msgs = await db('suporte_remoto_mensagens')
      .whereIn('sessao_id', ids)
      .orderBy('id', 'asc');
    for (const m of msgs) {
      const list = msgsBySessao.get(m.sessao_id) || [];
      list.push(m);
      msgsBySessao.set(m.sessao_id, list);
    }
  }

  const rows = sessoes.map((s) => {
    const msgs = msgsBySessao.get(s.id) || [];
    const metrics = sessionMetrics(s);
    return {
      codigo: formatCode(s.codigo),
      cliente: s.cliente_nome || 'Cliente',
      atendente: s.atendente_nome || '—',
      iniciado_em: formatDateTimeBR(s.created_at),
      conectado_em: formatDateTimeBR(s.connected_at),
      compartilhou_em: formatDateTimeBR(s.sharing_at),
      encerrado_em: formatDateTimeBR(s.ended_at),
      tempo_atendimento: formatDuration(metrics.duracaoSegundos),
      tempo_tela: formatDuration(metrics.sharingSeconds),
      mensagens: msgs.length,
      resolucao: s.resolucao || '—',
      encerrado_por: endedByLabel(s.ended_by),
      status: statusLabel(s.status),
      conversa: formatChatTranscript(msgs),
    };
  });

  const lista = sessoes.map((s) => {
    const msgs = msgsBySessao.get(s.id) || [];
    return mapSessaoRelatorio(s, msgs, false);
  });

  return { ok: true, rows, sessoes: lista, total: rows.length };
}

function statusLabel(status) {
  const map = {
    waiting_attendant: 'Aguardando atendente',
    attendant_joined: 'Atendente conectado',
    sharing: 'Compartilhando tela',
    ended: 'Concluído',
  };
  return map[status] || status || '—';
}

function endedByLabel(value) {
  const map = {
    cliente: 'Cliente',
    atendente: 'Atendente',
    expiracao: 'Expiração automática',
  };
  return map[String(value || '')] || (value ? String(value) : '—');
}

function sessionMetrics(row) {
  const endedAt = row.ended_at || (row.status === 'ended' ? nowSql() : null);
  const duracao =
    row.duracao_segundos != null
      ? Number(row.duracao_segundos)
      : secondsBetween(row.connected_at || row.created_at, endedAt || nowSql());
  const tela =
    Number(row.sharing_seconds || 0) ||
    (row.sharing_at ? secondsBetween(row.sharing_at, endedAt || nowSql()) : 0);
  return { duracaoSegundos: duracao, sharingSeconds: tela };
}

function mapMensagemRelatorio(m) {
  return {
    id: Number(m.id),
    remetente: m.remetente,
    remetenteNome: m.remetente_nome || (m.remetente === 'atendente' ? 'Atendente' : 'Cliente'),
    texto: m.texto,
    createdAt: m.created_at,
    createdAtLabel: formatDateTimeBR(m.created_at),
  };
}

function mapSessaoRelatorio(row, mensagens = [], includeChat = true) {
  const metrics = sessionMetrics(row);
  const msgs = includeChat ? mensagens.map(mapMensagemRelatorio) : [];
  return {
    id: Number(row.id),
    codigo: row.codigo,
    codigoFormatado: formatCode(row.codigo),
    clienteId: Number(row.cliente_id),
    clienteNome: row.cliente_nome || 'Cliente',
    atendenteId: row.atendente_id ? Number(row.atendente_id) : null,
    atendenteNome: row.atendente_nome || null,
    status: row.status,
    statusLabel: statusLabel(row.status),
    resolucao: row.resolucao || null,
    webrtcState: row.webrtc_state || null,
    createdAt: row.created_at,
    connectedAt: row.connected_at,
    sharingAt: row.sharing_at,
    endedAt: row.ended_at,
    createdAtLabel: formatDateTimeBR(row.created_at),
    connectedAtLabel: formatDateTimeBR(row.connected_at),
    sharingAtLabel: formatDateTimeBR(row.sharing_at),
    endedAtLabel: formatDateTimeBR(row.ended_at),
    duracaoSegundos: metrics.duracaoSegundos,
    sharingSeconds: metrics.sharingSeconds,
    tempoAtendimento: formatDuration(metrics.duracaoSegundos),
    tempoTela: formatDuration(metrics.sharingSeconds),
    endedBy: row.ended_by || null,
    endedByLabel: endedByLabel(row.ended_by),
    mensagensCount: mensagens.length,
    compartilhou: !!(row.sharing_at || Number(row.sharing_seconds || 0)),
    mensagens: msgs,
    conversa: includeChat ? formatChatTranscript(mensagens) : '',
  };
}

async function getSessaoRelatorio(sessaoId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);

  const row = await loadSessao(db, sessaoId);
  if (!row) return { ok: false, error: 'Atendimento não encontrado.' };

  const msgs = await db('suporte_remoto_mensagens')
    .where('sessao_id', sessaoId)
    .orderBy('id', 'asc');

  return { ok: true, sessao: mapSessaoRelatorio(row, msgs, true) };
}

module.exports = {
  criarSessao,
  entrarComoAtendente,
  pollSessao,
  enviarMensagem,
  enviarSinal,
  atualizarStatus,
  listarSessoesRelatorio,
  getSessaoRelatorio,
  formatCode,
  normalizeCode,
  formatDuration,
};
