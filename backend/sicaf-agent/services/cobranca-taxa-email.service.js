/**
 * E-mail de cobrança — taxa CADBRASIL pendente (admin → cliente).
 */
const emailService = require('./email.service');
const { getPublicPayBaseUrl } = require('../utils/pay-link.util');

const WHATSAPP_NUMERO = process.env.CADBRASIL_WHATSAPP_NUMERO || '551121220202';
const WHATSAPP_DISPLAY = process.env.CADBRASIL_WHATSAPP_DISPLAY || '(11) 2122-0202';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoneyBr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBr(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch (_) {
    return String(d);
  }
}

function buildPortalLinks(portalBase, cnpjDigits) {
  const cnpjParam = cnpjDigits ? `?cnpj=${encodeURIComponent(cnpjDigits)}` : '';
  return {
    link_painel: `${portalBase}/empresas`,
    link_pagamentos: `${portalBase}/pagamentos${cnpjParam}`,
    link_sicaf: `${portalBase}/sicaf${cnpjParam}`,
    link_documentos: `${portalBase}/documentos${cnpjParam}`,
    link_suporte: `${portalBase}/suporte`,
    link_login: `${portalBase}/login`,
  };
}

function buildWhatsAppUrl(cliente, empresa) {
  const nome = cliente?.responsavel_nome || cliente?.razao_social || 'Cliente';
  const texto = [
    `Olá! Sou ${nome}, da empresa ${empresa || 'minha empresa'}.`,
    'Recebi o aviso sobre a taxa CADBRASIL pendente no portal e gostaria de regularizar meu cadastro.',
    'Podem me orientar?',
  ].join(' ');
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
}

async function findCobrancaTemplate(db) {
  if (!db) return null;
  const ativo = () => db('templates_email').whereRaw('COALESCE(ativo, 1) = 1');
  const codigos = [
    'cobranca_taxa_sicaf',
    'cobranca_taxa',
    'taxa_pendente',
    'sicaf_taxa_pendente',
    'cobranca_cadbrasil',
  ];
  try {
    for (const codigo of codigos) {
      const row = await ativo()
        .whereRaw('LOWER(COALESCE(codigo, \'\')) = ?', [codigo.toLowerCase()])
        .orderBy('id')
        .first();
      if (row) return row;
    }
    const patterns = ['%cobrança taxa%', '%cobranca taxa%', '%taxa pendente%', '%cobrança sicaf%'];
    for (const pattern of patterns) {
      const row = await ativo().whereRaw('LOWER(nome) LIKE ?', [pattern.toLowerCase()]).orderBy('id').first();
      if (row) return row;
    }
  } catch (_) {}
  return null;
}

