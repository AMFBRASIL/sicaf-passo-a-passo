import fs from "node:fs/promises";
import path from "node:path";
import { createConnection } from "mysql2/promise";
import { getCredentialsFromEnv } from "./sql-runner";

async function main() {
  const { write } = getCredentialsFromEnv();
  const sqlPath = path.resolve(__dirname, "../../../database/04_pagamento_comprovantes.sql");
  const raw = await fs.readFile(sqlPath, "utf8");

  const conn = await createConnection({
    host: write.host,
    port: write.port,
    user: write.user,
    password: write.password,
    database: write.database,
    multipleStatements: true,
  });

  const createStmt = raw
    .replace(/USE\s+`[^`]+`;\s*/i, "")
    .trim();

  await conn.query(createStmt);
  await conn.end();
  console.log("[OK] Tabela pagamento_comprovantes criada/verificada em", write.database);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
