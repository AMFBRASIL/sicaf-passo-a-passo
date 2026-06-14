#!/usr/bin/env node
/**
 * Empacota sicaf-agent/database/connection.js + knex + tarn + mysql2 em um único CJS.
 * Evita erros de dependências ausentes no serverless da Vercel.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const backendRoot = path.join(__dirname, "..");
const entry = path.join(backendRoot, "sicaf-agent", "database", "connection.js");
const outfile = path.join(backendRoot, "lib", "sicaf-db.bundle.cjs");

async function main() {
  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch {
    console.error("[bundle-sicaf-db] Instale esbuild: npm install -D esbuild");
    process.exit(1);
  }

  if (!fs.existsSync(entry)) {
    console.error("[bundle-sicaf-db] Entry não encontrado:", entry);
    process.exit(1);
  }

  const optionalKnexDialects = [
    "better-sqlite3",
    "sqlite3",
    "pg",
    "pg-native",
    "pg-query-stream",
    "mysql",
    "tedious",
    "oracledb",
  ];

  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    packages: "bundle",
    external: optionalKnexDialects,
    logLevel: "info",
    banner: {
      js: "/* sicaf-db bundle — gerado por scripts/bundle-sicaf-db.cjs — não editar */",
    },
  });

  const sizeKb = Math.round(fs.statSync(outfile).size / 1024);
  console.log(`[bundle-sicaf-db] OK → lib/sicaf-db.bundle.cjs (${sizeKb} KB)`);
}

main().catch((err) => {
  console.error("[bundle-sicaf-db] Falha:", err);
  process.exit(1);
});
