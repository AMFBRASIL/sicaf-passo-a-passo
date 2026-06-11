/**
 * ETL Node.js: lê do banco legado (cadbrasilsys) e grava no v2 (cadbrasilv2).
 * Necessário porque o usuário v2 não tem SELECT cross-database no MySQL.
 *
 * Uso:
 *   npx tsx scripts/db/run-migration-node.ts          # ETL completo (INSERT IGNORE)
 *   npx tsx scripts/db/run-migration-node.ts --dados  # sem tabelas de configuração
 */
import type { RowDataPacket } from "mysql2/promise";
import {
  adaptSqlForEnvironment,
  createConnection,
  getCredentialsFromEnv,
  readSqlFile,
} from "./sql-runner";
import { parseEtlSteps } from "./etl-parser";
import { ETL_TARGETS_SKIP_CONFIG } from "./migration-config";

const BATCH_SIZE = 500;
const dadosOnly = process.argv.includes("--dados");

async function batchInsert(
  writeConn: Awaited<ReturnType<typeof createConnection>>,
  table: string,
  columns: string[],
  rows: RowDataPacket[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const colList = columns.map((c) => `\`${c}\``).join(", ");
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    const sql = `INSERT IGNORE INTO \`${table}\` (${colList}) VALUES ${placeholders}`;

    const values: unknown[] = [];
    for (const row of batch) {
      const keys = Object.keys(row);
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        values.push(row[col] ?? row[keys[c]] ?? null);
      }
    }

    const [result] = await writeConn.query(sql, values);
    inserted += (result as { affectedRows?: number }).affectedRows ?? batch.length;
  }

  return inserted;
}

async function main() {
  const { legacy, write, v2SchemaName } = getCredentialsFromEnv();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — ETL Node.js (dual-connection)");
  console.log(` ${legacy.database} → ${v2SchemaName}`);
  console.log("═══════════════════════════════════════════════════════");

  let raw = await readSqlFile("database/02_migration_etl.sql");
  raw = adaptSqlForEnvironment(raw, v2SchemaName, legacy.database);
  let steps = parseEtlSteps(raw);

  if (dadosOnly) {
    steps = steps.filter((s) => !ETL_TARGETS_SKIP_CONFIG.has(s.targetTable));
    console.log(`Modo --dados: ${steps.length} passos (configurações excluídas).\n`);
  } else {
    console.log(`\n${steps.length} passos de migração detectados.\n`);
  }

  const legacyConn = await createConnection(legacy, { database: legacy.database });
  const writeConn = await createConnection(write, { database: v2SchemaName });

  await writeConn.query("SET FOREIGN_KEY_CHECKS = 0");
  await writeConn.query("SET UNIQUE_CHECKS = 0");

  const summary: { table: string; source: string; read: number; inserted: number }[] = [];
  let errors = 0;

  try {
    for (const step of steps) {
      const label = `${step.sourceTable} → ${step.targetTable}`;
      process.stdout.write(`▶ ${label} ... `);

      try {
        const [rows] = await legacyConn.query<RowDataPacket[]>(
          `SELECT ${step.selectSql} FROM \`${step.sourceTable}\``,
        );

        const inserted = await batchInsert(writeConn, step.targetTable, step.columns, rows);
        summary.push({
          table: step.targetTable,
          source: step.sourceTable,
          read: rows.length,
          inserted,
        });
        console.log(`✔ ${rows.length} lidos, ${inserted} inseridos`);
      } catch (err) {
        errors++;
        console.log(`✖ ERRO: ${(err as Error).message}`);
      }
    }

    await writeConn.query("SET FOREIGN_KEY_CHECKS = 1");
    await writeConn.query("SET UNIQUE_CHECKS = 1");

    console.log("\n── Resumo ──");
    console.table(summary);

    const totalRead = summary.reduce((s, r) => s + r.read, 0);
    const totalInserted = summary.reduce((s, r) => s + r.inserted, 0);
    console.log(`\nTotal: ${totalRead} registros lidos, ${totalInserted} inseridos`);

    if (errors > 0) {
      console.error(`\n❌ ETL concluído com ${errors} erro(s).`);
      process.exit(1);
    }

    console.log("\n✅ ETL Node.js concluído com sucesso.");
  } finally {
    await legacyConn.end();
    await writeConn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
