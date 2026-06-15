/**
 * Templates e envio de avisos por e-mail (admin → cliente).
 * Lista e preview a partir da tabela templates_email.
 */
const { getDb } = require('../database/connection');

function replaceVars(text, vars) {
  let out = String(text || '');
  for (const [key, value] of Object.entries(vars)) {
    const val = value != null ? String(value) : '';
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val);
    out = out.replace(new RegExp(`\\{${key}\\}`, 'gi'), val);
  }
  return out;
}

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function formatDateBr(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch (_) {
    return String(d);
  }
}

function mensagemAdicionalBlock(texto) {
  const t = String(texto || '').trim();
  if (!t) return '';
  return `<div style="margin:16px 0;padding:12px 16px;background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:4px"><p style="margin:0;font-size:14px"><strong>Observação:</strong> ${t.replace(/</g, '&lt;')}</p></div>`;
}

function injectMensagemAdicional(html, mensagemAdicional) {
  const block = mensagemAdicionalBlock(mensagemAdicional);
  if (!block) return html;
  const h = String(html || '');
  if (h.includes('</body>')) {
    return h.replace('</body>', `${block}</body>`);
  }
  return `${h}${block}`;
}

async function findTemplateById(db, templateDbId) {
  if (!db) return null;
  const id = parseInt(templateDbId, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  try {
    return (
      (await db('templates_email')
        .where('id', id)
        .whereRaw('COALESCE(ativo, 1) = 1')
        .first()) || null
    );
  } catch (_) {
    return null;
  }
}

async function loadClienteContext(db, clienteId) {
  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return null;

  let sicaf = null;
  try {
    sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
  } catch (_) {}

  let certidoes = [];
  try {
    certidoes = await db('certidoes as cert')
      .leftJoin('tipo_certidoes as tc', 'cert.tipo_certidao_id', 'tc.id')
      .where('cert.cliente_id', clienteId)
      .select(
        'cert.*',
        'tc.nome as tipo_nome',
        'tc.nivel_sicaf as tipo_nivel_sicaf',
      )
      .orderBy('cert.data_validade', 'asc');
  } catch (_) {}

  let taxas = [];
  try {
    taxas = await db('taxas_sicaf')
      .where('cliente_id', clienteId)
      .orderBy('created_at', 'desc');
  } catch (_) {}

  let propostas = [];
  try {
    propostas = await db('propostas as p')
      .leftJoin('licitacoes as l', 'p.licitacao_id', 'l.id')
      .where('p.cliente_id', clienteId)
      .select(
        'p.numero_proposta',
        'p.valor',
        'p.status',
        'p.created_at',
        'l.numero_processo',
        'l.nome_orgao',
        'l.objeto_resumido',
        'l.modalidade',
      )
      .orderBy('p.created_at', 'desc')
      .limit(5);
  } catch (_) {}

  return { cliente, sicaf, certidoes, taxas, propostas };
}

function buildVars(ctx, mensagemAdicional) {
  const { cliente, sicaf, certidoes, taxas, propostas } = ctx;
  const hoje = new Date();
  const portalBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cadbrasil.com.br';

  const pendingCert =
    certidoes.find((c) => {
      const s = String(c.status || '').toLowerCase();
      return s.includes('venc') || s.includes('pend');
    }) || certidoes[0] || null;

  const pendingPaid = new Set(['pago', 'aprovado', 'cancelada', 'cancelado', 'estornado']);
  const pendingTaxa =
    taxas
      .filter((t) => !pendingPaid.has(String(t.status || '').toLowerCase()))
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0] || null;

  const diasPendente = pendingTaxa?.created_at
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(pendingTaxa.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  const firstBid = propostas[0] || null;

  const vars = {
    nome: cliente.responsavel_nome || cliente.razao_social || 'Cliente',
    responsavel: cliente.responsavel_nome || cliente.razao_social || 'Cliente',
    empresa: cliente.razao_social || 'Sua empresa',
    razao_social: cliente.razao_social || 'Sua empresa',
    cnpj: cliente.documento || '',
    documento: cliente.documento || '',
    email: cliente.email || '',
    telefone: cliente.telefone || cliente.celular || '',
    certidao: pendingCert?.tipo_nome || 'Certidão pendente',
    certidao_nome: pendingCert?.tipo_nome || 'Certidão pendente',
    dias: String(pendingCert?.dias_restantes ?? 0),
    dias_vencimento: String(pendingCert?.dias_restantes ?? 0),
    data_vencimento: formatDateBr(pendingCert?.data_validade),
    nivel_sicaf: pendingCert?.nivel_sicaf || pendingCert?.tipo_nivel_sicaf || 'N/A',
    status: sicaf?.status || cliente.status || 'Pendente',
    data_validade: formatDateBr(sicaf?.data_validade),
    validade_sicaf: formatDateBr(sicaf?.data_validade),
    link_renovar: `${portalBase}/documentos`,
    link_documentos: `${portalBase}/documentos`,
    link_acesso: `${portalBase}/empresas`,
    link_painel: `${portalBase}/empresas`,
    link_boleto: `${portalBase}/empresas`,
    link_ticket: `${portalBase}/suporte`,
    link_licitacao: `${portalBase}/servicos`,
    numero_licitacao: firstBid?.numero_processo || firstBid?.numero_proposta || 'N/A',
    objeto: firstBid?.objeto_resumido || 'N/A',
    orgao: firstBid?.nome_orgao || 'N/A',
    modalidade: firstBid?.modalidade || 'N/A',
    valor_estimado: firstBid?.valor != null ? String(firstBid.valor) : '0,00',
    dias_pendente: String(diasPendente),
    dias_atraso: String(diasPendente),
    data_solicitacao: formatDateBr(pendingTaxa?.created_at),
    valor_taxa: pendingTaxa?.valor != null ? String(pendingTaxa.valor) : '0,00',
    ano_referencia: String(pendingTaxa?.ano_referencia || hoje.getFullYear()),
    valor: pendingTaxa?.valor != null ? String(pendingTaxa.valor) : '0,00',
    vencimento: formatDateBr(pendingTaxa?.data_vencimento),
    mes: String(hoje.getMonth() + 1).padStart(2, '0'),
    ano: String(hoje.getFullYear()),
    data_atual: hoje.toLocaleDateString('pt-BR'),
    data_geracao: hoje.toLocaleDateString('pt-BR'),
    empresa_nome: 'CADBRASIL',
    perfil: 'Cliente',
    plano: cliente.plano || 'Manutenção SICAF',
    mensagem_adicional: String(mensagemAdicional || '').trim(),
    mensagem_adicional_block: mensagemAdicionalBlock(mensagemAdicional),
  };

  return vars;
}

function renderTemplate(template, vars, mensagemAdicional, assuntoCustom) {
  let assunto = assuntoCustom || template.assunto || template.nome || 'Aviso CADBRASIL';
  let html = template.corpo_html || '<p>{{mensagem_adicional_block}}</p>';

  assunto = replaceVars(assunto, vars);
  html = replaceVars(html, vars);

  if (mensagemAdicional && !String(template.corpo_html || '').includes('mensagem_adicional')) {
    html = injectMensagemAdicional(html, mensagemAdicional);
  }

  return { assunto: assunto.trim(), html: html.trim() };
}

async function listAvisoTemplates() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível', templates: [] };

  try {
    const rows = await db('templates_email')
      .whereRaw('COALESCE(ativo, 1) = 1')
      .orderBy('nome', 'asc');

    return {
      ok: true,
      templates: rows.map((t) => ({
        id: t.id,
        codigo: t.codigo || null,
        nome: t.nome,
        assunto: t.assunto || '',
        descricao: (t.assunto || t.nome || '').slice(0, 120),
        variaveisDisponiveis: parseJsonArray(t.variaveis_disponiveis),
      })),
    };
  } catch (e) {
    console.error('[EmailAvisos] listAvisoTemplates:', e.message);
    return { ok: false, error: 'Erro ao listar templates', templates: [] };
  }
}

