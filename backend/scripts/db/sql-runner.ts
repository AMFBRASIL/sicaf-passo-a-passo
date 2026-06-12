import fs from "node:fs/promises";
import path from "node:path";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env"), override: true });

export type DbCredentials = {
  host: string;
  port: number;
  user: string;
  password: string;
};

export function getCredentialsFromEnv(): {
  legacy: DbCredentials & { database: string };
  write: DbCredentials & { database: string };
  v2SchemaName: string;
} {
  const v2SchemaName = process.env.DB_V2_SCHEMA_NAME || process.env.DB_WRITE_NAME || "cadbrasilv2";

  return {
    legacy: {
      host: process.env.DB_LEGACY_HOST!,
      port: Number(process.env.DB_LEGACY_PORT || 3306),
      user: process.env.DB_LEGACY_USER!,
      password: process.env.DB_LEGACY_PASSWORD || "",
      database: process.env.DB_LEGACY_NAME!,
    },
    write: {
      host: process.env.DB_WRITE_HOST!,
      port: Number(process.env.DB_WRITE_PORT || 3306),
      user: process.env.DB_WRITE_USER!,
      password: process.env.DB_WRITE_PASSWORD || "",
      database: process.env.DB_WRITE_NAME || v2SchemaName,
    },
    v2SchemaName,
  };
}

export async function readSqlFile(relativeFromRepo: string): Promise<string> {
  const repoRoot = path.resolve(process.cwd(), "..");
  const filePath = path.resolve(repoRoot, relativeFromRepo);
  const content = await fs.readFile(filePath, "utf8");
  return content;
}

/** Substitui cadbrasilsys_v2 (nome do repositório) pelo banco real em produção */
export function adaptSqlForEnvironment(sql: string, v2SchemaName: string, legacyName: string): string {
  return sql
    .replaceAll("`cadbrasilsys_v2`", `\`${v2SchemaName}\``)
    .replaceAll("cadbrasilsys_v2", v2SchemaName)
    .replaceAll("`cadbrasilsys`", `\`${legacyName}\``);
}

export async function createConnection(
  creds: DbCredentials,
  options?: { database?: string; multipleStatements?: boolean },
): Promise<Connection> {
  return mysql.createConnection({
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
    database: options?.database,
    charset: "utf8mb4",
    multipleStatements: options?.multipleStatements ?? false,
    connectTimeout: 120_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  });
}

export async function safeEndConnection(connection: Connection | null | undefined): Promise<void> {
  if (!connection) return;
  try {
    await connection.end();
  } catch {
    try {
      connection.destroy();
    } catch {
      /* ignore */
    }
  }
}

export async function executeSqlFile(
  connection: Connection,
  sql: string,
  label: string,
): Promise<void> {
  console.log(`\n▶ Executando: ${label}`);
  const started = Date.now();

  try {
    await connection.query(sql);
    console.log(`✔ Concluído em ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error(`✖ Erro em ${label}:`, error);
    throw error;
  }
}

export async function queryRows<T extends RowDataPacket>(
  connection: Connection,
  sql: string,
): Promise<T[]> {
  const [rows] = await connection.query<T[]>(sql);
  return rows;
}

export function printTable(rows: RowDataPacket[]): void {
  if (rows.length === 0) {
    console.log("(sem resultados)");
    return;
  }
  console.table(rows);
}
