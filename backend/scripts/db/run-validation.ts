/**
 * Executa 03_validacao.sql e verifica se diff = 0 em todas as linhas.
 */
import type { RowDataPacket } from "mysql2/promise";
import {
  adaptSqlForEnvironment,
  createConnection,
  getCredentialsFromEnv,
  printTable,
  queryRows,
  readSqlFile,
} from "./sql-runner";

type CountRow = RowDataPacket & {
  tabela?: string;
  v1?: number;
  v2?: number;
  diff?: number;
  info?: string;
};

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
}

async function main() {
  const { write, v2SchemaName, legacy } = getCredentialsFromEnv();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — Validação pós-ETL");
  console.log(` Comparando ${legacy.database} vs ${v2SchemaName}`);
  console.log("═══════════════════════════════════════════════════════");

  let raw = await readSqlFile("database/03_validacao.sql");
  raw = adaptSqlForEnvironment(raw, v2SchemaName, legacy.database);

  const conn = await createConnection(write, { database: v2SchemaName });

  try {
    const statements = splitStatements(raw);
    let failures = 0;

    for (const stmt of statements) {
      if (!stmt.toUpperCase().includes("SELECT")) continue;

      const rows = await queryRows<CountRow>(conn, stmt);

      if (rows.length === 0) continue;

      const first = rows[0];
      if ("info" in first && typeof first.info === "string") {
        console.log(`\n${first.info}`);
        continue;
      }

      if ("tabela" in first && "diff" in first) {
        printTable(rows);
        const bad = rows.filter((r) => Number(r.diff) !== 0);
        if (bad.length > 0) {
          failures += bad.length;
          console.error(`✖ ${bad.length} tabela(s) com diff ≠ 0`);
        } else {
          console.log("✔ Todas as contagens 1:1 OK (diff = 0)");
        }
        continue;
      }

      printTable(rows);
    }

    if (failures > 0) {
      console.error(`\n❌ Validação falhou: ${failures} divergência(s).`);
      process.exit(1);
    }

    console.log("\n✅ Validação concluída com sucesso.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
