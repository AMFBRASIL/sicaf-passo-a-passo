/**
 * Serviço de e-mail — lê configuracoes_sistema e envia via Mailgun API ou SMTP.
 */
const { getDb } = require('../database/connection');

let _configCache = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

async function getEmailConfig(forceRefresh = false) {
  if (!forceRefresh && _configCache && Date.now() - _configCacheTime < CONFIG_CACHE_TTL) {
    return _configCache;
  }

  const db = getDb();
  if (!db) throw new Error('Banco de dados não disponível');

  const rows = await db('configuracoes_sistema')
    .where('chave', 'like', 'smtp_%')
    .orWhere('chave', 'like', 'empresa_%');

  const raw = {};
  for (const row of rows) raw[row.chave] = row.valor;

  const config = {
    provider: raw.smtp_provider || '',
    metodo: raw.smtp_metodo || 'smtp',
    host: raw.smtp_host || '',
    port: parseInt(raw.smtp_porta || '587', 10),
    user: raw.smtp_usuario || '',
    pass: raw.smtp_senha || '',
    useTls: raw.smtp_tls !== 'false',
    apiKey: raw.smtp_api_key || '',
    fromEmail: raw.smtp_email_remetente || raw.smtp_usuario || '',
    fromName: raw.smtp_nome_remetente || raw.empresa_nome || 'CadBrasil',
    empresaNome: raw.empresa_nome || 'CadBrasil',
  };

  _configCache = config;
  _configCacheTime = Date.now();
  return config;
}

function invalidateConfigCache() {
  _configCache = null;
  _configCacheTime = 0;
}