function buildFallbackHtml({ cliente, taxa, links, whatsappUrl, linkPagamentoPublico }) {
  const nome = cliente.responsavel_nome || cliente.razao_social || 'Cliente';
  const empresa = cliente.razao_social || cliente.nome_fantasia || 'sua empresa';
  const cnpj = cliente.documento || '';
  const valor = formatMoneyBr(taxa?.valor);
  const vencimento = formatDateBr(taxa?.data_vencimento);
  const descricao = taxa?.descricao || 'Taxa de cadastro/renovação SICAF — CADBRASIL';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#ea580c,#f97316);padding:40px 32px;text-align:center">
      <div style="font-size:42px;margin-bottom:8px">💳</div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Taxa CADBRASIL pendente</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:14px">Regularize seu cadastro para continuar no SICAF</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">Olá, <strong>${escapeHtml(nome)}</strong>,</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">
        Identificamos que o cadastro da empresa <strong>${escapeHtml(empresa)}</strong> está
        <strong>pendente de pagamento</strong> da taxa CADBRASIL referente ao SICAF.
        Para liberar o processo e manter seu acesso ao portal, é necessário regularizar essa pendência.
      </p>

      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;font-size:13px;color:#9a3412">Descrição</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(descricao)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#9a3412">CNPJ</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;font-family:monospace">${escapeHtml(cnpj)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#9a3412">Valor</td><td style="padding:6px 0;font-size:16px;font-weight:700;text-align:right;color:#ea580c">${escapeHtml(valor)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#9a3412">Vencimento</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right">${escapeHtml(vencimento)}</td></tr>
        </table>
      </div>

      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:16px 18px;margin:24px 0">
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e40af">Como regularizar</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#1e40af">
          Acesse o portal CADBRASIL, vá em <strong>Pagamentos</strong> e efetue o pagamento via PIX ou boleto.
          Após a confirmação, seu processo SICAF será liberado para continuidade.
        </p>
      </div>

      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#334155">Acessos rápidos ao portal</p>
      <div style="text-align:center;margin:16px 0 8px">
        <a href="${escapeHtml(linkPagamentoPublico)}" style="display:inline-block;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff!important;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin:4px">Pagar agora (link seguro) →</a>
        <a href="${escapeHtml(links.link_pagamentos)}" style="display:inline-block;background:linear-gradient(135deg,#ea580c,#f97316);color:#fff!important;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin:4px">Área de pagamentos →</a>
        <a href="${escapeHtml(links.link_painel)}" style="display:inline-block;background:#f1f5f9;color:#334155!important;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin:4px">Minhas empresas</a>
      </div>
      <div style="text-align:center;margin:8px 0 20px">
        <a href="${escapeHtml(links.link_sicaf)}" style="display:inline-block;color:#2563eb!important;padding:8px 16px;text-decoration:none;font-size:13px;margin:2px">Área SICAF</a>
        <span style="color:#cbd5e1">·</span>
        <a href="${escapeHtml(links.link_documentos)}" style="display:inline-block;color:#2563eb!important;padding:8px 16px;text-decoration:none;font-size:13px;margin:2px">Documentos</a>
        <span style="color:#cbd5e1">·</span>
        <a href="${escapeHtml(links.link_suporte)}" style="display:inline-block;color:#2563eb!important;padding:8px 16px;text-decoration:none;font-size:13px;margin:2px">Suporte</a>
        <span style="color:#cbd5e1">·</span>
        <a href="${escapeHtml(links.link_login)}" style="display:inline-block;color:#2563eb!important;padding:8px 16px;text-decoration:none;font-size:13px;margin:2px">Entrar no portal</a>
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 20px;margin:24px 0;text-align:center">
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#166534">Precisa de ajuda?</p>
        <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#15803d">
          Fale com nossa equipe pelo WhatsApp <strong>${escapeHtml(WHATSAPP_DISPLAY)}</strong>
        </p>
        <a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;background:#25d366;color:#fff!important;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">💬 Chamar no WhatsApp</a>
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
 * @param {object} opts.cliente
 * @param {object} opts.taxa
 */
function buildCustomMessageHtml({ cliente, taxa, mensagem, linkPagamentoPublico }) {
  const nome = cliente.responsavel_nome || cliente.razao_social || 'Cliente';
  const lines = String(mensagem || '')
    .split('\n')
    .map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#475569">${escapeHtml(l)}</p>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 16px rgba(0,0,0,.06)">
    <p style="margin:0 0 16px;font-size:15px;color:#334155">Olá, <strong>${escapeHtml(nome)}</strong>,</p>
    ${lines}
    <div style="text-align:center;margin:24px 0">
      <a href="${escapeHtml(linkPagamentoPublico)}" style="display:inline-block;background:#e11d48;color:#fff!important;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Regularizar pagamento</a>
    </div>
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">CADBRASIL · ${escapeHtml(formatMoneyBr(taxa?.valor))}</p>
  </div>
</body></html>`;
}

async function sendCobrancaTaxaEmail({ db, cliente, taxa, mensagemCustom }) {
  const emailDestino = String(cliente?.email || '').trim();
  if (!emailDestino) {
    return { ok: false, error: 'Cliente sem e-mail cadastrado' };
  }

  const portalBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cadbrasil.com.br';
  const cnpjDigits = String(cliente?.documento || '').replace(/\D/g, '');
  const links = buildPortalLinks(portalBase, cnpjDigits);
  const whatsappUrl = buildWhatsAppUrl(cliente, cliente.razao_social || cliente.nome_fantasia);
  const empresa = cliente.razao_social || cliente.nome_fantasia || 'sua empresa';
  const assuntoFallback = `Taxa CADBRASIL pendente — regularize seu cadastro — ${empresa}`;
  const payBase = getPublicPayBaseUrl();
  const payCode = taxa?.id ? `t-${taxa.id}` : `c-${cliente.id}`;
  const linkPagamentoPublico = `${payBase}/pay/${payCode}`;

  if (mensagemCustom) {
    const html = buildCustomMessageHtml({
      cliente,
      taxa,
      mensagem: mensagemCustom,
      linkPagamentoPublico,
    });
    const assunto = `Cobrança CADBRASIL — ${empresa}`;
    try {
      const envio = await emailService.send({
        to: emailDestino,
        subject: assunto,
        html,
        text: String(mensagemCustom).replace(/\s+/g, ' ').trim(),
      });
      if (!envio.ok && !envio.skipped) {
        return { ok: false, error: envio.error || 'Falha ao enviar e-mail', para: emailDestino };
      }
      return {
        ok: true,
        para: emailDestino,
        assunto,
        simulado: Boolean(envio.skipped),
        origem: 'custom',
      };
    } catch (e) {
      return { ok: false, error: e.message, para: emailDestino };
    }
  }

  const templateRow = await findCobrancaTemplate(db);
  if (templateRow) {
    const emailAvisos = require('./email-avisos.service');
    const envio = await emailAvisos.enviarAvisoCliente({
      clienteId: cliente.id,
      templateDbId: templateRow.id,
      to: emailDestino,
      extraVars: {
        ...links,
        link_whatsapp: whatsappUrl,
        whatsapp: WHATSAPP_DISPLAY,
        whatsapp_numero: WHATSAPP_DISPLAY,
        valor_taxa: formatMoneyBr(taxa?.valor),
        valor: formatMoneyBr(taxa?.valor),
        vencimento: formatDateBr(taxa?.data_vencimento),
        data_vencimento: formatDateBr(taxa?.data_vencimento),
        descricao_taxa: taxa?.descricao || 'Taxa SICAF CADBRASIL',
        link_boleto: links.link_pagamentos,
        link_pagamento: linkPagamentoPublico,
        link_pay: linkPagamentoPublico,
        link_acesso: links.link_painel,
        link_painel: links.link_painel,
      },
    });
    if (!envio.ok) {
      return { ok: false, error: envio.error || 'Falha ao enviar e-mail', para: emailDestino };
    }
    return {
      ok: true,
      para: emailDestino,
      assunto: envio.assunto,
      simulado: Boolean(envio.simulado),
      templateNome: templateRow.nome,
      origem: 'template',
    };
  }

  const html = buildFallbackHtml({ cliente, taxa, links, whatsappUrl, linkPagamentoPublico });
  try {
    const envio = await emailService.send({
      to: emailDestino,
      subject: assuntoFallback,
      html,
      text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
    if (!envio.ok && !envio.skipped) {
      return { ok: false, error: envio.error || 'Falha ao enviar e-mail', para: emailDestino };
    }
    return {
      ok: true,
      para: emailDestino,
      assunto: assuntoFallback,
      simulado: Boolean(envio.skipped),
      origem: 'fallback',
    };
  } catch (e) {
    return { ok: false, error: e.message, para: emailDestino };
  }
}

module.exports = {
  sendCobrancaTaxaEmail,
  buildWhatsAppUrl,
  WHATSAPP_DISPLAY,
  WHATSAPP_NUMERO,
};
