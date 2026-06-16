import type { RowDataPacket } from "mysql2/promise";
import { getWritePool } from "@/lib/db/mysql";
import { queryOne } from "@/lib/db/query";

export type UsuarioRow = RowDataPacket & {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  telefone?: string | null;
  tipo_usuario: "admin" | "colaborador" | "cliente";
  status: "Ativo" | "Inativo" | "Bloqueado";
  perfil_id: number;
  avatar_iniciais?: string | null;
  departamento?: string | null;
  boas_vindas_visto_em?: string | null;
  deleted_at: string | null;
};

export type PerfilRow = RowDataPacket & {
  id: number;
  nome: string;
  tipo: string;
  ativo: number;
};

export class AuthRepository {
  async findById(id: number): Promise<UsuarioRow | null> {
    const pool = getWritePool();
    return queryOne<UsuarioRow>(
      pool,
      `SELECT id, nome, email, senha_hash, telefone, tipo_usuario, status, perfil_id,
              avatar_iniciais, departamento, boas_vindas_visto_em, deleted_at
         FROM usuarios
        WHERE id = :id
          AND deleted_at IS NULL
        LIMIT 1`,
      { id },
    );
  }

  async findByEmail(email: string): Promise<UsuarioRow | null> {
    const pool = getWritePool();
    return queryOne<UsuarioRow>(
      pool,
      `SELECT id, nome, email, senha_hash, telefone, tipo_usuario, status, perfil_id,
              avatar_iniciais, departamento, boas_vindas_visto_em, deleted_at
         FROM usuarios
        WHERE email = :email
          AND deleted_at IS NULL
        LIMIT 1`,
      { email: email.toLowerCase().trim() },
    );
  }

  async updateLastLogin(usuarioId: number, ip: string | null): Promise<void> {
    const pool = getWritePool();
    await pool.execute(
      `UPDATE usuarios
          SET ultimo_login = NOW(), ultimo_login_ip = :ip
        WHERE id = :id`,
      { id: usuarioId, ip },
    );
  }

  async insertLoginLog(
    usuarioId: number,
    sucesso: boolean,
    meta: {
      ip?: string | null;
      userAgent?: string | null;
      motivoFalha?: string;
      dispositivo?: string;
      navegador?: string;
      plataforma?: string;
    },
  ): Promise<void> {
    const pool = getWritePool();
    await pool.execute(
      `INSERT INTO login_logs
        (usuario_id, sucesso, motivo_falha, ip, user_agent, dispositivo, navegador, plataforma)
       VALUES
        (:usuarioId, :sucesso, :motivoFalha, :ip, :userAgent, :dispositivo, :navegador, :plataforma)`,
      {
        usuarioId,
        sucesso: sucesso ? 1 : 0,
        motivoFalha: meta.motivoFalha ?? null,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.substring(0, 500) ?? null,
        dispositivo: meta.dispositivo ?? null,
        navegador: meta.navegador ?? null,
        plataforma: meta.plataforma ?? null,
      },
    );
  }

  async updateProfile(
    usuarioId: number,
    data: Partial<Pick<UsuarioRow, "nome" | "email" | "telefone" | "departamento" | "senha_hash">>,
  ): Promise<void> {
    const pool = getWritePool();
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: usuarioId };

    if (data.nome !== undefined) {
      sets.push("nome = :nome");
      params.nome = data.nome;
    }
    if (data.email !== undefined) {
      sets.push("email = :email");
      params.email = data.email;
    }
    if (data.telefone !== undefined) {
      sets.push("telefone = :telefone");
      params.telefone = data.telefone;
    }
    if (data.departamento !== undefined) {
      sets.push("departamento = :departamento");
      params.departamento = data.departamento;
    }
    if (data.senha_hash !== undefined) {
      sets.push("senha_hash = :senhaHash");
      params.senhaHash = data.senha_hash;
    }

    if (!sets.length) return;

    sets.push("updated_at = NOW()");
    await pool.execute(
      `UPDATE usuarios SET ${sets.join(", ")} WHERE id = :id AND deleted_at IS NULL`,
      params,
    );
  }

  async findPerfilById(perfilId: number): Promise<PerfilRow | null> {
    const pool = getWritePool();
    return queryOne<PerfilRow>(
      pool,
      `SELECT id, nome, tipo, ativo FROM perfis_acesso WHERE id = :id LIMIT 1`,
      { id: perfilId },
    );
  }

  async listPermissoesByPerfil(perfilId: number): Promise<string[]> {
    const pool = getWritePool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pagina_id FROM permissoes_pagina
        WHERE perfil_id = :perfilId AND permitido = 1`,
      { perfilId },
    );
    return rows.map((r) => String(r.pagina_id));
  }
}

export const authRepository = new AuthRepository();
