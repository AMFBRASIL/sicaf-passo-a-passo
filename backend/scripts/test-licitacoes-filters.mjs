import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "72.61.59.152",
  port: 3306,
  user: "cadbrasilv2",
  password: "DjFcpn3Mhi7w6DCM",
  database: "cadbrasilv2",
  namedPlaceholders: true,
});

async function distinctTop(column, limit = 50) {
  const [rows] = await pool.query(
    `SELECT ${column} AS value, COUNT(*) AS count
       FROM licitacoes
      WHERE ${column} IS NOT NULL AND ${column} <> ''
      GROUP BY ${column}
      ORDER BY count DESC
      LIMIT :limit`,
    { limit },
  );
  return rows;
}

try {
  for (const col of [
    "status",
    "modalidade",
    "esfera",
    "uf",
    "lei",
    "modo_disputa",
    "criterio_julgamento",
    "origem",
  ]) {
    const rows = await distinctTop(col, col === "uf" ? 30 : col === "origem" ? 10 : 50);
    console.log(col, "ok", rows.length);
  }
} catch (e) {
  console.error("query failed:", e);
}

await pool.end();
