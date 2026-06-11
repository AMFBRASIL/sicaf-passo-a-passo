/**
 * Insere chaves padrão de Armazenamento em configuracoes_sistema (INSERT IGNORE).
 *
 * Uso:
 *   npm run db:seed-config-storage
 *   npm run db:seed-config-storage -- --from-env
 *
 * --from-env  Copia STORAGE_* do .env para chaves vazias no banco
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

const ENV_MAP: Record<string, string> = {
  storage_provedor: "STORAGE_PROVIDER",
  storage_local_path: "STORAGE_LOCAL_PATH",
  storage_local_base_url: "STORAGE_LOCAL_BASE_URL",
  storage_s3_bucket: "STORAGE_S3_BUCKET",
  storage_s3_region: "STORAGE_S3_REGION",
  storage_s3_access_key_id: "STORAGE_S3_ACCESS_KEY_ID",
  storage_s3_secret_access_key: "STORAGE_S3_SECRET_ACCESS_KEY",
  storage_s3_endpoint: "STORAGE_S3_ENDPOINT",
  storage_s3_use_path_style: "STORAGE_S3_USE_PATH_STYLE",
  storage_cdn_url: "STORAGE_CDN_URL",
  storage_max_file_size_mb: "STORAGE_MAX_FILE_SIZE_MB",
  storage_allowed_extensions: "STORAGE_ALLOWED_EXTENSIONS",
};

const STORAGE_KEYS = [
  "storage_provedor",
  "storage_local_path",
  "storage_local_base_url",
  "storage_s3_bucket",
  "storage_s3_region",
  "storage_s3_access_key_id",
  "storage_s3_secret_access_key",
  "storage_s3_endpoint",
  "storage_s3_use_path_style",
  "storage_cdn_url",
  "storage_max_file_size_mb",
  "storage_allowed_extensions",
  "storage_retencao_meses",
  "storage_versoes_por_arquivo",
  "storage_versionamento_ativo",
  "storage_mover_frio",
  "storage_frio_dias",
  "storage_excluir_apos_retencao",
  "storage_quota_gb",
] as const;

function mapProviderFromEnv(raw: string): string {
  const p = raw.trim().toLowerCase();
  return p === "s3" ? "s3" : "lovable_cloud";
}

async function syncFromEnv(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  let updated = 0;
  const alwaysSync = new Set([
    "storage_provedor",
    "storage_max_file_size_mb",
    "storage_allowed_extensions",
  ]);

  for (const [chave, envKey] of Object.entries(ENV_MAP)) {
    let valor = (process.env[envKey] || "").trim();
    if (!valor && chave !== "storage_s3_endpoint" && chave !== "storage_cdn_url") continue;

    if (chave === "storage_provedor") {
      valor = mapProviderFromEnv(valor || "local");
    }
    if (chave === "storage_s3_use_path_style") {
      valor = valor.toLowerCase() === "true" ? "true" : "false";
    }

    const [rows] = await conn.query<{ valor: string | null }[]>(
      "SELECT valor FROM configuracoes_sistema WHERE chave = ? LIMIT 1",
      [chave],
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    const atual = (row?.valor || "").trim();

    if (chave === "storage_s3_secret_access_key" && atual) {
      console.log("  ✔ storage_s3_secret_access_key já preenchida — mantida");
      continue;
    }
    if (atual && !alwaysSync.has(chave)) continue;

    await conn.query(
      "UPDATE configuracoes_sistema SET valor = ?, updated_at = NOW() WHERE chave = ?",
      [valor, chave],
    );
    updated++;
    const display = chave === "storage_s3_secret_access_key" ? "********" : valor || "(vazio)";
    console.log(`  ✔ ${chave} ← ${envKey} (${display})`);
  }

  if (!updated) {
    console.log("  ℹ Nenhuma chave atualizada a partir do .env");
  }
}

async function printStatus(conn: Awaited<ReturnType<typeof createConnection>>) {
  const [rows] = await conn.query<{ chave: string; valor: string | null }[]>(
    `SELECT chave, valor FROM configuracoes_sistema
     WHERE chave IN (${STORAGE_KEYS.map(() => "?").join(",")})
     ORDER BY chave`,
    [...STORAGE_KEYS],
  );

  console.log("\n  Chaves Storage no banco:");
  const list = Array.isArray(rows) ? rows : [];
  const byKey = new Map(list.map((r) => [r.chave, r]));

  for (const key of STORAGE_KEYS) {
    const r = byKey.get(key);
    if (!r) {
      console.log(`    ✗ ${key} — ausente`);
      continue;
    }
    let display = r.valor ?? "";
    if (key === "storage_s3_secret_access_key") {
      display = display ? "******** (definida)" : "(vazia)";
    }
    console.log(`    ✔ ${key} = ${display || "(vazio)"}`);
  }
}

async function main() {
  const fromEnv = process.argv.includes("--from-env");
  const { write, v2SchemaName } = getCredentialsFromEnv();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — Seed configuracoes_sistema (Storage)");
  console.log(` Banco: ${write.database || v2SchemaName} @ ${write.host}`);
  console.log("═══════════════════════════════════════════════════════\n");

  const conn = await createConnection(write, { database: write.database || v2SchemaName });

  try {
    const sql = await readSqlFile("database/seeds/configuracoes_storage.sql");
    await executeSqlFile(conn, sql, "configuracoes_storage.sql");

    if (fromEnv) {
      console.log("\n▶ Sincronizando STORAGE_* do .env");
      await syncFromEnv(conn);
    } else {
      console.log("\n  Dica: npm run db:seed-config-storage -- --from-env copia STORAGE_* → banco");
    }

    await printStatus(conn);
    console.log("\n✔ Concluído. Ajuste valores em /admin/configuracoes → Armazenamento.\n");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("✗ Falha:", err instanceof Error ? err.message : err);
  process.exit(1);
});
