import mysql, { type Pool, type PoolOptions, type RowDataPacket } from "mysql2/promise";
import { getEnv } from "@/lib/config/env";
import { createModuleLogger } from "@/lib/logger/logger";

const log = createModuleLogger("db");

type PoolRole = "legacy" | "write";

const pools = new Map<PoolRole, Pool>();

function buildPoolOptions(
  host: string,
  port: number,
  user: string,
  password: string,
  database: string,
  poolMin: number,
  poolMax: number,
): PoolOptions {
  return {
    host,
    port,
    user,
    password,
    database,
    charset: "utf8mb4",
    timezone: "+00:00",
    waitForConnections: true,
    connectionLimit: poolMax,
    maxIdle: poolMax,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    multipleStatements: false,
    namedPlaceholders: true,
  };
}

function getPool(role: PoolRole): Pool {
  const existing = pools.get(role);
  if (existing) return existing;

  const env = getEnv();

  const options =
    role === "legacy"
      ? buildPoolOptions(
          env.DB_LEGACY_HOST,
          env.DB_LEGACY_PORT,
          env.DB_LEGACY_USER,
          env.DB_LEGACY_PASSWORD,
          env.DB_LEGACY_NAME,
          env.DB_LEGACY_POOL_MIN,
          env.DB_LEGACY_POOL_MAX,
        )
      : buildPoolOptions(
          env.DB_WRITE_HOST,
          env.DB_WRITE_PORT,
          env.DB_WRITE_USER,
          env.DB_WRITE_PASSWORD,
          env.DB_WRITE_NAME,
          env.DB_WRITE_POOL_MIN,
          env.DB_WRITE_POOL_MAX,
        );

  const pool = mysql.createPool(options);
  pools.set(role, pool);

  log.info(
    { role, host: options.host, database: options.database },
    "Pool MySQL inicializado",
  );

  return pool;
}

/** Banco legado (v1) — somente leitura em código de aplicação */
export function getLegacyPool(): Pool {
  return getPool("legacy");
}

/** Banco novo (v2) — leitura e escrita */
export function getWritePool(): Pool {
  return getPool("write");
}

/** Pool sem database selecionado — usado em scripts de schema */
export function createAdminPool(host: string, port: number, user: string, password: string): Pool {
  return mysql.createPool(
    buildPoolOptions(host, port, user, password, "", 1, 2),
  );
}

export async function pingPool(pool: Pool): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeAllPools(): Promise<void> {
  for (const [role, pool] of pools) {
    await pool.end();
    log.info({ role }, "Pool MySQL encerrado");
  }
  pools.clear();
}

export type { RowDataPacket };
