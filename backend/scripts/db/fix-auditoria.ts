import type { RowDataPacket } from "mysql2/promise";
import { createConnection, getCredentialsFromEnv } from "./sql-runner";

async function main() {
  const { legacy, write, v2SchemaName } = getCredentialsFromEnv();
  const legacyConn = await createConnection(legacy, { database: legacy.database });
  const writeConn = await createConnection(write, { database: v2SchemaName });

  console.log("Corrigindo auditoria_log (remove duplicatas e reimporta)...");

  await writeConn.query("SET FOREIGN_KEY_CHECKS = 0");
  await writeConn.query("DELETE FROM auditoria_log");

  const [auditRows] = await legacyConn.query<RowDataPacket[]>(
    `SELECT usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, ip_address, created_at
       FROM audit_log`,
  );

  const [histRows] = await legacyConn.query<RowDataPacket[]>(
    `SELECT usuario_id, cliente_id, acao, entidade, entidade_id, created_at
       FROM historico_acoes`,
  );

  const [validUsers] = await writeConn.query<RowDataPacket[]>(`SELECT id FROM usuarios`);
  const validUserSet = new Set(validUsers.map((r) => Number(r.id)));

  let inserted = 0;
  let skippedFk = 0;

  for (const row of auditRows) {
    const usuarioId =
      row.usuario_id && validUserSet.has(Number(row.usuario_id)) ? row.usuario_id : null;
    if (row.usuario_id && !usuarioId) skippedFk++;

    await writeConn.query(
      `INSERT INTO auditoria_log
        (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        row.acao,
        row.entidade,
        row.entidade_id,
        row.dados_anteriores,
        row.dados_novos,
        row.ip_address,
        row.created_at,
      ],
    );
    inserted++;
  }

  for (const row of histRows) {
    const usuarioId =
      row.usuario_id && validUserSet.has(Number(row.usuario_id)) ? row.usuario_id : null;
    if (row.usuario_id && !usuarioId) skippedFk++;

    await writeConn.query(
      `INSERT INTO auditoria_log
        (usuario_id, cliente_id, acao, descricao, entidade, entidade_id, created_at)
       VALUES (?, ?, 'HISTORICO', ?, ?, ?, ?)`,
      [usuarioId, row.cliente_id, row.acao, row.entidade, row.entidade_id, row.created_at],
    );
    inserted++;
  }

  await writeConn.query("SET FOREIGN_KEY_CHECKS = 1");

  const [count] = await writeConn.query<RowDataPacket[]>(`SELECT COUNT(*) AS c FROM auditoria_log`);
  console.log(`✔ auditoria_log: ${count[0].c} registros (${inserted} inseridos, ${skippedFk} usuarios órfãos → NULL)`);

  await legacyConn.end();
  await writeConn.end();
}

main();
