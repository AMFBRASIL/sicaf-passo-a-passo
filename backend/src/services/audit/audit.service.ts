import { getWritePool } from "@/lib/db/mysql";
import { execute } from "@/lib/db/query";
import { createModuleLogger } from "@/lib/logger/logger";

const log = createModuleLogger("audit");

export type AuditEntry = {
  usuarioId?: number | null;
  clienteId?: number | null;
  acao: string;
  descricao?: string;
  entidade: string;
  entidadeId?: number | null;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export class AuditService {
  private static instance: AuditService | null = null;

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  async log(entry: AuditEntry): Promise<void> {
    try {
      const pool = getWritePool();
      await execute(
        pool,
        `INSERT INTO auditoria_log
          (usuario_id, cliente_id, acao, descricao, entidade, entidade_id,
           dados_anteriores, dados_novos, ip_address, user_agent)
         VALUES
          (:usuarioId, :clienteId, :acao, :descricao, :entidade, :entidadeId,
           :dadosAnteriores, :dadosNovos, :ipAddress, :userAgent)`,
        {
          usuarioId: entry.usuarioId ?? null,
          clienteId: entry.clienteId ?? null,
          acao: entry.acao,
          descricao: entry.descricao ?? null,
          entidade: entry.entidade,
          entidadeId: entry.entidadeId ?? null,
          dadosAnteriores: entry.dadosAnteriores ? JSON.stringify(entry.dadosAnteriores) : null,
          dadosNovos: entry.dadosNovos ? JSON.stringify(entry.dadosNovos) : null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      );
    } catch (error) {
      log.error({ err: error, entry }, "Falha ao registrar auditoria");
    }
  }
}

export const auditService = AuditService.getInstance();
