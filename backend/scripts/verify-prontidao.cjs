#!/usr/bin/env node
/**
 * Valida /api/prontidao (serviço sicaf-agent) contra o banco.
 *
 * Uso:
 *   cd backend
 *   node scripts/verify-prontidao.cjs
 *   node scripts/verify-prontidao.cjs --usuario=123
 */
"use strict";

const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const usuarioArg = process.argv.find((a) => a.startsWith("--usuario="));
const usuarioId = usuarioArg
  ? Number(usuarioArg.split("=")[1])
  : Number(process.env.VERIFY_PRONTIDAO_USUARIO_ID || 0);

async function main() {
  const { getDb, pingDatabase } = require("../sicaf-agent/database/connection");
  const { getPortfolioProntidao } = require("../sicaf-agent/services/prontidao.service");

  const ping = await pingDatabase();
  if (!ping.ok) {
    console.error("[FAIL] Banco:", ping.error);
    process.exit(1);
  }
  console.log("[OK] Banco conectado");

  const db = getDb();
  let uid = usuarioId;
  if (!uid) {
    const row = await db("usuarios").select("id", "email").orderBy("id", "asc").first();
    if (!row) {
      console.error("[FAIL] Nenhum usuário em usuarios");
      process.exit(1);
    }
    uid = row.id;
    console.log(`[INFO] Usando usuário ${uid} (${row.email})`);
  }

  const result = await getPortfolioProntidao(uid, "");
  if (!result.ok) {
    console.error("[FAIL] getPortfolioProntidao:", result.error);
    process.exit(1);
  }

  const { empresas = [], resumo } = result;
  console.log(`[OK] ${empresas.length} empresa(s) no portfólio`);
  console.log("[OK] Resumo:", resumo);

  for (const e of empresas.slice(0, 5)) {
    console.log(
      `  - ${e.razao} | score=${e.score} | SICAF nív.${e.sicaf.nivel} | docs ${e.docs.ok}/${e.docs.total} | propostas=${e.propostas ?? 0}`,
    );
  }

  if (empresas.length > 5) console.log(`  ... +${empresas.length - 5} empresa(s)`);

  const clienteIds = empresas.map((e) => e.clienteId).filter(Boolean);
  if (clienteIds.length) {
    const dbCount = await db("clientes").whereIn("id", clienteIds).count({ total: "*" }).first();
    if (Number(dbCount?.total || 0) !== clienteIds.length) {
      console.error("[FAIL] clientes retornados não batem com o banco");
      process.exit(1);
    }
    console.log("[OK] IDs de clientes conferidos no banco");
  }

  console.log("\nProntidão validada com sucesso.");
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exit(1);
});
