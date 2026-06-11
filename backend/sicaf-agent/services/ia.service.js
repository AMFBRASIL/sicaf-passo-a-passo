/**
 * Serviço central de IA — ponto único de entrada para todo o projeto.
 *
 * Configuração: configuracoes_sistema (categoria ia), com fallback OPENAI_* no .env.
 * Implementação OpenAI: modules/sicaf-assistant/services/openai.service.js
 *
 * Uso:
 *   const ia = require('./services/ia.service');
 *   if (!(await ia.isReady())) return { ok: false, error: 'IA não configurada' };
 *   const client = ia.getClient();
 *   const { model, maxTokens, temperature } = await ia.getParams();
 */
const iaConfig = require('./ia-config.service');
const openaiService = require('../modules/sicaf-assistant/services/openai.service');

async function getRuntime(forceRefresh = false) {
  return iaConfig.getIaRuntime(forceRefresh);
}

async function getParams(forceRefresh = false) {
  const rt = await getRuntime(forceRefresh);
  return {
    provider: rt.provider,
    model: rt.model,
    maxTokens: rt.maxTokens,
    temperature: rt.temperature,
    apiKeySource: rt.source,
  };
}

async function isReady(forceRefresh = false) {
  const rt = await getRuntime(forceRefresh);
  if (rt.provider !== 'openai' || !rt.apiKey) return false;
  return openaiService.ensureOpenAI(forceRefresh);
}

function getClient() {
  return openaiService.getOpenAI();
}

async function ensureReady(forceRefresh = false) {
  const ok = await isReady(forceRefresh);
  if (!ok) {
    const err = new Error(
      'IA não configurada. Defina as chaves ia_* em configuracoes_sistema ou OPENAI_API_KEY no .env.',
    );
    err.code = 'IA_NOT_CONFIGURED';
    throw err;
  }
  return getClient();
}

function invalidateCache() {
  iaConfig.invalidateIaConfigCache();
  if (openaiService.reinitFromDb) {
    return openaiService.reinitFromDb();
  }
  return Promise.resolve(false);
}

async function getStatus() {
  const rt = await getRuntime();
  const ready = await isReady();
  return {
    ok: true,
    configured: !!rt.apiKey,
    ready,
    provider: rt.provider,
    model: rt.model,
    apiKeySource: rt.apiKey ? (rt.source || 'database') : 'none',
    maxTokens: rt.maxTokens,
    temperature: rt.temperature,
  };
}

async function testConnection() {
  iaConfig.invalidateIaConfigCache();
  return iaConfig.testIaConnection();
}

function init() {
  openaiService.initOpenAI();
}

module.exports = {
  init,
  getRuntime,
  getParams,
  isReady,
  ensureReady,
  getClient,
  invalidateCache,
  getStatus,
  testConnection,
  // Operações SICAF (delegação)
  streamChatResponse: (...args) => openaiService.streamChatResponse(...args),
  streamChatEvents: (...args) => openaiService.streamChatEvents(...args),
  extractCertidoesJSON: (...args) => openaiService.extractCertidoesJSON(...args),
  enrichSicafJsonFromText: (...args) => openaiService.enrichSicafJsonFromText(...args),
  analyzeSicafProblema: (...args) => openaiService.analyzeSicafProblema(...args),
  getSystemPrompt: () => openaiService.SYSTEM_PROMPT,
  resetChatHistory: () => openaiService.resetChatHistory(),
};
