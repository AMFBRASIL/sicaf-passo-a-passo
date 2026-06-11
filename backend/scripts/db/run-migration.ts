/**
 * Executa 02_migration_etl.sql — migra dados cadbrasilsys → cadbrasilv2
 */
import {
  adaptSqlForEnvironment,
  createConnection,
  executeSqlFile,
  getCredentialsFromEnv,
  readSqlFile,
} from "./sql-runner";

async function main() {
  const { write, v2SchemaName, legacy } = getCredentialsFromEnv();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — ETL Migration");
  console.log(` ${legacy.database} (leitura) → ${v2SchemaName} (escrita)`);
  console.log("═══════════════════════════════════════════════════════");

  let raw = await readSqlFile("database/02_migration_etl.sql");
  raw = adaptSqlForEnvironment(raw, v2SchemaName, legacy.database);

  const conn = await createConnection(write, {
    database: v2SchemaName,
    multipleStatements: true,
  });

  try {
    await executeSqlFile(conn, raw, "02_migration_etl.sql");
    console.log("\n✅ Migração ETL concluída.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
