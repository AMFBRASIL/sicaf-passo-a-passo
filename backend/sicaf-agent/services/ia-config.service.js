/**
 * Configuração de IA — lê configuracoes_sistema com fallback para .env.
 */
const config = require('../config');
const { getDb } = require('../database/connection');

const IA_KEYS = [
  'ia_provedor',
  'ia_modelo',
  'ia_api_key',
  'ia_max_tokens',
  'ia_temperatura',
  'ia_prompt_sistema',
  'ia_limite_requisicoes_dia',
  'ia_limite_por_cliente',
  'ia_bloquear_orcamento',
  'ia_orcamento_mensal_max',
];

const DEFAULTS = {
  ia_provedor: 'openai',
  ia_modelo: 'gpt-4o',
  ia_api_key: '',
  ia_max_tokens: '4096',
  ia_temperatura: '0.4',
  ia_prompt_sistema: '',
  ia_limite_requisicoes_dia: '200',
  ia_limite_por_cliente: 'true',
  ia_bloquear_orcamento: 'false',
  ia_orcamento_mensal_max: '500',
};

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60 * 1000;

function envFallback() {
  return {
    ia_provedor: 'openai',
    ia_modelo: config.openai?.model || DEFAULTS.ia_modelo,
    ia_api_key: config.openai?.apiKey || '',
    ia_max_tokens: String(config.openai?.maxTokens || DEFAULTS.ia_max_tokens),
    ia_temperatura: String(config.openai?.temperature ?? DEFAULTS.ia_temperatura),
    ia_prompt_sistema: '',
    ia_limite_requisicoes_dia: DEFAULTS.ia_limite_requisicoes_dia,
    ia_limite_por_cliente: DEFAULTS.ia_limite_por_cliente,
    ia_bloquear_orcamento: DEFAULTS.ia_bloquear_orcamento,
    ia_orcamento_mensal_max: DEFAULTS.ia_orcamento_mensal_max,
  };
}

async function loadRawFromDb() {
  const db = getDb();
  if (!db) return {};
  const rows = await db('configuracoes_sistema').whereIn('chave', IA_KEYS);
  const raw = {};
  for (const row of rows) raw[row.chave] = row.valor ?? '';
  return raw;
}

function hasDbApiKey(raw) {
  return !!(raw.ia_api_key && String(raw.ia_api_key).trim());
}

/** Origem efetiva da API Key: banco tem prioridade sobre .env */
function resolveApiKeySource(raw, merged) {
  if (hasDbApiKey(raw)) return 'database';
  if (merged.ia_api_key && String(merged.ia_api_key).trim()) return 'env';
  return 'none';
}

function mergeSettings(raw) {
  const env = envFallback();
  const merged = { ...DEFAULTS };
  for (const key of IA_KEYS) {
    if (key === 'ia_api_key') continue;
    if (raw[key] != null && String(raw[key]).trim() !== '') {
      merged[key] = String(raw[key]);
    } else if (env[key]) {
      merged[key] = String(env[key]);
    }
  }
  if (hasDbApiKey(raw)) {
    merged.ia_api_key = String(raw.ia_api_key).trim();
  } else if (env.ia_api_key) {
    merged.ia_api_key = env.ia_api_key;
  }
  return merged;
}

function toRuntime(merged, raw = {}) {
  return {
    provider: merged.ia_provedor || 'openai',
    model: merged.ia_modelo || 'gpt-4o',
    apiKey: merged.ia_api_key || '',
    maxTokens: parseInt(merged.ia_max_tokens || '4096', 10) || 4096,
    temperature: parseFloat(merged.ia_temperatura || '0.4') || 0.4,
    systemPrompt: String(merged.ia_prompt_sistema || '').trim(),
    limiteRequisicoesDia: parseInt(merged.ia_limite_requisicoes_dia || '200', 10) || 200,
    limitePorCliente: merged.ia_limite_por_cliente !== 'false',
    bloquearOrcamento: merged.ia_bloquear_orcamento === 'true',
    orcamentoMensalMax: parseFloat(merged.ia_orcamento_mensal_max || '500') || 500,
    source: resolveApiKeySource(raw, merged),
  };
}

async function getIaRuntime(forceRefresh = false) {
  if (!forceRefresh && _cache && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache;
  }
  const raw = await loadRawFromDb();
  const merged = mergeSettings(raw);
  _cache = toRuntime(merged, raw);
  _cacheTime = Date.now();
  return _cache;
}

function invalidateIaConfigCache() {
  _cache = null;
  _cacheTime = 0;
}

async function testIaConnection() {
  const rt = await getIaRuntime(true);
  if (rt.provider !== 'openai') {
    return { ok: false, error: `Provedor "${rt.provider}" ainda não suportado. Use OpenAI.` };
  }
  if (!rt.apiKey) {
    return { ok: false, error: 'API Key não configurada (banco ou OPENAI_API_KEY no .env).' };
  }

  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: rt.apiKey });
    const resp = await client.chat.completions.create({
      model: rt.model,
      max_tokens: 16,
      temperature: 0,
      messages: [{ role: 'user', content: 'Responda apenas: OK' }],
    });
    const text = resp.choices?.[0]?.message?.content?.trim() || '';
    return {
      ok: true,
      message: `IA respondeu com sucesso (${rt.model})`,
      resposta: text,
      model: rt.model,
    };
  } catch (e) {
    return { ok: false, error: e.message || 'Falha ao conectar com a IA' };
  }
}

module.exports = {
  IA_KEYS,
  DEFAULTS,
  loadRawFromDb,
  hasDbApiKey,
  resolveApiKeySource,
  getIaRuntime,
  invalidateIaConfigCache,
  testIaConnection,
  envFallback,
};
