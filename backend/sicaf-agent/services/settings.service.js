/**
 * Configurações do sistema — leitura/escrita em configuracoes_sistema.
 */
const { getDb } = require('../database/connection');

const EMAIL_KEYS = [
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
];

const {
  IA_KEYS,
  DEFAULTS: IA_DEFAULTS,
  envFallback: iaEnvFallback,
  loadRawFromDb: loadIaRawFromDb,
  hasDbApiKey,
  resolveApiKeySource,
} = require('./ia-config.service');

const storageService = require('./storage.service');

const {
  STORAGE_KEYS,
  DEFAULTS: STORAGE_DEFAULTS,
  envFallback: storageEnvFallback,
  loadRawFromDb: loadStorageRawFromDb,
  hasDbS3Secret,
} = storageService;

const SECRET_KEYS = new Set([
  'smtp_senha',
  'smtp_api_key',
  'smtp_secret_key',
  'ia_api_key',
  'storage_s3_secret_access_key',
]);
const MASK = '__UNCHANGED__';

function maskSecrets(settings) {
  const out = { ...settings };
  for (const key of SECRET_KEYS) {
    if (out[key]) out[key] = MASK;
  }
  return out;
}

function detectCategoria(chave) {
  if (chave.startsWith('smtp_')) return 'email';
  if (chave.startsWith('ia_')) return 'ia';
  if (chave.startsWith('storage_')) return 'armazenamento';
  if (chave.startsWith('notif_')) return 'notificacoes';
  if (chave.startsWith('empresa_')) return 'empresa';
  if (chave.startsWith('pncp_') || chave.startsWith('sicaf_')) return 'integracoes';
  return 'empresa';
}

async function getSettingsByKeys(keys) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const rows = await db('configuracoes_sistema').whereIn('chave', keys);
  const settings = {};
  for (const key of keys) settings[key] = '';
  for (const row of rows) {
    settings[row.chave] = row.valor ?? '';
  }
  return { ok: true, settings: maskSecrets(settings) };
}

async function getEmailSettings() {
  const result = await getSettingsByKeys(EMAIL_KEYS);
  if (!result.ok) return result;

  const db = getDb();
  let templateCount = 0;
  try {
    const [{ count }] = await db('templates_email')
      .whereRaw('COALESCE(ativo, 1) = 1')
      .count({ count: '*' });
    templateCount = Number(count) || 0;
  } catch (_) {}

  return {
    ok: true,
    settings: result.settings,
    templateCount,
  };
}

async function updateSettings(updates) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const keys = Object.keys(updates || {});
  if (!keys.length) return { ok: false, error: 'Nenhuma configuração informada' };

  let updatedCount = 0;
  for (const chave of keys) {
    let valor = updates[chave];
    if (valor === undefined || valor === null) continue;
    valor = String(valor);

    if (SECRET_KEYS.has(chave) && (!valor || valor === MASK)) continue;

    const exists = await db('configuracoes_sistema').where('chave', chave).first();
    if (exists) {
      await db('configuracoes_sistema').where('chave', chave).update({
        valor,
        updated_at: db.fn.now(),
      });
      updatedCount++;
    } else {
      await db('configuracoes_sistema').insert({
        chave,
        valor,
        categoria: detectCategoria(chave),
        descricao: '',
        tipo_valor: SECRET_KEYS.has(chave) ? 'secret' : 'string',
      });
      updatedCount++;
    }
  }

  if (keys.some((k) => k.startsWith('smtp_'))) {
    try {
      const emailService = require('./email.service');
      if (emailService.invalidateConfigCache) emailService.invalidateConfigCache();
    } catch (_) {}
  }
  if (keys.some((k) => k.startsWith('ia_'))) {
    try {
      const iaService = require('./ia.service');
      void iaService.invalidateCache();
    } catch (_) {}
  }
  if (keys.some((k) => k.startsWith('storage_'))) {
    try {
      storageService.invalidateCache();
    } catch (_) {}
  }

  return {
    ok: true,
    updated: updatedCount,
    message: `${updatedCount} configuração(ões) atualizada(s)`,
  };
}

async function updateEmailSettings(updates) {
  const allowed = {};
  for (const key of EMAIL_KEYS) {
    if (updates[key] !== undefined) allowed[key] = updates[key];
  }
  return updateSettings(allowed);
}

