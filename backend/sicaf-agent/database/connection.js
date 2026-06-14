/**
 * Conexão com MySQL via Knex.
 */
const config = require('../config');
let db = null;
let initError = null;

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function validateDbConfig() {
  const { host, user, password, database } = config.db;
  const missing = [];

  if (!host) missing.push('DB_WRITE_HOST (ou DB_HOST)');
  if (!user) missing.push('DB_WRITE_USER (ou DB_USER)');
  if (!database) missing.push('DB_WRITE_NAME (ou DB_NAME)');

  if (isServerlessRuntime()) {
    if (host === '127.0.0.1' || host === 'localhost') {
      return {
        ok: false,
        error:
          'MySQL apontando para localhost no servidor serverless. Configure DB_WRITE_HOST no painel da Vercel com o IP/host do banco (ex.: 72.61.59.152).',
      };
    }
    if (!password) {
      missing.push('DB_WRITE_PASSWORD');
    }
  }

  if (missing.length) {
    return {
      ok: false,
      error: `Variáveis de banco ausentes: ${missing.join(', ')}. Cadastre-as no painel da Vercel (Settings → Environment Variables).`,
    };
  }

  return { ok: true };
}

function initDatabase() {
  if (db) return true;

  const check = validateDbConfig();
  if (!check.ok) {
    initError = check.error;
    console.error('[sicaf-agent DB]', check.error);
    return false;
  }

  try {
    const knex = require("knex");
    const serverless = isServerlessRuntime();

    db = knex({
      client: 'mysql2',
      connection: {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        charset: 'utf8mb4',
      },
      pool: serverless
        ? { min: 0, max: 1, idleTimeoutMillis: 10_000, acquireTimeoutMillis: 15_000 }
        : {
            min: config.db.poolMin,
            max: config.db.poolMax,
          },
    });

    initError = null;
    console.log(`[sicaf-agent DB] MySQL configurado (${config.db.host}/${config.db.database})`);
    return true;
  } catch (e) {
    initError = e instanceof Error ? e.message : String(e);
    console.error('[sicaf-agent DB] Falha ao iniciar:', initError);
    db = null;
    return false;
  }
}

function getDb() {
  if (!db) initDatabase();
  return db;
}

function getInitError() {
  return initError;
}

function isDbReady() {
  return Boolean(getDb());
}

async function pingDatabase() {
  const instance = getDb();
  if (!instance) return { ok: false, error: initError || 'Banco de dados não disponível' };
  try {
    await instance.raw('SELECT 1');
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    initError = message;
    return { ok: false, error: message };
  }
}

async function closeDatabase() {
  if (db) {
    await db.destroy();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  getInitError,
  isDbReady,
  pingDatabase,
  closeDatabase,
};
