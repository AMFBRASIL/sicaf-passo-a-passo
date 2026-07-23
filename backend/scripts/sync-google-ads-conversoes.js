/**
 * CLI — Sincroniza google_ads_conversoes
 *
 * Uso:
 *   npm run sync:google-ads-conversoes
 *   node scripts/sync-google-ads-conversoes.js --dry-run
 *   node scripts/sync-google-ads-conversoes.js --days=90
 *   node scripts/sync-google-ads-conversoes.js --truncate   # regenera com data_pagamento (não created_at)
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const { initDatabase } = require("../sicaf-agent/database/connection");
const { runGoogleAdsConversoesSync } = require("../sicaf-agent/services/google-ads-conversoes-sync.service");

function parseArgs(argv) {
  const opts = { days: 0, dryRun: false, truncate: false };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    if (arg === "--truncate") opts.truncate = true;
    const daysMatch = arg.match(/^--days=(\d+)$/);
    if (daysMatch) opts.days = Math.max(0, parseInt(daysMatch[1], 10));
  }
  return opts;
}

async function main() {
  initDatabase();
  const opts = parseArgs(process.argv.slice(2));

  console.log("");
  console.log("══════════════════════════════════════════════════════════");
  console.log("  Sync — google_ads_conversoes");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`  Período : ${opts.days > 0 ? `últimos ${opts.days} dias` : "todo o histórico"}`);
  console.log(
    `  Modo    : ${opts.dryRun ? "dry-run" : opts.truncate ? "substituir (truncate)" : "somente novos (append)"}`,
  );
  console.log("");

  const result = await runGoogleAdsConversoesSync({
    days: opts.days,
    dryRun: opts.dryRun,
    truncate: opts.truncate,
    log: (msg) => console.log(`  ${msg}`),
  });

  if (!result.ok) {
    console.error("  ✖ Erro:", result.error);
    if (result.sql) console.error(result.sql);
    process.exit(1);
  }

  if (result.stats) {
    console.log(`  Clientes elegíveis : ${result.stats.clientesElegiveis}`);
    console.log(`  Com GCLID          : ${result.stats.comGclid}`);
  }
  if (result.dryRun) {
    console.log(`  Linhas (preview)   : ${result.linhasPreview}`);
  } else {
    console.log(`  Inseridas          : ${result.inserted}`);
    if (result.totais) {
      console.log(`  Total na tabela    : ${result.totais.linhas}`);
    }
  }
  console.log("");
  console.log("  ✔", result.message || "Concluído.");
  process.exit(0);
}

main();
