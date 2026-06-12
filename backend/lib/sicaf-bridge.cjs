/**
 * Ponte CJS para módulos em sicaf-agent/ — carregado fora do bundle webpack do Next.
 */
const path = require("path");

const agentRoot = path.join(__dirname, "..", "sicaf-agent");

let initialized = false;

function resolveModule(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  const base = path.join(agentRoot, normalized);
  if (base.endsWith(".js")) return base;
  const direct = `${base}.js`;
  try {
    require.resolve(direct);
    return direct;
  } catch {
    const indexFile = path.join(base, "index.js");
    try {
      require.resolve(indexFile);
      return indexFile;
    } catch {
      return direct;
    }
  }
}

const MODULES_SEM_CACHE_BUST = new Set([
  "database/connection",
  "modules/sicaf-assistant/services/openai.service",
]);

function shouldBustCache(relativePath) {
  if (process.env.NODE_ENV === "production") return false;
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  return !MODULES_SEM_CACHE_BUST.has(normalized);
}

function loadModule(relativePath) {
  const resolved = resolveModule(relativePath);
  if (shouldBustCache(relativePath)) {
    delete require.cache[resolved];
  }
  return require(resolved);
}

function ensureDbReady() {
  const conn = loadModule("database/connection");
  if (!conn.getDb()) {
    conn.initDatabase();
  }
}

function initSicafAgentModules() {
  if (initialized) return;
  loadModule("database/connection").initDatabase();
  loadModule("services/ia.service").init();
  try {
    loadModule("services/storage.service").init();
  } catch (e) {
    console.warn("[sicaf-bridge] Storage dirs:", e.message);
  }
  try {
    loadModule("services/google-ads-conversoes-cron.service").start();
  } catch (e) {
    console.warn("[sicaf-bridge] Cron Google Ads conversões:", e.message);
  }
  initialized = true;
}

function getSicafAgentModule(relativePath) {
  initSicafAgentModules();
  const mod = loadModule(relativePath);
  ensureDbReady();
  return mod;
}

function getAgentScriptPath() {
  return resolveModule("modules/sicaf-assistant/index");
}

module.exports = {
  initSicafAgentModules,
  getSicafAgentModule,
  getAgentScriptPath,
};
