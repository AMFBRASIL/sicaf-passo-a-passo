/**
 * Migração completa: TRUNCATE v2 → ETL legado → validação.
 *
 * Não importa tabelas de configuração (configuracoes_sistema, planos, templates, etc.).
 * Importa clientes, usuários, SICAF, manutenção, pagamentos e demais dados operacionais.
 *
 * Pré-requisitos:
 *   - Schema v2 aplicado (npm run db:schema)
 *   - Seeds de config/planos opcionais já rodados
 *   - .env com DB_LEGACY_* e DB_WRITE_* / DB_V2_SCHEMA_NAME
 *
 * Uso:
 *   npm run db:full-migrate -- --confirm
 *   npm run db:full-migrate -- --confirm --skip-validate
 *   npm run db:full-migrate -- --confirm --truncate-only
 *   npm run db:full-migrate -- --confirm --migrate-only
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { getCredentialsFromEnv } from "./sql-runner";
import { MIGRATION_DOMAINS } from "./migration-config";

const scriptsDbDir = path.join(process.cwd(), "scripts", "db");

function requireConfirm(): void {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "\n⚠️  Migração completa: TRUNCATE no v2 + importação do legado.\n" +
        "    Esta operação é destrutiva no banco v2.\n\n" +
        "    Reexecute com --confirm para continuar.\n",
    );
    process.exit(1);
  }
}

function runTsx(scriptName: string, extraArgs: string[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(scriptsDbDir, scriptName);
    const child = spawn("npx", ["tsx", scriptPath, ...extraArgs], {
      stdio: "inherit",
      shell: true,
      cwd: process.cwd(),
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main() {
  requireConfirm();

  const truncateOnly = process.argv.includes("--truncate-only");
  const migrateOnly = process.argv.includes("--migrate-only");
  const skipValidate = process.argv.includes("--skip-validate");

  if (truncateOnly && migrateOnly) {
    console.error("Use apenas um de: --truncate-only | --migrate-only");
    process.exit(1);
  }

  const { legacy, v2SchemaName } = getCredentialsFromEnv();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — Migração completa v1 → v2");
  console.log(` Origem:  ${legacy.database} @ ${legacy.host}`);
  console.log(` Destino: ${v2SchemaName}`);
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("Domínios migrados:");
  for (const d of MIGRATION_DOMAINS) console.log(`  • ${d}`);
  console.log("\nNão migrado: configuracoes_sistema, planos, templates_email, pacotes_leitura_ia, automacoes, funil_estagios, google_ads_campanhas\n");

  const started = Date.now();

  if (!migrateOnly) {
    console.log("── Etapa 1/3: TRUNCATE banco v2 ──\n");
    const code = await runTsx("truncate-v2-dados.ts", ["--confirm"]);
    if (code !== 0) process.exit(code);
    console.log("");
  }

  if (!truncateOnly) {
    console.log("── Etapa 2/3: ETL legado → v2 ──\n");
    const code = await runTsx("run-migration-node.ts", ["--dados"]);
    if (code !== 0) process.exit(code);
    console.log("");

    if (!skipValidate) {
      console.log("── Etapa 3/3: Validação ──\n");
      const vcode = await runTsx("run-validation-node.ts");
      if (vcode !== 0) process.exit(vcode);
    } else {
      console.log("── Etapa 3/3: Validação ignorada (--skip-validate) ──\n");
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n✅ Migração completa finalizada em ${secs}s.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