async function previewAviso({ templateDbId, clienteId, mensagemAdicional, assuntoCustom }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const template = await findTemplateById(db, templateDbId);
  if (!template) return { ok: false, error: 'Template não encontrado ou inativo' };

  const ctx = await loadClienteContext(db, clienteId);
  if (!ctx) return { ok: false, error: 'Cliente não encontrado' };

  const vars = buildVars(ctx, mensagemAdicional);
  const { assunto, html } = renderTemplate(template, vars, mensagemAdicional, assuntoCustom);

  return {
    ok: true,
    template: {
      id: template.id,
      nome: template.nome,
      variaveisDisponiveis: parseJsonArray(template.variaveis_disponiveis),
    },
    preview: { assunto, html, vars },
    destinatarioPadrao: ctx.cliente.email || null,
    cliente: {
      razao: ctx.cliente.razao_social,
      cnpj: ctx.cliente.documento,
      responsavel: ctx.cliente.responsavel_nome,
    },
  };
}

async function enviarAvisoCliente({
  clienteId,
  templateDbId,
  to,
  cc,
  mensagemAdicional,
  assuntoCustom,
  usuarioId,
}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const template = await findTemplateById(db, templateDbId);
  if (!template) return { ok: false, error: 'Template não encontrado ou inativo' };

  const emailTo = String(to || '').trim();
  if (!emailTo) return { ok: false, error: 'Informe o e-mail do destinatário' };

  const ctx = await loadClienteContext(db, clienteId);
  if (!ctx) return { ok: false, error: 'Cliente não encontrado' };

  const vars = buildVars(ctx, mensagemAdicional);
  const { assunto, html } = renderTemplate(template, vars, mensagemAdicional, assuntoCustom);

  let envio = { sent: false, skipped: true };
  try {
    const emailService = require('./email.service');
    envio = await emailService.send({
      to: emailTo,
      cc: cc ? String(cc).trim() : undefined,
      subject: assunto,
      html,
      text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
    console.info('[EmailAvisos] enviado', { to: emailTo, assunto, template: template.nome });
  } catch (e) {
    console.error('[EmailAvisos] envio:', e.message);
    return { ok: false, error: 'Falha ao enviar e-mail: ' + e.message };
  }

  try {
    const detalhes = JSON.stringify({
      templateId: template.id,
      templateNome: template.nome,
      to: emailTo,
      cc: cc || null,
      assunto,
    });
    const hasAudit = await db.schema.hasTable('auditoria_log');
    if (hasAudit) {
      await db('auditoria_log').insert({
        usuario_id: usuarioId || null,
        cliente_id: clienteId,
        acao: 'CUSTOM:email_aviso',
        descricao: `E-mail: ${template.nome}`,
        entidade: 'clientes',
        entidade_id: clienteId,
        dados_novos: detalhes,
        created_at: new Date(),
      });
    } else {
      await db('historico_acoes').insert({
        cliente_id: clienteId,
        usuario_id: usuarioId || null,
        acao: `E-mail enviado: ${template.nome}`,
        detalhes,
        created_at: new Date(),
      });
    }
  } catch (_) {}

  const simulado = !envio.sent || envio.skipped;
  return {
    ok: true,
    message: simulado
      ? 'E-mail registrado (SMTP não configurado — modo simulação)'
      : 'E-mail enviado com sucesso',
    simulado,
    assunto,
    to: emailTo,
    template: template.nome,
  };
}

module.exports = {
  listAvisoTemplates,
  previewAviso,
  enviarAvisoCliente,
};
