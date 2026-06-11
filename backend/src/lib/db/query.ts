import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { AppError } from "@/lib/http/errors";

type QueryParams = Record<string, string | number | boolean | null | Date | Buffer>;

export async function queryRows<T extends RowDataPacket>(
  pool: Pool,
  sql: string,
  params?: QueryParams,
): Promise<T[]> {
  const [rows] = await pool.query<T[]>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  pool: Pool,
  sql: string,
  params?: QueryParams,
): Promise<T | null> {
  const rows = await queryRows<T>(pool, sql, params);
  return rows[0] ?? null;
}

export async function execute(
  pool: Pool,
  sql: string,
  params?: QueryParams,
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(
  pool: Pool,
  fn: (connection: Pool) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection as unknown as Pool);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function requireFound<T>(row: T | null, message = "Registro não encontrado"): T {
  if (!row) throw new AppError(message, 404, "NOT_FOUND");
  return row;
}
