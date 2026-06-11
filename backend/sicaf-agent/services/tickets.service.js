/**
 * Serviço de Tickets (Chamados de Suporte) — CadBrasil.
 *
 * CRUD de tickets + mensagens + anexos.
 * Clientes veem apenas seus tickets; admins veem todos.
 */
const { getDb } = require('../database/connection');
const emailService = require('./email.service');
const sanitizeHtml = require('sanitize-html');

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Gera código sequencial TK-001, TK-002, ... */
async function _nextCodigo(db) {
  const [row] = await db.raw("SELECT MAX(id) AS maxId FROM tickets");
  const nextId = (row[0]?.maxId || 0) + 1;
  return `TK-${String(nextId).padStart(3, '0')}`;
}

/** Calcula SLA prazo baseado na prioridade */
function _calcSLA(prioridade) {
  const horasMap = { alta: 4, media: 8, baixa: 24, urgente: 2 };
  const p = _normalizePrioridade(prioridade);
  const horas = horasMap[p] || 8;
  const prazo = new Date();
  prazo.setHours(prazo.getHours() + horas);
  return { prazo, minutos: horas * 60 };
}

const TICKET_CATEGORIAS_VALIDAS = new Set([
  'suporte',
  'bug',
  'melhoria',
  'financeiro',
  'sicaf',
  'outro',
]);

/** Mapeia ids/títulos da UI para ENUM `tickets.categoria`. */
function _normalizeCategoria(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'outro';

  const direct = s.toLowerCase();
  if (TICKET_CATEGORIAS_VALIDAS.has(direct)) return direct;

  const map = {
    sicaf: 'sicaf',
    documentos: 'suporte',
    pagamento: 'financeiro',
    tecnico: 'bug',
    ia: 'melhoria',
    outro: 'outro',
    'sicaf / cadastro': 'sicaf',
    'documentos & certidões': 'suporte',
    'documentos & certidoes': 'suporte',
    'pagamentos & faturas': 'financeiro',
    'problema técnico': 'bug',
    'problema tecnico': 'bug',
    'serviços com ia': 'melhoria',
    'servicos com ia': 'melhoria',
    'outro assunto': 'outro',
    'renovação sicaf': 'sicaf',
    'renovacao sicaf': 'sicaf',
    'atualização cadastral': 'sicaf',
    'atualizacao cadastral': 'sicaf',
    certidões: 'suporte',
    certidoes: 'suporte',
    financeiro: 'financeiro',
    procuração: 'suporte',
    procuracao: 'suporte',
    'suporte técnico': 'bug',
    'suporte tecnico': 'bug',
    outro: 'outro',
  };

  if (map[direct]) return map[direct];

  if (direct.includes('sicaf') || direct.includes('cadastro')) return 'sicaf';
  if (direct.includes('pag') || direct.includes('fatur') || direct.includes('boleto')) return 'financeiro';
  if (direct.includes('certid') || direct.includes('document')) return 'suporte';
  if (direct.includes('técnic') || direct.includes('tecnico') || direct.includes('bug')) return 'bug';
  if (direct.includes(' ia') || direct.includes('edital') || direct.includes('melhoria')) return 'melhoria';

  return 'outro';
}

function _normalizePrioridade(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (s === 'alta' || s === 'urgente') return s === 'urgente' ? 'urgente' : 'alta';
  if (s === 'media' || s === 'medio') return 'media';
  if (s === 'baixa') return 'baixa';
  return 'media';
}

function _fmtDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  const hours = String(dt.getHours()).padStart(2, '0');
  const mins = String(dt.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function _escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tags permitidas nas mensagens de ticket (alinhado ao editor TipTap + exibição). */
const TICKET_MSG_SANITIZE_OPTS = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'hr',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
  },
};

function _mensagemTemTextoUtil(raw) {
  const t = String(raw || '').trim();
  if (!t) return false;
  const plain = t
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 0;
}

/** Normaliza mensagem para gravar no banco (texto puro ou HTML sanitizado). */
function _normalizeMensagemParaArmazenar(raw) {
  const t = String(raw || '').trim();
  if (!_mensagemTemTextoUtil(t)) return '';
  if (/<[a-z][\s\S]*>/i.test(t)) {
    return sanitizeHtml(t, TICKET_MSG_SANITIZE_OPTS).trim();
  }
  return t;
}

/** Corpo do e-mail: HTML sanitizado ou texto convertido com quebras. */
function _mensagemParaCorpoEmail(stored) {
  const s = String(stored || '').trim();
  if (!s) return '';
  if (/<[a-z][\s\S]*>/i.test(s)) return s;
  return _mensagemParaTemplateHtml(s);
}

/** Rótulo amigável para o campo {{status}} do template de e-mail */
function _ticketStatusLabel(status) {
  const map = {
    aberto: 'Aberto',
    em_andamento: 'Em andamento',
    resolvido: 'Resolvido',
    fechado: 'Fechado',
  };
  return map[status] || status || '—';
}

/** Mensagem segura para HTML (template Ticket Atualizado — bloco .msg) */
function _mensagemParaTemplateHtml(text) {
  return _escapeHtml(text || '').replace(/\r\n/g, '\n').replace(/\n/g, '<br/>');
}

