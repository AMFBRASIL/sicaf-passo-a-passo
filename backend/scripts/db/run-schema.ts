/**
 * Aplica 01_schema_v2.sql no banco v2.
 * ATENÇÃO: o script original faz DROP DATABASE — use apenas em ambiente controlado.
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
  const force = process.argv.includes("--force");

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — Schema v2");
  console.log(` Target DB: ${v2SchemaName} @ ${write.host}`);
  console.log("═══════════════════════════════════════════════════════");

  if (!force) {
    console.error(
      "\n⚠  Este script recria o banco do zero (DROP DATABASE).\n" +
        "   Execute com --force para confirmar:\n" +
        "   npm run db:schema -- --force\n",
    );
    process.exit(1);
  }

  let raw = await readSqlFile("database/01_schema_v2.sql");
  raw = adaptSqlForEnvironment(raw, v2SchemaName, legacy.database);

  const conn = await createConnection(write, { multipleStatements: true });

  try {
    await executeSqlFile(conn, raw, "01_schema_v2.sql");
    console.log("\n✅ Schema v2 aplicado com sucesso.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
