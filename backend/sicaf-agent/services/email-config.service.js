/**
 * Configuração de e-mail — DB (configuracoes_sistema) + fallback .env
 */
const config = require('../config');
const { getDb } = require('../database/connection');

const EMAIL_DB_KEYS = [
  'smtp_metodo',
  'smtp_provider',
  'smtp_host',
  'smtp_porta',
  'smtp_usuario',
  'smtp_senha',
  'smtp_tls',
  'smtp_api_key',
  'smtp_secret_key',
  'smtp_email_remetente',
  'smtp_nome_remetente',
  'empresa_nome',
];

const SECRET_KEYS = new Set(['smtp_senha', 'smtp_api_key', 'smtp_secret_key']);
const MASK = '__UNCHANGED__';

const EMAIL_DEFAULTS = {
  smtp_metodo: 'api',
  smtp_provider: 'mailgun',
  smtp_host: '',
  smtp_porta: '587',
  smtp_usuario: '',
  smtp_senha: '',
  smtp_tls: 'true',
  smtp_api_key: '',
  smtp_secret_key: '',
  smtp_email_remetente: '',
  smtp_nome_remetente: 'CadBrasil',
  empresa_nome: 'CadBrasil',
};

function isPlausibleMailgunApiKey(value) {
  const v = String(value || '').trim();
  return v.startsWith('key-') && v.length >= 20;
}

function isPlausibleProviderApiKey(provider, value) {
  const v = String(value || '').trim();
  if (!v || v === MASK) return false;
  const p = String(provider || '').toLowerCase();
  if (p === 'mailgun') return isPlausibleMailgunApiKey(v);
  if (p === 'sendgrid') return v.startsWith('SG.') && v.length > 20;
  if (p === 'resend') return v.startsWith('re_') && v.length > 10;
  return v.length >= 8;
}

function hasDbApiKey(raw) {
  const v = String(raw?.smtp_api_key || '').trim();
  return Boolean(v && v !== MASK);
}

function hasDbSmtpPassword(raw) {
  const v = String(raw?.smtp_senha || '').trim();
  return Boolean(v && v !== MASK);
}

function resolveApiKey(dbVal, envVal, provider, metodo) {
  const db = String(dbVal || '').trim();
  const env = String(envVal || '').trim();
  if (db === MASK) return env;

  // Banco tem prioridade absoluta (igual ia-config.service.js).
  if (db) return db;

  if (String(metodo || '').toLowerCase() === 'api') {
    const envOk = isPlausibleProviderApiKey(provider, env);
    if (envOk) return env;
    return env;
  }

  return pickNonEmpty(db, env);
}

function resolveApiKeySource(raw, env, merged) {
  const metodo = String(merged.smtp_metodo || 'api').toLowerCase();
  if (metodo !== 'api') return 'n/a';
  const provider = merged.smtp_provider || 'mailgun';
  const envKey = String(env.smtp_api_key || '').trim();
  if (hasDbApiKey(raw)) return 'database';
  if (isPlausibleProviderApiKey(provider, envKey)) return 'env';
  if (envKey) return 'env';
  return 'none';
}

function envFallback() {
  const e = config.email || {};
  const metodo = String(e.metodo || '').trim().toLowerCase();
  const provider = String(e.provider || '').trim().toLowerCase();
  const hasApiKey = Boolean(e.apiKey);
  const hasSmtpHost = Boolean(e.host);

  return {
    smtp_metodo: metodo || (hasApiKey && !hasSmtpHost ? 'api' : 'smtp'),
    smtp_provider: provider || (hasApiKey ? 'mailgun' : ''),
    smtp_host: e.host || '',
    smtp_porta: String(e.port || '587'),
    smtp_usuario: e.user || '',
    smtp_senha: e.pass || '',
    smtp_tls: e.tls === false ? 'false' : 'true',
    smtp_api_key: e.apiKey || '',
    smtp_secret_key: e.secretKey || '',
    smtp_email_remetente: e.fromEmail || e.user || '',
    smtp_nome_remetente: e.fromName || 'CadBrasil',
    empresa_nome: e.fromName || 'CadBrasil',
  };
}

