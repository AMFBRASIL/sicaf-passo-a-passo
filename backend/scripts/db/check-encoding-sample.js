require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const { initDatabase, getDb, closeDatabase } = require("../../sicaf-agent/database/connection");

async function main() {
  initDatabase();
  const db = getDb();

  const rows = await db("clientes")
    .where("razao_social", "like", "%Lavebras%")
    .select("id", "razao_social")
    .limit(5);

  for (const row of rows) {
    const raw = String(row.razao_social);
    const fixed = Buffer.from(raw, "latin1").toString("utf8");
    console.log("id:", row.id);
    console.log("raw:", raw);
    console.log("fixed:", fixed);
    console.log("utf8 hex:", Buffer.from(raw, "utf8").toString("hex"));
    console.log("---");
  }

  const cnt = await db("clientes").where("razao_social", "like", "%Ã%").count({ total: "*" });
  console.log("rows with Ã:", cnt[0]?.total ?? cnt);

  await closeDatabase();
}

main().catch(console.error);
