/**
 * Verifica status dos bancos legado e v2 sem alterar dados.
 */
import type { RowDataPacket } from "mysql2/promise";
import {
  createConnection,
  getCredentialsFromEnv,
  printTable,
  queryRows,
} from "./sql-runner";

async function main() {
  const { legacy, write, v2SchemaName } = getCredentialsFromEnv();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — Status dos Bancos");
  console.log("═══════════════════════════════════════════════════════");

  for (const [label, creds, dbName] of [
    ["LEGADO (v1)", legacy, legacy.database],
    ["NOVO (v2)", write, v2SchemaName],
  ] as const) {
    console.log(`\n── ${label}: ${dbName} @ ${creds.host} ──`);

    try {
      const conn = await createConnection(creds, { database: dbName });

      const version = await queryRows<RowDataPacket & { version: string }>(
        conn,
        "SELECT VERSION() AS version",
      );
      console.log(`MySQL: ${version[0]?.version}`);

      const tables = await queryRows<RowDataPacket & { tabelas: number; linhas: number }>(
        conn,
        `SELECT
           COUNT(*) AS tabelas,
           COALESCE(SUM(table_rows), 0) AS linhas
         FROM information_schema.tables
        WHERE table_schema = '${dbName}'
          AND table_type = 'BASE TABLE'`,
      );
      printTable(tables);

      if (dbName === v2SchemaName) {
        const sample = await queryRows<RowDataPacket>(
          conn,
          `SELECT
             (SELECT COUNT(*) FROM usuarios) AS usuarios,
             (SELECT COUNT(*) FROM clientes) AS clientes,
             (SELECT COUNT(*) FROM sicaf_cadastros) AS sicaf,
             (SELECT COUNT(*) FROM pagamentos) AS pagamentos`,
        );
        console.log("Amostra de registros:");
        printTable(sample);
      }

      await conn.end();
      console.log("✔ Conectado");
    } catch (error) {
      console.error("✖ Falha:", (error as Error).message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