async function _sendViaMailgunApi(cfg, opts) {
  const domain = (cfg.fromEmail || '').split('@')[1];
  if (!domain) throw new Error('E-mail remetente inválido. Configure um domínio verificado no Mailgun.');

  const regions = [
    { label: 'US', url: `https://api.mailgun.net/v3/${domain}/messages` },
    { label: 'EU', url: `https://api.eu.mailgun.net/v3/${domain}/messages` },
  ];

  let lastError = '';
  for (const region of regions) {
    try {
      const authHeader = `Basic ${Buffer.from(`api:${cfg.apiKey}`).toString('base64')}`;
      const formBody = new URLSearchParams({
        from: `${cfg.fromName} <${cfg.fromEmail}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html || '',
        text: opts.text || '',
      }).toString();

      const response = await fetch(region.url, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });

      const data = await response.json();
      if (response.ok) {
        return { ok: true, messageId: data.id || '', provider: 'Mailgun', region: region.label };
      }
      lastError = data.message || JSON.stringify(data);
      if (response.status === 401 || response.status === 404) continue;
      break;
    } catch (fetchErr) {
      lastError = fetchErr.message;
    }
  }

  throw new Error(lastError || 'Falha ao enviar via Mailgun');
}

async function _createTransporter(configOverride) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (_) {
    throw new Error('Pacote nodemailer não instalado. Use método API (Mailgun) ou instale nodemailer no backend.');
  }

  const cfg = configOverride || (await getEmailConfig());
  let transportConfig = {};

  if (cfg.metodo === 'api') {
    switch (cfg.provider) {
      case 'sendgrid':
        transportConfig = { host: 'smtp.sendgrid.net', port: 587, secure: false, auth: { user: 'apikey', pass: cfg.apiKey } };
        break;
      case 'resend':
        transportConfig = { host: 'smtp.resend.com', port: 465, secure: true, auth: { user: 'resend', pass: cfg.apiKey } };
        break;
      case 'mailgun':
        return null;
      default:
        if (cfg.host) {
          transportConfig = {
            host: cfg.host,
            port: cfg.port,
            secure: cfg.useTls && cfg.port === 465,
            auth: { user: cfg.user || 'apikey', pass: cfg.apiKey },
          };
        } else {
          throw new Error(`Provedor "${cfg.provider}" com API não suportado. Configure SMTP manualmente.`);
        }
    }
  } else {
    const smtpHost = cfg.host || (cfg.provider === 'mailgun' ? 'smtp.mailgun.org' : '');
    if (!smtpHost) throw new Error('Servidor SMTP não configurado.');
    transportConfig = {
      host: smtpHost,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    };
    if (cfg.useTls && cfg.port !== 465) transportConfig.tls = { rejectUnauthorized: false };
  }

  return { transporter: nodemailer.createTransport(transportConfig), config: cfg, transportConfig };
}

async function send(opts) {
  if (!opts.to) return { ok: false, error: 'Destinatário (to) é obrigatório.' };
  if (!opts.subject) return { ok: false, error: 'Assunto (subject) é obrigatório.' };

  try {
    const cfg = await getEmailConfig();
    if (cfg.metodo === 'smtp' && !cfg.host && cfg.provider !== 'mailgun') {
      return { ok: false, error: 'Servidor SMTP não configurado.' };
    }
    if (cfg.metodo === 'api' && !cfg.apiKey) {
      return { ok: false, error: 'API Key de e-mail não configurada.' };
    }

    const fromEmail = opts.from || cfg.fromEmail;
    const fromName = opts.fromName || cfg.fromName;

    if (cfg.provider === 'mailgun' && cfg.metodo === 'api') {
      const result = await _sendViaMailgunApi(cfg, {
        to: opts.to,
        subject: opts.subject,
        html: opts.html || '',
        text: opts.text || '',
      });
      return { ok: true, messageId: result.messageId, sent: true };
    }

    const transport = await _createTransporter();
    if (!transport) return { ok: false, error: 'Não foi possível criar o transporter de e-mail.' };

    const info = await transport.transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html || undefined,
      text: opts.text || undefined,
      cc: opts.cc,
      bcc: opts.bcc,
      replyTo: opts.replyTo,
      attachments: opts.attachments,
    });
    return { ok: true, messageId: info.messageId, sent: true };
  } catch (e) {
    console.error('[Email] Erro ao enviar:', e.message);
    return { ok: false, error: e.message, sent: false, skipped: false };
  }
}

async function sendTemplate(templateNome, opts) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const template = await db('templates_email')
    .where('nome', templateNome)
    .whereRaw('COALESCE(ativo, 1) = 1')
    .first();
  if (!template) return { ok: false, error: `Template "${templateNome}" não encontrado.` };

  let subject = template.assunto || '';
  let html = template.corpo_html || '';
  const cfg = await getEmailConfig();
  const vars = {
    empresa_nome: cfg.empresaNome,
    ano: String(new Date().getFullYear()),
    data_atual: new Date().toLocaleDateString('pt-BR'),
    ...(opts.vars || {}),
  };

  for (const [key, value] of Object.entries(vars)) {
    const val = value != null ? String(value) : '';
    subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val);
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val);
  }

  return send({ to: opts.to, subject, html, cc: opts.cc, bcc: opts.bcc, replyTo: opts.replyTo });
}

function _buildTestEmailHtml({ provider, metodo, host, port, useTls, fromEmail, now }) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px"><h2>Teste CadBrasil</h2><p>Conexão de e-mail funcionando em ${now}.</p><ul><li>Provedor: ${provider || '—'}</li><li>Método: ${metodo}</li><li>Servidor: ${host || 'API'}${port ? `:${port}` : ''}</li><li>TLS: ${useTls ? 'sim' : 'não'}</li><li>Remetente: ${fromEmail}</li></ul></body></html>`;
}

async function testConnection(testEmailTo) {
  const to = String(testEmailTo || '').trim();
  if (!to) return { ok: false, error: 'Informe o e-mail de destino para o teste' };

  try {
    const cfg = await getEmailConfig(true);
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    if (cfg.metodo === 'api' && !cfg.apiKey) {
      return { ok: false, error: 'API Key não configurada' };
    }
    if (cfg.metodo === 'smtp' && !cfg.host && cfg.provider !== 'mailgun') {
      return { ok: false, error: 'Servidor SMTP não configurado' };
    }

    const htmlBody = _buildTestEmailHtml({
      provider: cfg.provider,
      metodo: cfg.metodo,
      host: cfg.provider === 'mailgun' && cfg.metodo === 'api' ? 'api.mailgun.net' : cfg.host,
      port: cfg.port,
      useTls: cfg.useTls,
      fromEmail: cfg.fromEmail,
      now,
    });

    const result = await send({
      to,
      subject: `Teste CadBrasil — ${now}`,
      html: htmlBody,
      text: `Teste CadBrasil em ${now}`,
    });

    if (!result.ok) return result;
    return {
      ok: true,
      message: `E-mail de teste enviado para ${to}`,
      messageId: result.messageId,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  send,
  sendTemplate,
  testConnection,
  getEmailConfig,
  invalidateConfigCache,
};
