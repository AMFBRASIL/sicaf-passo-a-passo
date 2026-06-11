/**
 * TRUNCATE no banco v2 — remove dados operacionais antes de reimportar do legado.
 *
 * Preserva tabelas de configuração/catálogo (ver migration-config.ts).
 *
 * Uso:
 *   npm run db:truncate -- --confirm
 *   npx tsx scripts/db/truncate-v2-dados.ts --confirm
 */
import type { RowDataPacket } from "mysql2/promise";
import { createConnection, getCredentialsFromEnv } from "./sql-runner";
import { V2_TABLES_PRESERVE } from "./migration-config";

function requireConfirm(): void {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "\n⚠️  TRUNCATE apaga todos os dados operacionais do banco v2.\n" +
        "    Tabelas preservadas: " +
        V2_TABLES_PRESERVE.join(", ") +
        "\n\n    Reexecute com --confirm para continuar.\n",
    );
    process.exit(1);
  }
}

async function main() {
  requireConfirm();

  const { write, v2SchemaName } = getCredentialsFromEnv();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — TRUNCATE banco v2 (dados operacionais)");
  console.log(` Banco: ${v2SchemaName} @ ${write.host}`);
  console.log("═══════════════════════════════════════════════════════\n");

  const conn = await createConnection(write, { database: v2SchemaName });

  try {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT table_name AS name
         FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
      [v2SchemaName],
    );

    const preserve = new Set<string>(V2_TABLES_PRESERVE);
    const toTruncate = rows.map((r) => String(r.name)).filter((t) => !preserve.has(t));

    console.log(`Tabelas no v2: ${rows.length}`);
    console.log(`Preservadas: ${preserve.size}`);
    console.log(`A truncar: ${toTruncate.length}\n`);

    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("SET UNIQUE_CHECKS = 0");

    let truncated = 0;
    for (const table of toTruncate) {
      process.stdout.write(`  TRUNCATE \`${table}\` ... `);
      try {
        await conn.query(`TRUNCATE TABLE \`${table}\``);
        console.log("ok");
        truncated++;
      } catch (err) {
        console.log(`FALHOU: ${(err as Error).message}`);
        throw err;
      }
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    await conn.query("SET UNIQUE_CHECKS = 1");

    console.log(`\n✅ ${truncated} tabela(s) truncada(s). Configurações preservadas.`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
