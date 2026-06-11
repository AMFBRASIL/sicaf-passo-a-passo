/**
 * Repara textos com mojibake (UTF-8 gravado como Latin-1) após migração v1 → v2.
 *
 * Uso:
 *   node scripts/db/fix-mojibake-dados.js --dry-run
 *   node scripts/db/fix-mojibake-dados.js --confirm
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const { initDatabase, getDb, closeDatabase } = require("../../sicaf-agent/database/connection");
const { fixMojibake, looksLikeMojibake } = require("../../sicaf-agent/utils/text-encoding");

const TARGETS = [
  { table: "clientes", columns: ["razao_social", "nome_fantasia", "cidade", "endereco", "bairro", "observacoes", "responsavel_nome", "ramo_atividade"] },
  { table: "usuarios", columns: ["nome", "departamento"] },
];

const BATCH = 500;

async function repairTable(db, { table, columns }, dryRun) {
  let totalFixed = 0;

  for (const col of columns) {
    let lastId = 0;
    let colFixed = 0;

    while (true) {
      const rows = await db(table)
        .where(col, "like", "%Ã%")
        .andWhere("id", ">", lastId)
        .orderBy("id", "asc")
        .limit(BATCH)
        .select("id", col);

      if (!rows.length) break;

      for (const row of rows) {
        lastId = row.id;
        const raw = row[col];
        if (!looksLikeMojibake(raw)) continue;
        const fixed = fixMojibake(raw);
        if (fixed === raw) continue;
        colFixed += 1;
        if (!dryRun) {
          await db(table).where("id", row.id).update({ [col]: fixed });
        }
      }

      if (rows.length < BATCH) break;
    }

    console.log(`  ${col}: ${colFixed} ${dryRun ? "seriam corrigidas" : "corrigidas"}`);
    totalFixed += colFixed;
  }

  return totalFixed;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");
  if (!dryRun && !confirm) {
    console.log("Use --dry-run ou --confirm");
    process.exit(1);
  }

  initDatabase();
  const db = getDb();
  if (!db) throw new Error("Banco indisponível");

  let grand = 0;
  for (const target of TARGETS) {
    console.log(`\n=== ${target.table} ===`);
    grand += await repairTable(db, target, dryRun);
  }

  const sample = await db("clientes")
    .where("razao_social", "like", "%Lavebras%")
    .select("id", "razao_social")
    .limit(3);
  console.log("\nAmostra Lavebras:");
  for (const row of sample) {
    console.log(`  [${row.id}] ${row.razao_social}`);
  }

  await closeDatabase();
  console.log(`\n${dryRun ? "(dry-run)" : "✔"} Total campos corrigidos: ${grand}`);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await closeDatabase();
  } catch (_) {}
  process.exit(1);
});
