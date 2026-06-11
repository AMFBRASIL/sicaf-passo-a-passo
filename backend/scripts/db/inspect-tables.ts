import type { RowDataPacket } from "mysql2/promise";
import { createConnection, getCredentialsFromEnv } from "./sql-runner";

async function main() {
  const { write, v2SchemaName } = getCredentialsFromEnv();
  const conn = await createConnection(write, { database: v2SchemaName });

  const tables = await conn.query<RowDataPacket[]>(
    `SELECT table_name, table_rows FROM information_schema.tables
      WHERE table_schema = ? ORDER BY table_name`,
    [v2SchemaName],
  );

  console.log("Tabelas:");
  for (const t of tables[0]) {
    console.log(` - ${t.table_name} (${t.table_rows} rows)`);
  }

  const fks = await conn.query<RowDataPacket[]>(
    `SELECT constraint_name, table_name, referenced_table_name
       FROM information_schema.referential_constraints
      WHERE constraint_schema = ?
        AND (table_name IN ('certidoes','tracking_sessoes')
             OR referenced_table_name IN ('certidoes','tracking_sessoes')
             OR constraint_name LIKE '%cert%')`,
    [v2SchemaName],
  );
  console.log("\nFKs relacionadas:");
  console.table(fks[0]);

  await conn.end();
}

main();
