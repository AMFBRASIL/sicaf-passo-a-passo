/**
 * Cria tabelas ausentes no v2 comparando com 01_schema_v2.sql
 */
import type { RowDataPacket } from "mysql2/promise";
import {
  adaptSqlForEnvironment,
  createConnection,
  getCredentialsFromEnv,
  readSqlFile,
} from "./sql-runner";

function extractCreateTableStatements(sql: string): Map<string, string> {
  const map = new Map<string, string>();
  const regex = /CREATE TABLE `([^`]+)`\s*\(/gi;
  const matches = [...sql.matchAll(regex)];

  for (let i = 0; i < matches.length; i++) {
    const tableName = matches[i][1];
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : sql.length;
    let stmt = sql.slice(start, end).trim();
    if (!stmt.endsWith(";")) stmt += ";";
    map.set(tableName, stmt);
  }

  return map;
}

async function main() {
  const { write, v2SchemaName, legacy } = getCredentialsFromEnv();

  let schemaSql = await readSqlFile("database/01_schema_v2.sql");
  schemaSql = adaptSqlForEnvironment(schemaSql, v2SchemaName, legacy.database);

  const createStatements = extractCreateTableStatements(schemaSql);
  const conn = await createConnection(write, { database: v2SchemaName, multipleStatements: true });

  const [existing] = await conn.query<RowDataPacket[]>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
    [v2SchemaName],
  );
  const existingSet = new Set(existing.map((r) => r.table_name as string));

  const missing = [...createStatements.keys()].filter((t) => !existingSet.has(t));

  console.log(`Tabelas no schema: ${createStatements.size}`);
  console.log(`Tabelas no banco: ${existingSet.size}`);
  console.log(`Ausentes: ${missing.length}`);

  if (missing.length === 0) {
    console.log("✅ Nenhuma tabela ausente.");
    await conn.end();
    return;
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  for (const table of missing) {
    const stmt = createStatements.get(table)!;
    console.log(`▶ Criando: ${table}`);
    try {
      await conn.query(stmt);
      console.log(`  ✔ ${table}`);
    } catch (err) {
      console.error(`  ✖ ${table}:`, (err as Error).message);
    }
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  await conn.end();
  console.log("\n✅ Sincronização de tabelas concluída.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