async function getTemplates() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const templates = await db('templates_email').orderBy('nome');
  return {
    ok: true,
    templates: templates.map((t) => ({
      id: t.id,
      codigo: t.codigo || null,
      nome: t.nome,
      assunto: t.assunto || '',
      corpoHtml: t.corpo_html || '',
      variaveisDisponiveis: t.variaveis_disponiveis,
      ativo: t.ativo !== 0,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
  };
}

async function updateTemplate(id, data) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const template = await db('templates_email').where('id', id).first();
  if (!template) return { ok: false, error: 'Template não encontrado' };

  const updates = {};
  if (data.nome !== undefined) {
    const nome = String(data.nome || '').trim();
    if (!nome) return { ok: false, error: 'Nome do template é obrigatório' };
    updates.nome = nome;
  }
  if (data.assunto !== undefined) updates.assunto = String(data.assunto || '').trim();
  if (data.corpoHtml !== undefined) updates.corpo_html = String(data.corpoHtml || '').trim();
  if (data.ativo !== undefined) updates.ativo = data.ativo === false || data.ativo === 0 ? 0 : 1;

  if (!Object.keys(updates).length) return { ok: false, error: 'Nenhum campo para atualizar' };
  updates.updated_at = db.fn.now();

  await db('templates_email').where('id', id).update(updates);
  return { ok: true, message: 'Template atualizado com sucesso' };
}

async function getIaSettings() {
  const result = await getSettingsByKeys(IA_KEYS);
  if (!result.ok) return result;

  const raw = await loadIaRawFromDb();
  const env = iaEnvFallback();
  const merged = { ...IA_DEFAULTS };
  for (const key of IA_KEYS) {
    const dbVal = result.settings[key];
    if (dbVal != null && String(dbVal).trim() !== '' && dbVal !== MASK) {
      merged[key] = dbVal;
    } else if (key === 'ia_api_key') {
      merged[key] = hasDbApiKey(raw) || env.ia_api_key ? MASK : '';
    } else {
      merged[key] = raw[key] || env[key] || IA_DEFAULTS[key] || '';
    }
  }

  const apiKeySource = resolveApiKeySource(raw, {
    ia_api_key: hasDbApiKey(raw) ? raw.ia_api_key : env.ia_api_key,
  });

  return {
    ok: true,
    settings: maskSecrets(merged),
    status: {
      configured: apiKeySource !== 'none',
      apiKeySource,
      provider: merged.ia_provedor || 'openai',
      model: merged.ia_modelo || 'gpt-4o',
    },
  };
}

async function updateIaSettings(updates) {
  const allowed = {};
  for (const key of IA_KEYS) {
    if (updates[key] !== undefined) allowed[key] = updates[key];
  }
  return updateSettings(allowed);
}

async function testIaConnection() {
  try {
    const iaService = require('./ia.service');
    return iaService.testConnection();
  } catch (e) {
    return { ok: false, error: e.message || 'Erro ao testar IA' };
  }
}

async function getStorageSettings() {
  const result = await getSettingsByKeys(STORAGE_KEYS);
  if (!result.ok) return result;

  const raw = await loadStorageRawFromDb();
  const env = storageEnvFallback();
  const merged = { ...STORAGE_DEFAULTS };
  for (const key of STORAGE_KEYS) {
    const dbVal = result.settings[key];
    if (dbVal != null && String(dbVal).trim() !== '' && dbVal !== MASK) {
      merged[key] = dbVal;
    } else if (key === 'storage_s3_secret_access_key') {
      merged[key] = hasDbS3Secret(raw) || env.storage_s3_secret_access_key ? MASK : '';
    } else {
      merged[key] = raw[key] || env[key] || STORAGE_DEFAULTS[key] || '';
    }
  }

  let usage = null;
  try {
    usage = await storageService.getUsage();
  } catch (_) {}

  const provedor = merged.storage_provedor || 'lovable_cloud';
  const configured =
    provedor === 's3'
      ? !!(merged.storage_s3_bucket && (hasDbS3Secret(raw) || env.storage_s3_secret_access_key))
      : true;

  return {
    ok: true,
    settings: maskSecrets(merged),
    status: {
      configured,
      configSource: Object.keys(raw).filter((k) => raw[k]).length >= 3 ? 'database' : 'env',
      provider: provedor,
      usage,
    },
  };
}

async function updateStorageSettings(updates) {
  const allowed = {};
  for (const key of STORAGE_KEYS) {
    if (updates[key] !== undefined) allowed[key] = updates[key];
  }
  return updateSettings(allowed);
}

async function testStorageSettings() {
  try {
    return storageService.testConnection();
  } catch (e) {
    return { ok: false, error: e.message || 'Erro ao testar armazenamento' };
  }
}

async function testEmailConnection(testEmailTo) {
  try {
    const emailService = require('./email.service');
    if (emailService.invalidateConfigCache) emailService.invalidateConfigCache();
    return emailService.testConnection(testEmailTo);
  } catch (e) {
    return { ok: false, error: e.message || 'Erro ao testar conexão' };
  }
}

module.exports = {
  EMAIL_KEYS,
  IA_KEYS,
  STORAGE_KEYS,
  getEmailSettings,
  updateEmailSettings,
  getIaSettings,
  updateIaSettings,
  getStorageSettings,
  updateStorageSettings,
  updateSettings,
  getTemplates,
  updateTemplate,
  testEmailConnection,
  testIaConnection,
  testStorageSettings,
};