/**
 * Corpo HTML fixo quando o template "Ticket Atualizado" não existe ou sendTemplate falha.
 * `mensagemHtml` já vem sanitizada (_mensagemParaCorpoEmail).
 */
function _buildFallbackTicketReplyEmailHtml(params) {
  const {
    nome, codigo, titulo, status, autor_resposta, mensagemHtml, link_ticket, empresaNome,
  } = params;
  const esc = (v) => _escapeHtml(String(v ?? ''));
  const msgBlock = mensagemHtml || '';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;background:#f1f5f9;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);">
<tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:28px 24px;text-align:center;">
<div style="font-size:36px;line-height:1;">📩</div>
<h1 style="margin:12px 0 0;font-size:20px;color:#ffffff;font-weight:700;">Chamado atualizado</h1>
<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.9);">${esc(codigo)}</p>
</td></tr>
<tr><td style="padding:28px 24px;">
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Olá, <strong>${esc(nome)}</strong>.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">O suporte respondeu ao chamado <strong>${esc(titulo)}</strong>.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#475569;margin-bottom:20px;border-collapse:collapse;">
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;width:40%;">Status</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;">${esc(status)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">Respondido por</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;">${esc(autor_resposta)}</td></tr>
</table>
<div style="background:#f8fafc;border-radius:8px;padding:16px;border:1px solid #e2e8f0;font-size:14px;line-height:1.65;color:#1e293b;">${msgBlock}</div>
<p style="margin:24px 0 0;text-align:center;">
<a href="${esc(link_ticket)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Ver chamado</a>
</p>
</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">${esc(empresaNome)}</td></tr>
</table></td></tr></table></body></html>`;
}

function _fallbackTicketReplyPlainText(params) {
  const {
    nome, codigo, titulo, status, autor_resposta, mensagemSalva, link_ticket,
  } = params;
  const plainMsg = String(mensagemSalva || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [
    `Olá, ${nome}.`,
    '',
    `Seu chamado ${codigo} recebeu uma nova resposta.`,
    `Título: ${titulo}`,
    `Status: ${status}`,
    `Respondido por: ${autor_resposta}`,
    '',
    plainMsg,
    '',
    `Acompanhe em: ${link_ticket}`,
  ].join('\n');
}

const MAX_EMAIL_ATTACH_BYTES = 12 * 1024 * 1024;

async function _resolverEmailDestinatarioTicket(db, ticket) {
  let destinatarioEmail = '';
  let destinatarioNome = '';
  if (ticket.cliente_id) {
    const client = await db('clientes')
      .where('id', ticket.cliente_id)
      .select('razao_social', 'email')
      .first();
    destinatarioEmail = (client?.email || '').trim();
    destinatarioNome = client?.razao_social || '';
  }
  if (!destinatarioEmail && ticket.criado_por) {
    const userCriador = await db('usuarios')
      .where('id', ticket.criado_por)
      .select('nome', 'email')
      .first();
    destinatarioEmail = (userCriador?.email || '').trim();
    destinatarioNome = destinatarioNome || userCriador?.nome || '';
  }
  return { destinatarioEmail, destinatarioNome };
}

/** Baixa arquivos pela URL pública para anexar no nodemailer/Mailgun. */
async function _buffersParaAnexosEmail(anexoRows) {
  const attachments = [];
  for (const row of anexoRows) {
    const url = (row.url || '').trim();
    if (!url) continue;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) {
        console.warn('[Tickets][Email] HTTP', res.status, 'ao baixar anexo:', url.slice(0, 80));
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_EMAIL_ATTACH_BYTES) {
        console.warn('[Tickets][Email] Anexo ignorado no e-mail (limite 12MB):', row.nome_original);
        continue;
      }
      attachments.push({
        filename: String(row.nome_original || 'anexo').slice(0, 200),
        content: buf,
        contentType: row.mimetype || undefined,
      });
    } catch (e) {
      console.warn('[Tickets][Email] Falha ao baixar anexo:', url.slice(0, 80), e.message);
    }
  }
  return attachments;
}

function _logResultadoEmailTicket(ticketCodigoLog, destinatarioEmailLog, emailNotificacao) {
  if (emailNotificacao.enviado) {
    console.log(
      `[Tickets][Email] RESULTADO: ENVIADO | ticket=${ticketCodigoLog} | para=${destinatarioEmailLog || '—'} | messageId=${emailNotificacao.messageId || 'n/d'}${emailNotificacao.anexosNoEmail ? ` | anexos=${emailNotificacao.anexosNoEmail}` : ''}`
    );
  } else if (emailNotificacao.motivo === 'sem_email_destino') {
    console.warn(
      `[Tickets][Email] RESULTADO: NÃO ENVIADO | ticket=${ticketCodigoLog} | motivo=sem e-mail (cliente ou usuário criador sem e-mail cadastrado)`
    );
  } else if (emailNotificacao.motivo === 'aguardando_anexos') {
    console.log(`[Tickets][Email] Aguardando upload de anexos antes do envio | ticket=${ticketCodigoLog}`);
  } else {
    console.warn(
      `[Tickets][Email] RESULTADO: NÃO ENVIADO | ticket=${ticketCodigoLog} | para=${destinatarioEmailLog || '—'} | erro=${emailNotificacao.erro || 'desconhecido'}`
    );
  }
}

/**
 * Dispara e-mail "Ticket Atualizado" (ou fallback) ao cliente.
 * @param {object} params.attachments - Lista nodemailer [{ filename, content, contentType }]
 */
async function _enviarEmailAtualizacaoTicketCliente({
  ticket,
  mensagemSalva,
  statusLabel,
  nomeRemetente,
  nomeDestino,
  destinatarioEmail,
  attachments = [],
}) {
  const emailNotificacao = { enviado: false };
  const ticketCodigoLog = ticket.codigo || `TK-${String(ticket.id).padStart(3, '0')}`;
  const destinatarioEmailLog = (destinatarioEmail || '').trim();

  if (!destinatarioEmailLog) {
    emailNotificacao.motivo = 'sem_email_destino';
    _logResultadoEmailTicket(ticketCodigoLog, '', emailNotificacao);
    return emailNotificacao;
  }

  emailNotificacao.anexosNoEmail = attachments.length;

  try {
    const ticketCodigo = ticketCodigoLog;
    const baseUrl = (process.env.FRONTEND_URL || 'https://fornecedor.cadbrasil.com.br').replace(/\/$/, '');
    const linkTicket = `${baseUrl}/tickets-client/${encodeURIComponent(ticketCodigo)}`;
    const mensagemCorpo = _mensagemParaCorpoEmail(mensagemSalva);
    const attachOpt = attachments.length ? attachments : undefined;

    console.log(
      `[Tickets][Email] Disparando template "Ticket Atualizado" | ticket=${ticketCodigo} | para=${destinatarioEmailLog}${attachments.length ? ` | anexos=${attachments.length}` : ''}`
    );

    let envioEmail = await emailService.sendTemplate('Ticket Atualizado', {
      to: destinatarioEmailLog,
      vars: {
        nome: nomeDestino || 'Cliente',
        codigo: ticketCodigo,
        titulo: ticket.titulo || '—',
        status: statusLabel,
        autor_resposta: nomeRemetente,
        mensagem: mensagemCorpo,
        link_ticket: linkTicket,
      },
      attachments: attachOpt,
    });

    if (!envioEmail.ok) {
      const erroTpl = envioEmail.error || 'Falha no template';
      console.warn('[Tickets][Email] Template falhou; tentando envio direto (fallback):', erroTpl);

      let empresaNome = 'CadBrasil';
      try {
        const mc = await emailService.getEmailConfig();
        empresaNome = mc.empresaNome || empresaNome;
      } catch (_) {}

      envioEmail = await emailService.send({
        to: destinatarioEmailLog,
        subject: `[${ticketCodigo}] Novo retorno no chamado`,
        html: _buildFallbackTicketReplyEmailHtml({
          nome: nomeDestino || 'Cliente',
          codigo: ticketCodigo,
          titulo: ticket.titulo || '—',
          status: statusLabel,
          autor_resposta: nomeRemetente,
          mensagemHtml: mensagemCorpo,
          link_ticket: linkTicket,
          empresaNome,
        }),
        text: _fallbackTicketReplyPlainText({
          nome: nomeDestino || 'Cliente',
          codigo: ticketCodigo,
          titulo: ticket.titulo || '—',
          status: statusLabel,
          autor_resposta: nomeRemetente,
          mensagemSalva,
          link_ticket: linkTicket,
        }),
        attachments: attachOpt,
      });

      if (envioEmail.ok) {
        emailNotificacao.viaFallback = true;
        emailNotificacao.erroTemplate = erroTpl;
        console.log('[Tickets][Email] Enviado com sucesso via fallback (sem template)');
      }
    }

    if (envioEmail.ok) {
      emailNotificacao.enviado = true;
      if (envioEmail.messageId) emailNotificacao.messageId = envioEmail.messageId;
    } else {
      emailNotificacao.erro = envioEmail.error || 'Falha ao enviar e-mail';
    }
  } catch (emailErr) {
    emailNotificacao.erro = emailErr.message;
  }

  _logResultadoEmailTicket(ticketCodigoLog, destinatarioEmailLog, emailNotificacao);
  return emailNotificacao;
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTAR TICKETS DO USUÁRIO
// ══════════════════════════════════════════════════════════════════════════════

async function listarTickets(usuarioId, opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let query = db('tickets as t')
      .leftJoin('clientes as c', 't.cliente_id', 'c.id')
      .leftJoin('usuarios as atribuido', 't.atribuido_a', 'atribuido.id')
      .select(
        't.*',
        'c.razao_social as cliente_nome',
        'c.documento as cliente_documento',
        'atribuido.nome as atribuido_nome'
      )
      .where('t.criado_por', usuarioId);

    if (opts.status && opts.status !== 'todos') {
      query = query.where('t.status', opts.status);
    }
    if (opts.search && opts.search.trim()) {
      const s = `%${opts.search.trim()}%`;
      query = query.where(function () {
        this.where('t.codigo', 'like', s)
          .orWhere('t.titulo', 'like', s)
          .orWhere('t.descricao', 'like', s)
          .orWhere('c.razao_social', 'like', s)
          .orWhere('c.documento', 'like', s);
      });
    }

    const tickets = await query.orderBy('t.created_at', 'desc');

    // Buscar contagens de mensagens em batch
    const ticketIds = tickets.map(t => t.id);
    let msgCounts = {};
    if (ticketIds.length > 0) {
      const counts = await db('ticket_mensagens')
        .whereIn('ticket_id', ticketIds)
        .select('ticket_id')
        .count('* as total')
        .groupBy('ticket_id');
      for (const c of counts) {
        msgCounts[c.ticket_id] = parseInt(c.total);
      }
    }

    const result = tickets.map(t => ({
      ..._mapTicket(t, msgCounts[t.id] || 0, t.atribuido_nome || ''),
      clienteNome: t.cliente_nome || '',
      clienteDocumento: t.cliente_documento || '',
    }));

    // Contagens por status (todas, sem filtro)
    const allCounts = await db('tickets').where('criado_por', usuarioId)
      .select('status').count('* as total').groupBy('status');
    const statusCounts = { todos: 0, aberto: 0, em_andamento: 0, resolvido: 0, fechado: 0 };
    for (const c of allCounts) {
      statusCounts[c.status] = parseInt(c.total);
      statusCounts.todos += parseInt(c.total);
    }

    return { ok: true, tickets: result, counts: statusCounts };
  } catch (e) {
    console.error('[Tickets] Erro listarTickets:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DETALHE DO TICKET (COM MENSAGENS E ANEXOS)
// ══════════════════════════════════════════════════════════════════════════════

async function getTicket(ticketId, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    // Aceitar busca por ID numérico ou código (TK-001)
    let ticket;
    if (/^\d+$/.test(String(ticketId))) {
      ticket = await db('tickets').where('id', ticketId).where('criado_por', usuarioId).first();
    } else {
      ticket = await db('tickets').where('codigo', ticketId).where('criado_por', usuarioId).first();
    }

    if (!ticket) return { ok: false, error: 'Ticket não encontrado' };

    // Mensagens
    const mensagens = await db('ticket_mensagens')
      .where('ticket_id', ticket.id)
      .orderBy('created_at', 'asc');

    // Anexos
    const anexos = await db('ticket_anexos')
      .where('ticket_id', ticket.id)
      .orderBy('created_at', 'asc');

    // Atribuído
    let assigneeName = '';
    if (ticket.atribuido_a) {
      const user = await db('usuarios').where('id', ticket.atribuido_a).select('nome').first();
      assigneeName = user?.nome || '';
    }

    return {
      ok: true,
      ticket: {
        ..._mapTicket(ticket, mensagens.length, assigneeName),
        messages: mensagens.map(m => ({
          id: m.id,
          sender: m.remetente_tipo,
          senderName: m.remetente_tipo === 'client' ? 'Você' : m.remetente_nome,
          message: m.mensagem,
          date: _fmtDate(m.created_at),
          anexos: anexos.filter(a => a.mensagem_id === m.id).map(_mapAnexo),
        })),
        anexos: anexos.filter(a => !a.mensagem_id).map(_mapAnexo),
      },
    };
  } catch (e) {
    console.error('[Tickets] Erro getTicket:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CRIAR TICKET
// ══════════════════════════════════════════════════════════════════════════════

async function criarTicket(usuarioId, dados) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    if (!dados.titulo || !dados.descricao || !dados.categoria || !dados.prioridade) {
      return { ok: false, error: 'Campos obrigatórios: titulo, descricao, categoria, prioridade' };
    }

    const codigo = await _nextCodigo(db);
    const sla = _calcSLA(dados.prioridade);
    const categoria = _normalizeCategoria(dados.categoria);
    const prioridade = _normalizePrioridade(dados.prioridade);

    const [id] = await db('tickets').insert({
      codigo,
      titulo: dados.titulo,
      descricao: dados.descricao,
      status: 'aberto',
      prioridade,
      categoria,
      criado_por: usuarioId,
      cliente_id: dados.clienteId || null,
      atribuido_a: null,
      sla_prazo: sla.prazo,
      sla_minutos_restantes: sla.minutos,
    });

    // Criar primeira mensagem (descrição do ticket)
    await db('ticket_mensagens').insert({
      ticket_id: id,
      remetente_tipo: 'client',
      remetente_nome: dados.nomeUsuario || 'Cliente',
      remetente_id: usuarioId,
      mensagem: dados.descricao,
    });

    console.log(`[Tickets] Ticket criado: ${codigo}, id=${id}, user=${usuarioId}, cliente=${dados.clienteId || 'N/A'}`);
    return { ok: true, id, codigo, message: 'Chamado aberto com sucesso!' };
  } catch (e) {
    console.error('[Tickets] Erro criarTicket:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// RESPONDER TICKET (NOVA MENSAGEM)
// ══════════════════════════════════════════════════════════════════════════════

async function responderTicket(ticketId, usuarioId, dados) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    // Aceitar busca por código ou ID
    let ticket;
    if (/^\d+$/.test(String(ticketId))) {
      ticket = await db('tickets').where('id', ticketId).where('criado_por', usuarioId).first();
    } else {
      ticket = await db('tickets').where('codigo', ticketId).where('criado_por', usuarioId).first();
    }

    if (!ticket) return { ok: false, error: 'Ticket não encontrado' };

    if (['resolvido', 'fechado'].includes(ticket.status)) {
      return { ok: false, error: 'Este ticket já está encerrado. Abra um novo chamado.' };
    }

    const mensagemSalva = _normalizeMensagemParaArmazenar(dados.mensagem);
    if (!mensagemSalva) {
      return { ok: false, error: 'Mensagem não pode ser vazia' };
    }

    const [msgId] = await db('ticket_mensagens').insert({
      ticket_id: ticket.id,
      remetente_tipo: 'client',
      remetente_nome: dados.nomeUsuario || 'Cliente',
      remetente_id: usuarioId,
      mensagem: mensagemSalva,
    });

    // Atualizar updated_at do ticket
    await db('tickets').where('id', ticket.id).update({ updated_at: db.fn.now() });

    console.log(`[Tickets] Resposta enviada: ticket=${ticket.codigo}, msgId=${msgId}`);
    return {
      ok: true,
      mensagem: {
        id: msgId,
        sender: 'client',
        senderName: 'Você',
        message: mensagemSalva,
        date: _fmtDate(new Date()),
        anexos: [],
      },
    };
  } catch (e) {
    console.error('[Tickets] Erro responderTicket:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADICIONAR ANEXO
// ══════════════════════════════════════════════════════════════════════════════

async function adicionarAnexo(ticketId, usuarioId, fileInfo, mensagemId = null) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    // Validar ticket pertence ao usuário
    let ticket;
    if (/^\d+$/.test(String(ticketId))) {
      ticket = await db('tickets').where('id', ticketId).where('criado_por', usuarioId).first();
    } else {
      ticket = await db('tickets').where('codigo', ticketId).where('criado_por', usuarioId).first();
    }

    if (!ticket) return { ok: false, error: 'Ticket não encontrado' };

    const [id] = await db('ticket_anexos').insert({
      ticket_id: ticket.id,
      mensagem_id: mensagemId || null,
      nome_original: fileInfo.originalName || fileInfo.originalname || 'arquivo',
      url: fileInfo.fullUrl || fileInfo.url || '',
      tamanho: fileInfo.size || 0,
      mimetype: fileInfo.mimetype || '',
      enviado_por: usuarioId,
    });

    console.log(`[Tickets] Anexo adicionado: ticket=${ticket.codigo}, file=${fileInfo.originalName || fileInfo.originalname}`);
    return {
      ok: true,
      anexo: {
        id,
        nomeOriginal: fileInfo.originalName || fileInfo.originalname,
        url: fileInfo.fullUrl || fileInfo.url,
        tamanho: fileInfo.size || 0,
        mimetype: fileInfo.mimetype || '',
      },
    };
  } catch (e) {
    console.error('[Tickets] Erro adicionarAnexo:', e.message);
    return { ok: false, error: e.message };
  }
}

// ── Mappers ──

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: ADICIONAR ANEXO (SEM FILTRO POR criado_por)
// ══════════════════════════════════════════════════════════════════════════════

async function adicionarAnexoAdmin(ticketId, usuarioId, fileInfo, mensagemId = null) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let ticket;
    if (/^\d+$/.test(String(ticketId))) {
      ticket = await db('tickets').where('id', ticketId).first();
    } else {
      ticket = await db('tickets').where('codigo', ticketId).first();
    }

    if (!ticket) return { ok: false, error: 'Ticket não encontrado' };

    const [id] = await db('ticket_anexos').insert({
      ticket_id: ticket.id,
      mensagem_id: mensagemId || null,
      nome_original: fileInfo.originalName || fileInfo.originalname || 'arquivo',
      url: fileInfo.fullUrl || fileInfo.url || '',
      tamanho: fileInfo.size || 0,
      mimetype: fileInfo.mimetype || '',
      enviado_por: usuarioId,
    });

    console.log(`[Tickets] Admin anexo adicionado: ticket=${ticket.codigo}, file=${fileInfo.originalName || fileInfo.originalname}`);
    return {
      ok: true,
      anexo: {
        id,
        nomeOriginal: fileInfo.originalName || fileInfo.originalname,
        url: fileInfo.fullUrl || fileInfo.url,
        tamanho: fileInfo.size || 0,
        mimetype: fileInfo.mimetype || '',
      },
    };
  } catch (e) {
    console.error('[Tickets] Erro adicionarAnexoAdmin:', e.message);
    return { ok: false, error: e.message };
  }
}

function _mapTicket(t, msgCount = 0, assigneeName = '') {
  return {
    id: t.codigo || `TK-${String(t.id).padStart(3, '0')}`,
    dbId: t.id,
    title: t.titulo,
    description: t.descricao || '',
    status: t.status,
    priority: t.prioridade,
    category: t.categoria,
    createdAt: _fmtDate(t.created_at),
    updatedAt: _fmtDate(t.updated_at),
    assignee: assigneeName || 'Não atribuído',
    messageCount: msgCount,
  };
}

function _mapAnexo(a) {
  return {
    id: a.id,
    nomeOriginal: a.nome_original,
    url: a.url,
    tamanho: a.tamanho,
    mimetype: a.mimetype,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: LISTAR TODOS OS TICKETS
// ══════════════════════════════════════════════════════════════════════════════

async function listarTicketsAdmin(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let query = db('tickets as t')
      .leftJoin('usuarios as criador', 't.criado_por', 'criador.id')
      .leftJoin('usuarios as atribuido', 't.atribuido_a', 'atribuido.id')
      .leftJoin('clientes as c', 't.cliente_id', 'c.id')
      .select(
        't.*',
        'criador.nome as criador_nome',
        'atribuido.nome as atribuido_nome',
        'c.razao_social as cliente_nome'
      );

    if (opts.status && opts.status !== 'todos') {
      query = query.where('t.status', opts.status);
    }
    if (opts.clienteId) {
      query = query.where('t.cliente_id', opts.clienteId);
    }
    if (opts.search && opts.search.trim()) {
      const s = `%${opts.search.trim()}%`;
      query = query.where(function () {
        this.where('t.codigo', 'like', s)
          .orWhere('t.titulo', 'like', s)
          .orWhere('t.descricao', 'like', s)
          .orWhere('c.razao_social', 'like', s);
      });
    }

    const tickets = await query.orderBy('t.created_at', 'desc');

    // Contagens de mensagens em batch
    const ticketIds = tickets.map(t => t.id);
    let msgCounts = {};
    if (ticketIds.length > 0) {
      const counts = await db('ticket_mensagens')
        .whereIn('ticket_id', ticketIds)
        .select('ticket_id')
        .count('* as total')
        .groupBy('ticket_id');
      for (const c of counts) {
        msgCounts[c.ticket_id] = parseInt(c.total);
      }
    }

    // Verificar última mensagem de cada ticket (aguardando resposta do suporte)
    let lastMsgByTicket = {};
    if (ticketIds.length > 0) {
      const lastMsgs = await db('ticket_mensagens as tm')
        .join(
          db.raw('(SELECT ticket_id, MAX(id) as max_id FROM ticket_mensagens WHERE ticket_id IN (' + ticketIds.map(() => '?').join(',') + ') GROUP BY ticket_id) as latest', ticketIds),
          function () {
            this.on('tm.ticket_id', '=', 'latest.ticket_id').andOn('tm.id', '=', 'latest.max_id');
          }
        )
        .select('tm.ticket_id', 'tm.remetente_tipo');
      for (const m of lastMsgs) {
        lastMsgByTicket[m.ticket_id] = m.remetente_tipo;
      }
    }

    // Calcular SLA em tempo real
    const result = tickets.map(t => {
      let slaMinutes = 0;
      if (t.sla_prazo && (t.status === 'aberto' || t.status === 'em_andamento')) {
        slaMinutes = Math.round((new Date(t.sla_prazo).getTime() - Date.now()) / 60000);
      } else {
        slaMinutes = t.sla_minutos_restantes || 0;
      }

      // Ticket aguarda resposta se a última mensagem foi do cliente
      const ultimoRemetente = lastMsgByTicket[t.id] || null;
      const aguardandoResposta = ultimoRemetente === 'client' && (t.status === 'aberto' || t.status === 'em_andamento');

      return {
        id: t.codigo || `TK-${String(t.id).padStart(3, '0')}`,
        dbId: t.id,
        title: t.titulo,
        description: t.descricao || '',
        status: t.status,
        priority: t.prioridade,
        category: t.categoria,
        client: t.cliente_nome || t.criador_nome || 'Desconhecido',
        assignee: t.atribuido_nome || 'Não atribuído',
        createdAt: _fmtDate(t.created_at),
        slaDeadline: _fmtDate(t.sla_prazo),
        slaMinutes,
        messages: msgCounts[t.id] || 0,
        aguardandoResposta,
      };
    });

    // Contagens por status (sem filtro)
    const allCounts = await db('tickets')
      .select('status')
      .count('* as total')
      .groupBy('status');
    const counts = { todos: 0, aberto: 0, em_andamento: 0, resolvido: 0, fechado: 0 };
    for (const c of allCounts) {
      counts[c.status] = parseInt(c.total);
      counts.todos += parseInt(c.total);
    }

    return { ok: true, tickets: result, counts };
  } catch (e) {
    console.error('[Tickets] Erro listarTicketsAdmin:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: DETALHE DO TICKET (SEM FILTRO POR criado_por)
// ══════════════════════════════════════════════════════════════════════════════

async function getTicketAdmin(ticketId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let ticket;
    if (/^\d+$/.test(String(ticketId))) {
      ticket = await db('tickets').where('id', ticketId).first();
    } else {
      ticket = await db('tickets').where('codigo', ticketId).first();
    }
    if (!ticket) return { ok: false, error: 'Ticket não encontrado' };

    // Mensagens
    const mensagens = await db('ticket_mensagens')
      .where('ticket_id', ticket.id)
      .orderBy('created_at', 'asc');

    // Anexos
    const anexos = await db('ticket_anexos')
      .where('ticket_id', ticket.id)
      .orderBy('created_at', 'asc');

    // Atribuído e criador
    let assigneeName = '';
    if (ticket.atribuido_a) {
      const user = await db('usuarios').where('id', ticket.atribuido_a).select('nome').first();
      assigneeName = user?.nome || '';
    }
    let creatorName = '';
    if (ticket.criado_por) {
      const user = await db('usuarios').where('id', ticket.criado_por).select('nome').first();
      creatorName = user?.nome || '';
    }
    let clientName = '';
    let clientDocumento = '';
    if (ticket.cliente_id) {
      const client = await db('clientes').where('id', ticket.cliente_id).select('razao_social', 'documento').first();
      clientName = client?.razao_social || '';
      clientDocumento = client?.documento || '';
    }

    // Calcular SLA em tempo real
    let slaMinutes = 0;
    if (ticket.sla_prazo && (ticket.status === 'aberto' || ticket.status === 'em_andamento')) {
      slaMinutes = Math.round((new Date(ticket.sla_prazo).getTime() - Date.now()) / 60000);
    } else {
      slaMinutes = ticket.sla_minutos_restantes || 0;
    }

    return {
      ok: true,
      ticket: {
        id: ticket.codigo || `TK-${String(ticket.id).padStart(3, '0')}`,
        dbId: ticket.id,
        title: ticket.titulo,
        description: ticket.descricao || '',
        status: ticket.status,
        priority: ticket.prioridade,
        category: ticket.categoria,
        client: clientName || creatorName || 'Desconhecido',
        clientDocumento: clientDocumento,
        assignee: assigneeName || 'Não atribuído',
        assigneeId: ticket.atribuido_a,
        createdAt: _fmtDate(ticket.created_at),
        updatedAt: _fmtDate(ticket.updated_at),
        slaDeadline: _fmtDate(ticket.sla_prazo),
        slaMinutes,
        messageCount: mensagens.length,
        messages: mensagens.map(m => ({
          id: m.id,
          sender: m.remetente_tipo,
          senderName: m.remetente_nome,
          message: m.mensagem,
          date: _fmtDate(m.created_at),
          anexos: anexos.filter(a => a.mensagem_id === m.id).map(_mapAnexo),
        })),
        anexos: anexos.filter(a => !a.mensagem_id).map(_mapAnexo),
      },
    };
  } catch (e) {
    console.error('[Tickets] Erro getTicketAdmin:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: RESPONDER COMO SUPORTE
// ══════════════════════════════════════════════════════════════════════════════

async function responderTicketAdmin(ticketId, usuarioId, dados) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let ticket;
    if (/^\d+$/.test(String(ticketId))) {
      ticket = await db('tickets').where('id', ticketId).first();
    } else {
      ticket = await db('tickets').where('codigo', ticketId).first();
    }
    if (!ticket) return { ok: false, error: 'Ticket não encontrado' };

    const mensagemSalva = _normalizeMensagemParaArmazenar(dados.mensagem);
    if (!mensagemSalva) {
      return { ok: false, error: 'Mensagem não pode ser vazia' };
    }

    const [msgId] = await db('ticket_mensagens').insert({
      ticket_id: ticket.id,
      remetente_tipo: 'support',
      remetente_nome: dados.nomeUsuario || 'Suporte',
      remetente_id: usuarioId,
      mensagem: mensagemSalva,
    });

    const statusAposResposta = ticket.status === 'aberto' ? 'em_andamento' : ticket.status;

    // Se está aberto, mover para em_andamento
    if (ticket.status === 'aberto') {
      await db('tickets').where('id', ticket.id).update({ status: 'em_andamento', updated_at: db.fn.now() });
    } else {
      await db('tickets').where('id', ticket.id).update({ updated_at: db.fn.now() });
    }

    const ticketCodigoLog = ticket.codigo || `TK-${String(ticket.id).padStart(3, '0')}`;
    const enviarEmailAgora = dados.enviarEmail !== false && dados.enviarEmail !== 'false';

    const { destinatarioEmail, destinatarioNome } = await _resolverEmailDestinatarioTicket(db, ticket);
    const nomeDestino = destinatarioNome || 'Cliente';
    const nomeRemetente = dados.nomeUsuario || 'Suporte CadBrasil';
    const statusLabel = _ticketStatusLabel(statusAposResposta);

    let emailNotificacao = { enviado: false };

    if (!enviarEmailAgora) {
      emailNotificacao = { enviado: false, motivo: 'aguardando_anexos' };
      _logResultadoEmailTicket(ticketCodigoLog, destinatarioEmail, emailNotificacao);
    } else {
      emailNotificacao = await _enviarEmailAtualizacaoTicketCliente({
        ticket,
        mensagemSalva,
        statusLabel,
        nomeRemetente,
        nomeDestino,
        destinatarioEmail,
        attachments: [],
      });
    }

    console.log(`[Tickets] Admin resposta: ticket=${ticket.codigo}, msgId=${msgId}`);
    return {
      ok: true,
      mensagem: {
        id: msgId,
        sender: 'support',
        senderName: dados.nomeUsuario || 'Suporte',
        message: mensagemSalva,
        date: _fmtDate(new Date()),
        anexos: [],
      },
      emailNotificacao,
    };
  } catch (e) {
    console.error('[Tickets] Erro responderTicketAdmin:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Envia ao cliente o e-mail de "ticket atualizado" depois que os anexos da mensagem foram gravados.
 * Usado quando a resposta foi salva com enviarEmail=false e arquivos foram ligados a mensagem_id.
 */
async function enviarNotificacaoEmailRespostaTicketAdmin(ticketId, mensagemId, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let ticket;
    if (/^\d+$/.test(String(ticketId))) {
      ticket = await db('tickets').where('id', ticketId).first();
    } else {
      ticket = await db('tickets').where('codigo', ticketId).first();
    }
    if (!ticket) return { ok: false, error: 'Ticket não encontrado' };

    const msg = await db('ticket_mensagens')
      .where({ id: mensagemId, ticket_id: ticket.id })
      .first();
    if (!msg) return { ok: false, error: 'Mensagem não encontrada neste ticket' };
    if (msg.remetente_tipo !== 'support') {
      return { ok: false, error: 'Somente respostas do suporte disparam este e-mail ao cliente.' };
    }

    const anexoRows = await db('ticket_anexos').where('mensagem_id', mensagemId);
    const attachments = await _buffersParaAnexosEmail(anexoRows);

    const { destinatarioEmail, destinatarioNome } = await _resolverEmailDestinatarioTicket(db, ticket);
    const nomeDestino = destinatarioNome || 'Cliente';
    const nomeRemetente = msg.remetente_nome || 'Suporte';

    const ticketFresh = await db('tickets').where('id', ticket.id).first();
    const statusLabel = _ticketStatusLabel(ticketFresh.status);

    const emailNotificacao = await _enviarEmailAtualizacaoTicketCliente({
      ticket: ticketFresh,
      mensagemSalva: msg.mensagem,
      statusLabel,
      nomeRemetente,
      nomeDestino,
      destinatarioEmail,
      attachments,
    });

    console.log(`[Tickets] Notificação e-mail (pós-anexos): ticket=${ticket.codigo}, msgId=${mensagemId}, user=${usuarioId}`);
    return { ok: true, emailNotificacao };
  } catch (e) {
    console.error('[Tickets] Erro enviarNotificacaoEmailRespostaTicketAdmin:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: ATUALIZAR STATUS / ATRIBUIÇÃO
// ══════════════════════════════════════════════════════════════════════════════

async function atualizarTicket(ticketId, dados) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let ticket;
    if (/^\d+$/.test(String(ticketId))) {
      ticket = await db('tickets').where('id', ticketId).first();
    } else {
      ticket = await db('tickets').where('codigo', ticketId).first();
    }
    if (!ticket) return { ok: false, error: 'Ticket não encontrado' };

    const updates = {};
    if (dados.status) updates.status = dados.status;
    if (dados.atribuido_a !== undefined) updates.atribuido_a = dados.atribuido_a || null;
    if (dados.prioridade) updates.prioridade = dados.prioridade;
    updates.updated_at = db.fn.now();

    await db('tickets').where('id', ticket.id).update(updates);

    console.log(`[Tickets] Ticket ${ticket.codigo} atualizado:`, Object.keys(updates));
    return { ok: true, message: 'Ticket atualizado com sucesso!' };
  } catch (e) {
    console.error('[Tickets] Erro atualizarTicket:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: CRIAR TICKET (COM CLIENTE E ATRIBUIÇÃO)
// ══════════════════════════════════════════════════════════════════════════════

async function criarTicketAdmin(usuarioId, dados) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    if (!dados.titulo || !dados.descricao || !dados.categoria || !dados.prioridade) {
      return { ok: false, error: 'Campos obrigatórios: titulo, descricao, categoria, prioridade' };
    }

    const codigo = await _nextCodigo(db);
    const sla = _calcSLA(dados.prioridade);
    const categoria = _normalizeCategoria(dados.categoria);
    const prioridade = _normalizePrioridade(dados.prioridade);

    const [id] = await db('tickets').insert({
      codigo,
      titulo: dados.titulo,
      descricao: dados.descricao,
      status: 'aberto',
      prioridade,
      categoria,
      criado_por: usuarioId,
      cliente_id: dados.clienteId || null,
      atribuido_a: dados.atribuidoA || null,
      sla_prazo: sla.prazo,
      sla_minutos_restantes: sla.minutos,
    });

    // Criar primeira mensagem
    await db('ticket_mensagens').insert({
      ticket_id: id,
      remetente_tipo: 'support',
      remetente_nome: dados.nomeUsuario || 'Admin',
      remetente_id: usuarioId,
      mensagem: dados.descricao,
    });

    console.log(`[Tickets] Admin ticket criado: ${codigo}, id=${id}`);
    return { ok: true, id, codigo, message: 'Ticket criado com sucesso!' };
  } catch (e) {
    console.error('[Tickets] Erro criarTicketAdmin:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  listarTickets,
  getTicket,
  criarTicket,
  responderTicket,
  adicionarAnexo,
  listarTicketsAdmin,
  getTicketAdmin,
  responderTicketAdmin,
  enviarNotificacaoEmailRespostaTicketAdmin,
  atualizarTicket,
  criarTicketAdmin,
  adicionarAnexoAdmin,
};
