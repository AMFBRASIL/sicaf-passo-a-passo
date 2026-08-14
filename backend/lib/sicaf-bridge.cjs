/**
 * Ponte CJS para módulos em sicaf-agent/ — carregado fora do bundle webpack do Next.
 */
const fs = require("fs");
const path = require("path");

// Require estático para o file-tracing da Vercel incluir node_modules do sicaf-agent.
const { preloadRuntimePackages } = require("./sicaf-runtime-packages.cjs");
if (!process.env.VERCEL) {
  preloadRuntimePackages();
}

const agentRoot = path.join(__dirname, "..", "sicaf-agent");
const dbBundlePath = path.join(__dirname, "sicaf-db.bundle.cjs");

let dbBundleModule = null;

function loadDbConnectionModule() {
  if (process.env.VERCEL) {
    if (!fs.existsSync(dbBundlePath)) {
      throw new Error(
        "lib/sicaf-db.bundle.cjs ausente. O build da Vercel deve executar: node scripts/bundle-sicaf-db.cjs",
      );
    }
    if (!dbBundleModule) {
      dbBundleModule = require(dbBundlePath);
    }
    return dbBundleModule;
  }

  const resolved = resolveModule("database/connection");
  if (shouldBustCache("database/connection")) {
    delete require.cache[resolved];
  }
  return require(resolved);
}

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

/**
 * Em dev, limpa o cache de toda a árvore sicaf-agent — não só do módulo pedido.
 * Sem isso, um service editado continua rodando a versão antiga quando é exigido
 * de dentro de outro service (ex.: clients.service dentro de cobranca-taxa.service).
 */
function bustAgentModuleCache() {
  const preservados = new Set();
  for (const rel of MODULES_SEM_CACHE_BUST) {
    try {
      preservados.add(resolveModule(rel));
    } catch {
      /* módulo inexistente: nada a preservar */
    }
  }

  const nodeModules = `${path.sep}node_modules${path.sep}`;
  for (const cached of Object.keys(require.cache)) {
    if (!cached.startsWith(agentRoot)) continue;
    if (cached.includes(nodeModules)) continue;
    if (preservados.has(cached)) continue;
    delete require.cache[cached];
  }
}

function loadModule(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  if (normalized === "database/connection") {
    return loadDbConnectionModule();
  }

  const resolved = resolveModule(relativePath);
  if (shouldBustCache(relativePath)) {
    bustAgentModuleCache();
  }
  return require(resolved);
}

function ensureDbReady() {
  const conn = loadDbConnectionModule();
  if (!conn.getDb()) {
    conn.initDatabase();
  }
  if (!conn.getDb()) {
    const detail = conn.getInitError?.() || "Banco de dados não disponível";
    const err = new Error(detail);
    err.code = "DB_NOT_AVAILABLE";
    throw err;
  }
}

function initSicafAgentModules() {
  if (initialized) return;

  const conn = loadDbConnectionModule();
  if (!conn.initDatabase()) {
    console.error("[sicaf-bridge] MySQL:", conn.getInitError?.() || "falha ao iniciar");
  }

  try {
    loadModule("services/ia.service").init();
  } catch (e) {
    console.warn("[sicaf-bridge] IA init:", e.message);
  }
  try {
    loadModule("services/storage.service").init();
  } catch (e) {
    console.warn("[sicaf-bridge] Storage dirs:", e.message);
  }
  try {
    if (!process.env.VERCEL) {
      loadModule("services/google-ads-conversoes-cron.service").start();
    }
  } catch (e) {
    console.warn("[sicaf-bridge] Cron Google Ads conversões:", e.message);
  }
  try {
    if (!process.env.VERCEL) {
      loadModule("services/efi-pagamentos-cron.service").start();
    }
  } catch (e) {
    console.warn("[sicaf-bridge] Cron validação pagamentos Efí:", e.message);
  }
  initialized = true;
}

function getSicafAgentModule(relativePath) {
  initSicafAgentModules();
  ensureDbReady();
  return loadModule(relativePath);
}

function getAgentScriptPath() {
  return resolveModule("modules/sicaf-assistant/index");
}

module.exports = {
  initSicafAgentModules,
  getSicafAgentModule,
  getAgentScriptPath,
};
