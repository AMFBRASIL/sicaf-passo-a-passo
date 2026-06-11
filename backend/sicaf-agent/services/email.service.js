/**
 * Serviço de e-mail — lê configuracoes_sistema + .env; envia via Mailgun API ou SMTP.
 */
const {
  loadRawFromDb,
  mergeEmailRaw,
  toRuntimeConfig,
  validateRuntimeConfig,
} = require('./email-config.service');

let _configCache = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

async function getEmailConfig(forceRefresh = false, overrides = null) {
  if (!forceRefresh && !overrides && _configCache && Date.now() - _configCacheTime < CONFIG_CACHE_TTL) {
    return _configCache;
  }

  const dbRaw = await loadRawFromDb();
  const merged = mergeEmailRaw(dbRaw, overrides);
  const config = toRuntimeConfig(merged);

  if (!overrides) {
    _configCache = config;
    _configCacheTime = Date.now();
  }

  return config;
}

function invalidateConfigCache() {
  _configCache = null;
  _configCacheTime = 0;
}

async function _sendViaMailgunApi(cfg, opts) {
  const domain = (cfg.fromEmail || '').split('@')[1];
  if (!domain) {
    throw new Error('E-mail remetente inválido. Configure um domínio verificado no Mailgun.');
  }

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

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        return { ok: true, messageId: data.id || '', provider: 'Mailgun', region: region.label };
      }
      lastError = data.message || data.error || JSON.stringify(data);
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
    throw new Error(
      'Pacote nodemailer não instalado no backend. Execute: npm install nodemailer --prefix backend',
    );
  }

  const cfg = configOverride || (await getEmailConfig());
  let transportConfig = {};

  if (cfg.metodo === 'api') {
    switch (cfg.provider) {
      case 'sendgrid':
        transportConfig = {
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: { user: 'apikey', pass: cfg.apiKey },
        };
        break;
      case 'resend':
        transportConfig = {
          host: 'smtp.resend.com',
          port: 465,
          secure: true,
          auth: { user: 'resend', pass: cfg.apiKey },
        };
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

    const smtpUser = cfg.user || (cfg.provider === 'mailgun' ? `postmaster@${cfg.fromEmail.split('@')[1] || ''}` : '');
    const smtpPass = cfg.pass || cfg.apiKey || '';

    transportConfig = {
      host: smtpHost,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: smtpUser, pass: smtpPass },
    };
    if (cfg.useTls && cfg.port !== 465) transportConfig.tls = { rejectUnauthorized: false };
  }

  return { transporter: nodemailer.createTransport(transportConfig), config: cfg, transportConfig };
}

async function send(opts, configOverride = null) {
  if (!opts.to) return { ok: false, error: 'Destinatário (to) é obrigatório.' };
  if (!opts.subject) return { ok: false, error: 'Assunto (subject) é obrigatório.' };

  try {
    const cfg = configOverride || (await getEmailConfig());
    const validation = validateRuntimeConfig(cfg);
    if (!validation.ok) return validation;

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

    const transport = await _createTransporter(cfg);
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
  const { getDb } = require('../database/connection');
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

async function testConnection(testEmailTo, settingsOverride = null) {
  const to = String(testEmailTo || '').trim();
  if (!to) return { ok: false, error: 'Informe o e-mail de destino para o teste' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: 'E-mail de destino inválido' };
  }

  try {
    invalidateConfigCache();
    const cfg = await getEmailConfig(true, settingsOverride);
    const validation = validateRuntimeConfig(cfg);
    if (!validation.ok) return validation;

    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const htmlBody = _buildTestEmailHtml({
      provider: cfg.provider,
      metodo: cfg.metodo,
      host: cfg.provider === 'mailgun' && cfg.metodo === 'api' ? 'api.mailgun.net' : cfg.host,
      port: cfg.port,
      useTls: cfg.useTls,
      fromEmail: cfg.fromEmail,
      now,
    });

    const result = await send(
      {
        to,
        subject: `Teste CadBrasil — ${now}`,
        html: htmlBody,
        text: `Teste CadBrasil em ${now}`,
      },
      cfg,
    );

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
