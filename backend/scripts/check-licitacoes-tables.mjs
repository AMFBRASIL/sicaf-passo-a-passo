import mysql from "mysql2/promise";

async function check(label, config) {
  const pool = mysql.createPool({ ...config, namedPlaceholders: true });
  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'licitacoes'");
    console.log(label, "licitacoes table:", tables.length ? "exists" : "MISSING");
    if (tables.length) {
      const [cols] = await pool.query("SHOW COLUMNS FROM licitacoes");
      console.log(label, "columns:", cols.map((c) => c.Field).join(", "));
      const [count] = await pool.query("SELECT COUNT(*) AS n FROM licitacoes");
      console.log(label, "rows:", count[0]?.n);
    }
    const [mira] = await pool.query("SHOW TABLES LIKE 'licitacoes_mira'");
    console.log(label, "licitacoes_mira:", mira.length ? "exists" : "MISSING");
  } catch (e) {
    console.error(label, "error:", e.message);
  }
  await pool.end();
}

await check("v2", {
  host: "72.61.59.152",
  port: 3306,
  user: "cadbrasilv2",
  password: "DjFcpn3Mhi7w6DCM",
  database: "cadbrasilv2",
});

await check("legacy", {
  host: "72.61.59.152",
  port: 3306,
  user: "cadbrasilsys",
  password: "bpzBNYHhdAxr2pJ3",
  database: "cadbrasilsys",
});
