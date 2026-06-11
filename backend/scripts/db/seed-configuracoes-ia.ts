/**
 * Insere chaves padrão de IA em configuracoes_sistema (INSERT IGNORE).
 *
 * Uso:
 *   npm run db:seed-config-ia
 *   npm run db:seed-config-ia -- --from-env
 *
 * --from-env  Se ia_api_key estiver vazia no banco, copia OPENAI_API_KEY do .env
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import {
  createConnection,
  executeSqlFile,
  getCredentialsFromEnv,
  readSqlFile,
} from "./sql-runner";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

const IA_KEYS = [
  "ia_provedor",
  "ia_modelo",
  "ia_api_key",
  "ia_max_tokens",
  "ia_temperatura",
  "ia_prompt_sistema",
  "ia_limite_requisicoes_dia",
  "ia_limite_por_cliente",
  "ia_bloquear_orcamento",
  "ia_orcamento_mensal_max",
] as const;

async function syncApiKeyFromEnv(
  conn: Awaited<ReturnType<typeof createConnection>>,
): Promise<void> {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    console.log("  ⚠ --from-env: OPENAI_API_KEY não definida no .env — ia_api_key não alterada");
    return;
  }

  const [rows] = await conn.query<{ valor: string | null }[]>(
    "SELECT valor FROM configuracoes_sistema WHERE chave = 'ia_api_key' LIMIT 1",
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  const atual = (row?.valor || "").trim();

  if (atual) {
    console.log("  ✔ ia_api_key já preenchida no banco — mantida (não sobrescreve)");
    return;
  }

  await conn.query(
    `UPDATE configuracoes_sistema SET valor = ?, updated_at = NOW() WHERE chave = 'ia_api_key'`,
    [apiKey],
  );
  console.log("  ✔ ia_api_key copiada do OPENAI_API_KEY (.env)");
}

async function printStatus(conn: Awaited<ReturnType<typeof createConnection>>) {
  const [rows] = await conn.query<{ chave: string; valor: string | null; categoria: string }[]>(
    `SELECT chave, valor, categoria FROM configuracoes_sistema
     WHERE chave IN (${IA_KEYS.map(() => "?").join(",")})
     ORDER BY chave`,
    [...IA_KEYS],
  );

  console.log("\n  Chaves IA no banco:");
  const list = Array.isArray(rows) ? rows : [];
  const byKey = new Map(list.map((r) => [r.chave, r]));

  for (const key of IA_KEYS) {
    const r = byKey.get(key);
    if (!r) {
      console.log(`    ✗ ${key} — ausente`);
      continue;
    }
    let display = r.valor ?? "";
    if (key === "ia_api_key") {
      display = display ? "******** (definida)" : "(vazia)";
    }
    if (key === "ia_prompt_sistema" && display.length > 40) {
      display = `${display.slice(0, 40)}…`;
    }
    console.log(`    ✔ ${key} = ${display || "(vazio)"}`);
  }
}

async function main() {
  const fromEnv = process.argv.includes("--from-env");
  const { write, v2SchemaName } = getCredentialsFromEnv();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — Seed configuracoes_sistema (IA)");
  console.log(` Banco: ${write.database || v2SchemaName} @ ${write.host}`);
  console.log("═══════════════════════════════════════════════════════\n");

  const conn = await createConnection(write, { database: write.database || v2SchemaName });

  try {
    const sql = await readSqlFile("database/seeds/configuracoes_ia.sql");
    await executeSqlFile(conn, sql, "configuracoes_ia.sql");

    if (fromEnv) {
      console.log("\n▶ Sincronizando API Key do .env");
      await syncApiKeyFromEnv(conn);
    } else {
      console.log("\n  Dica: npm run db:seed-config-ia -- --from-env copia OPENAI_API_KEY → ia_api_key");
    }

    await printStatus(conn);
    console.log("\n✔ Concluído. Ajuste valores em /admin/configuracoes → Inteligência Artificial.\n");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("✗ Falha:", err instanceof Error ? err.message : err);
  process.exit(1);
});
