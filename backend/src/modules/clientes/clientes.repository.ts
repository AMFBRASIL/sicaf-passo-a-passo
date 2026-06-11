import type { RowDataPacket } from "mysql2/promise";
import { getWritePool } from "@/lib/db/mysql";
import { queryOne, queryRows } from "@/lib/db/query";

export type ClienteRow = RowDataPacket & {
  id: number;
  documento: string;
  razao_social: string;
  nome_fantasia: string | null;
  status: string;
  usuario_id: number;
};

export class ClientesRepository {
  async list(limit = 50, offset = 0): Promise<ClienteRow[]> {
    const pool = getWritePool();
    return queryRows<ClienteRow>(
      pool,
      `SELECT id, documento, razao_social, nome_fantasia, status, usuario_id
         FROM clientes
        WHERE deleted_at IS NULL
        ORDER BY razao_social ASC
        LIMIT :limit OFFSET :offset`,
      { limit, offset },
    );
  }

  async findById(id: number): Promise<ClienteRow | null> {
    const pool = getWritePool();
    return queryOne<ClienteRow>(
      pool,
      `SELECT id, documento, razao_social, nome_fantasia, status, usuario_id
         FROM clientes
        WHERE id = :id AND deleted_at IS NULL`,
      { id },
    );
  }

  async count(): Promise<number> {
    const pool = getWritePool();
    const row = await queryOne<RowDataPacket & { total: number }>(
      pool,
      `SELECT COUNT(*) AS total FROM clientes WHERE deleted_at IS NULL`,
    );
    return row?.total ?? 0;
  }
}

export const clientesRepository = new ClientesRepository();
