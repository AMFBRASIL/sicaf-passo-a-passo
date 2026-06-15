/**
 * E-mails personalizados por status SICAF (alteração manual no admin).
 */
const emailService = require('./email.service');

const STATUS_EMAIL_CONFIG = {
  Vencendo: {
    tipo: 'vencendo',
    codigos: ['sicaf_vencendo', 'vencimento_proximo', 'sicaf_status_vencendo', 'renovacao_sicaf'],
    nomePatterns: ['%vencendo%', '%renovação%', '%renovacao%', '%vencimento próximo%'],
    icon: '⚠️',
    corHeader: '#d97706',
    corHeader2: '#f59e0b',
    titulo: 'SICAF próximo do vencimento',
    subtitulo: 'Renove em breve para manter seu cadastro ativo',
    corpoIntro:
      'Seu cadastro SICAF está <strong>próximo do vencimento</strong>. Para continuar participando de licitações sem interrupções, é necessário renovar a validade em breve.',
    acaoTitulo: 'Renove antes do prazo',
    acaoTexto:
      'Acesse o portal, confira a data de validade e envie a documentação ou efetue o pagamento da renovação.',
    ctaLabel: 'Renovar SICAF →',
    ctaHref: 'documentos',
    assunto: (cliente) => `SICAF próximo do vencimento — ${cliente.razao_social || 'CADBRASIL'}`,
  },
  Vencido: {
    tipo: 'vencido',
    codigos: ['sicaf_vencido', 'cadastro_vencido', 'sicaf_status_vencido', 'renovacao_urgente'],
    nomePatterns: ['%vencido%', '%cadastro vencido%', '%renovação urgente%'],
    icon: '❌',
    corHeader: '#dc2626',
    corHeader2: '#ef4444',
    titulo: 'SICAF vencido',
    subtitulo: 'Renovação imediata necessária',
    corpoIntro:
      'Identificamos que seu cadastro SICAF está <strong>vencido</strong>. Enquanto não houver renovação, sua empresa pode ficar impedida de operar no sistema de compras governamentais.',
    acaoTitulo: 'Regularize o quanto antes',
    acaoTexto:
      'Entre no portal, regularize pendências e conclua a renovação para reativar o cadastro.',
    ctaLabel: 'Regularizar cadastro →',
    ctaHref: 'documentos',
    assunto: (cliente) => `SICAF vencido — ação necessária — ${cliente.razao_social || 'CADBRASIL'}`,
  },
  Pendente: {
    tipo: 'pendente',
    codigos: ['sicaf_pendente', 'pendencia_sicaf', 'sicaf_status_pendente', 'regularizacao_pendente'],
    nomePatterns: ['%pendente%', '%pendência%', '%pendencia%', '%regularização%'],
    icon: '📋',
    corHeader: '#ea580c',
    corHeader2: '#f97316',
    titulo: 'SICAF com pendências',
    subtitulo: 'Documentos ou pagamento aguardando regularização',
    corpoIntro:
      'Seu cadastro SICAF está <strong>pendente de regularização</strong>. Há documentos e/ou pagamento aguardando conclusão para liberar o processo.',
    acaoTitulo: 'Envie o que falta',
    acaoTexto:
      'Acesse a área de documentos no portal, verifique as pendências indicadas e envie os arquivos ou comprovantes necessários.',
    ctaLabel: 'Ver pendências →',
    ctaHref: 'documentos',
    assunto: (cliente) => `Pendências no SICAF — ${cliente.razao_social || 'CADBRASIL'}`,
  },
  Suspenso: {
    tipo: 'suspenso',
    codigos: ['sicaf_suspenso', 'cadastro_suspenso', 'sicaf_status_suspenso'],
    nomePatterns: ['%suspenso%', '%suspensão%', '%suspensao%'],
    icon: '⏸️',
    corHeader: '#7c3aed',
    corHeader2: '#8b5cf6',
    titulo: 'Cadastro SICAF suspenso',
    subtitulo: 'Suspensão temporária por decisão administrativa',
    corpoIntro:
      'Informamos que seu cadastro SICAF foi <strong>suspenso temporariamente</strong>. Durante este período, o acesso às funcionalidades pode estar limitado.',
    acaoTitulo: 'Entre em contato',
    acaoTexto:
      'Para entender o motivo e os próximos passos para reativação, acesse o suporte ou responda a este e-mail.',
    ctaLabel: 'Abrir suporte →',
    ctaHref: 'suporte',
    assunto: (cliente) => `SICAF suspenso — ${cliente.razao_social || 'CADBRASIL'}`,
  },
  Cancelado: {
    tipo: 'cancelamento',
    codigos: ['cancelamento', 'cancelamento_sicaf', 'sicaf_cancelamento'],
    nomePatterns: ['%cancelamento%', '%cancelado%'],
    icon: '🚫',
    corHeader: '#4b5563',
    corHeader2: '#6b7280',
    titulo: 'Cadastro SICAF cancelado',
    subtitulo: 'Encerramento definitivo do cadastro',
    corpoIntro:
      'Seu cadastro SICAF foi <strong>cancelado</strong>. Para voltar a operar, será necessário um novo cadastramento junto à CADBRASIL.',
    acaoTitulo: 'Novo cadastramento',
    acaoTexto:
      'Se desejar retomar os serviços, entre em contato com nossa equipe para orientações sobre um novo processo.',
    ctaLabel: 'Falar com a equipe →',
    ctaHref: 'suporte',
    assunto: (cliente) => `Cancelamento do SICAF — ${cliente.razao_social || 'CADBRASIL'}`,
  },
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateBr(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch (_) {
    return String(d);
  }
}

async function findTemplateForStatus(db, status) {
  const cfg = STATUS_EMAIL_CONFIG[status];
  if (!cfg || !db) return null;

  const ativo = () => db('templates_email').whereRaw('COALESCE(ativo, 1) = 1');

  try {
    for (const codigo of cfg.codigos) {
      const row = await ativo()
        .whereRaw('LOWER(COALESCE(codigo, \'\')) = ?', [codigo.toLowerCase()])
        .orderBy('id')
        .first();
      if (row) return row;
    }

    for (const pattern of cfg.nomePatterns) {
      const row = await ativo().whereRaw('LOWER(nome) LIKE ?', [pattern.toLowerCase()]).orderBy('id').first();
      if (row) return row;
    }
  } catch (_) {}

  return null;
}

function buildFallbackHtml({
  cliente,
  sicaf,
  status,
  oldDisplayStatus,
  mensagem,
  cfg,
}) {
  const portalBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cadbrasil.com.br';
  const nome = cliente.responsavel_nome || cliente.razao_social || 'Cliente';
  const empresa = cliente.razao_social || 'sua empresa';
  const cnpj = cliente.documento || '';
  const validade = formatDateBr(sicaf?.data_validade);
  const linkCta = `${portalBase}/${cfg.ctaHref}`;
  const linkPainel = `${portalBase}/empresas`;
  const obs = String(mensagem || '').trim();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,${cfg.corHeader},${cfg.corHeader2});padding:40px 32px;text-align:center">
      <div style="font-size:42px;margin-bottom:8px">${cfg.icon}</div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">${escapeHtml(cfg.titulo)}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:14px">${escapeHtml(cfg.subtitulo)}</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">Olá, <strong>${escapeHtml(nome)}</strong>,</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">${cfg.corpoIntro}</p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Empresa</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(empresa)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">CNPJ</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;font-family:monospace">${escapeHtml(cnpj)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Status anterior</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(oldDisplayStatus || '—')}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Novo status</td><td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;color:${cfg.corHeader}">${escapeHtml(status)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Validade SICAF</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(validade)}</td></tr>
        </table>
      </div>

      ${
        obs
          ? `<div style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:8px;padding:16px 18px;margin:0 0 24px">
        <p style="margin:0;font-size:14px;line-height:1.7;color:#5b21b6"><strong>Observação da equipe:</strong> ${escapeHtml(obs)}</p>
      </div>`
          : ''
      }

      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:16px 18px;margin:24px 0">
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1e40af">${escapeHtml(cfg.acaoTitulo)}</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#1e40af">${escapeHtml(cfg.acaoTexto)}</p>
      </div>

      <div style="text-align:center;margin-top:28px">
        <a href="${escapeHtml(linkCta)}" style="display:inline-block;background:linear-gradient(135deg,${cfg.corHeader},${cfg.corHeader2});color:#fff!important;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:0 6px 10px">${escapeHtml(cfg.ctaLabel)}</a>
        <a href="${escapeHtml(linkPainel)}" style="display:inline-block;background:#f1f5f9;color:#334155!important;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:0 6px 10px">Acessar minhas empresas</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #f1f5f9">
      <p style="margin:0;font-size:12px;color:#94a3b8"><strong>CADBRASIL</strong> · Gestão SICAF · ${escapeHtml(new Date().toLocaleDateString('pt-BR'))}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * @param {object} opts
 * @param {import('knex').Knex} opts.db
 * @param {string} opts.status
 * @param {object} opts.sicaf
 * @param {string} opts.oldDisplayStatus
 * @param {string} [opts.mensagem]
 * @param {number} [opts.usuarioId]
 * @param {string} [opts.novaValidade]
 */
async function sendSicafStatusEmail({ db, status, sicaf, oldDisplayStatus, mensagem, usuarioId, novaValidade }) {
  const cfg = STATUS_EMAIL_CONFIG[status];
  if (!cfg) {
    return { enviado: false, motivo: 'status_sem_email', status };
  }

  const sicafEmail = {
    ...sicaf,
    status,
    ...(novaValidade ? { data_validade: novaValidade } : {}),
  };

  const cliente = await db('clientes').where('id', sicaf.cliente_id).first();
  const emailDestino = String(cliente?.email || '').trim();
  if (!emailDestino) {
    return { enviado: false, motivo: 'sem_email_destino', tipo: cfg.tipo };
  }

  const templateRow = await findTemplateForStatus(db, status);
  const extraVars = {
    status_novo: status,
    status_anterior: oldDisplayStatus || '',
    status,
    mensagem_adicional: String(mensagem || '').trim(),
  };

  if (templateRow) {
    const emailAvisos = require('./email-avisos.service');
    const envio = await emailAvisos.enviarAvisoCliente({
      clienteId: sicaf.cliente_id,
      templateDbId: templateRow.id,
      to: emailDestino,
      mensagemAdicional: String(mensagem || '').trim(),
      usuarioId,
      extraVars,
    });

    if (!envio.ok) {
      return {
        enviado: false,
        motivo: 'erro_envio',
        erro: envio.error || 'Falha ao enviar',
        templateId: templateRow.id,
        templateNome: templateRow.nome,
        tipo: cfg.tipo,
      };
    }

    return {
      enviado: !envio.simulado,
      simulado: Boolean(envio.simulado),
      templateId: templateRow.id,
      templateNome: templateRow.nome,
      para: emailDestino,
      tipo: cfg.tipo,
    };
  }

  const assunto = cfg.assunto(cliente);
  const html = buildFallbackHtml({
    cliente,
    sicaf: sicafEmail,
    status,
    oldDisplayStatus,
    mensagem,
    cfg,
  });

  try {
    const envio = await emailService.send({
      to: emailDestino,
      subject: assunto,
      html,
      text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });

    if (!envio.ok && !envio.skipped) {
      return {
        enviado: false,
        motivo: 'erro_envio',
        erro: envio.error || 'Falha ao enviar',
        tipo: cfg.tipo,
      };
    }

    return {
      enviado: Boolean(envio.sent),
      simulado: Boolean(envio.skipped),
      para: emailDestino,
      assunto,
      tipo: cfg.tipo,
      origem: 'fallback',
    };
  } catch (e) {
    return { enviado: false, motivo: 'erro_envio', erro: e.message, tipo: cfg.tipo };
  }
}

module.exports = {
  sendSicafStatusEmail,
  findTemplateForStatus,
  STATUS_EMAIL_CONFIG,
};