function pickNonEmpty(primary, fallback) {
  const p = primary != null ? String(primary).trim() : '';
  if (p && p !== MASK) return p;
  const f = fallback != null ? String(fallback).trim() : '';
  return f || '';
}

async function loadRawFromDb() {
  const db = getDb();
  const raw = {};
  if (!db) return raw;

  try {
    const rows = await db('configuracoes_sistema')
      .where('chave', 'like', 'smtp_%')
      .orWhere('chave', 'like', 'empresa_%');
    for (const row of rows) raw[row.chave] = row.valor ?? '';
  } catch (_) {}

  return raw;
}

function mergeEmailRaw(dbRaw, overrides) {
  const env = envFallback();
  const merged = {};

  for (const key of EMAIL_DB_KEYS) {
    if (key === 'smtp_api_key') continue;
    merged[key] = pickNonEmpty(dbRaw[key], env[key]);
  }

  let overrideApiKey = '';
  if (overrides && typeof overrides === 'object') {
    for (const [key, value] of Object.entries(overrides)) {
      if (!EMAIL_DB_KEYS.includes(key)) continue;
      if (SECRET_KEYS.has(key) && (!value || value === MASK)) continue;
      const v = value != null ? String(value).trim() : '';
      if (!v) continue;
      if (key === 'smtp_api_key') overrideApiKey = v;
      merged[key] = v;
    }
  }

  if (overrideApiKey) {
    merged.smtp_api_key = overrideApiKey;
  } else {
    const metodo = merged.smtp_metodo || env.smtp_metodo || 'api';
    const provider = merged.smtp_provider || env.smtp_provider || 'mailgun';
    merged.smtp_api_key = resolveApiKey(dbRaw.smtp_api_key, env.smtp_api_key, provider, metodo);
  }

  return merged;
}

function toRuntimeConfig(raw) {
  return {
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
    empresaNome: raw.empresa_nome || raw.smtp_nome_remetente || 'CadBrasil',
  };
}

function validateRuntimeConfig(cfg) {
  if (!cfg.fromEmail || !cfg.fromEmail.includes('@')) {
    return {
      ok: false,
      error:
        'E-mail remetente não configurado. Preencha "E-mail remetente" nas configurações ou SMTP_FROM_EMAIL no .env.',
    };
  }

  if (cfg.metodo === 'api') {
    if (!cfg.apiKey) {
      return {
        ok: false,
        error:
          'API Key não configurada. Informe a chave no painel ou defina MAILGUN_API_KEY / SMTP_API_KEY no .env do servidor.',
      };
    }
    if (cfg.provider === 'mailgun') {
      if (!cfg.fromEmail.split('@')[1]) {
        return { ok: false, error: 'E-mail remetente inválido para Mailgun (domínio ausente).' };
      }
      if (!isPlausibleMailgunApiKey(cfg.apiKey)) {
        console.warn(
          '[Email] API Key Mailgun no banco não segue o formato key-…; tentando envio mesmo assim.',
        );
      }
    }
    return { ok: true };
  }

  const smtpHost = cfg.host || (cfg.provider === 'mailgun' ? 'smtp.mailgun.org' : '');
  if (!smtpHost) {
    return {
      ok: false,
      error: 'Servidor SMTP não configurado. Informe SMTP Host ou use Mailgun/API.',
    };
  }

  if (!cfg.user || !cfg.pass) {
    if (cfg.provider === 'mailgun' && cfg.apiKey) {
      return { ok: true };
    }
    return {
      ok: false,
      error: 'Usuário e senha SMTP não configurados. Para Mailgun SMTP use postmaster@seu-dominio + senha SMTP.',
    };
  }

  return { ok: true };
}

module.exports = {
  EMAIL_DB_KEYS,
  EMAIL_DEFAULTS,
  SECRET_KEYS,
  MASK,
  envFallback,
  loadRawFromDb,
  mergeEmailRaw,
  toRuntimeConfig,
  validateRuntimeConfig,
  hasDbApiKey,
  hasDbSmtpPassword,
  isPlausibleMailgunApiKey,
  isPlausibleProviderApiKey,
  resolveApiKeySource,
  resolveApiKey,
};
