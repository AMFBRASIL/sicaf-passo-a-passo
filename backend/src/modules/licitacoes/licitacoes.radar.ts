import type { RowDataPacket } from "mysql2/promise";
import { getWritePool } from "@/lib/db/mysql";
import { execute, queryOne, queryRows } from "@/lib/db/query";
import { AppError } from "@/lib/http/errors";
import type { LicitacaoRow } from "@/modules/licitacoes/licitacoes.repository";

export type RadarRuleRow = RowDataPacket & {
  id: number;
  usuario_id: number;
  nome: string;
  ativo: number;
  palavras_chave: string | null;
  ufs: string | null;
  modalidades: string | null;
  valor_min: number | null;
  valor_max: number | null;
  esfera: string | null;
  srp_filter: string | null;
  auto_mira: number;
  ultima_execucao_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

export type RadarRuleInput = {
  nome: string;
  ativo?: boolean;
  palavras_chave?: string[];
  ufs?: string[];
  modalidades?: string[];
  valor_min?: number | null;
  valor_max?: number | null;
  esfera?: string | null;
  srp_filter?: "all" | "sim" | "nao";
  auto_mira?: boolean;
};

export type RadarMatch = {
  licitacaoId: number;
  ruleId: number;
  ruleNome: string;
  numero_processo: string | null;
  nome_orgao: string | null;
  uf: string | null;
  modalidade: string | null;
  valor_estimado: number | null;
};

let radarTableReady = false;

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function toJsonArray(values?: string[]): string | null {
  if (!values?.length) return null;
  return JSON.stringify(values);
}

export function mapRadarRule(row: RadarRuleRow) {
  return {
    id: row.id,
    nome: row.nome,
    ativo: row.ativo !== 0,
    palavras_chave: parseJsonArray(row.palavras_chave),
    ufs: parseJsonArray(row.ufs),
    modalidades: parseJsonArray(row.modalidades),
    valor_min: row.valor_min != null ? Number(row.valor_min) : null,
    valor_max: row.valor_max != null ? Number(row.valor_max) : null,
    esfera: row.esfera,
    srp_filter: (row.srp_filter || "all") as "all" | "sim" | "nao",
    auto_mira: row.auto_mira !== 0,
    ultima_execucao_at: row.ultima_execucao_at,
    created_at: row.created_at,
  };
}

export function matchRadarRule(lic: LicitacaoRow, rule: RadarRuleRow): boolean {
  const keywords = parseJsonArray(rule.palavras_chave).map((k) => k.toLowerCase());
  const texto = `${lic.objeto_resumido || ""} ${lic.objeto || ""} ${lic.nome_orgao || ""}`.toLowerCase();
  if (keywords.length && !keywords.some((k) => texto.includes(k))) return false;

  const ufs = parseJsonArray(rule.ufs);
  if (ufs.length && lic.uf && !ufs.includes(lic.uf)) return false;

  const mods = parseJsonArray(rule.modalidades);
  if (mods.length && lic.modalidade && !mods.includes(lic.modalidade)) return false;

  if (rule.esfera && lic.esfera && rule.esfera !== lic.esfera) return false;

  const v = Number(lic.valor_estimado || 0);
  if (rule.valor_min != null && v < Number(rule.valor_min)) return false;
  if (rule.valor_max != null && v > Number(rule.valor_max)) return false;

  if (rule.srp_filter === "sim" && !lic.srp) return false;
  if (rule.srp_filter === "nao" && lic.srp) return false;

  return true;
}

async function ensureRadarTable(): Promise<void> {
  if (radarTableReady) return;
  const pool = getWritePool();
  await execute(
    pool,
    `CREATE TABLE IF NOT EXISTS licitacoes_radar_regras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nome VARCHAR(120) NOT NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      palavras_chave TEXT NULL,
      ufs TEXT NULL,
      modalidades TEXT NULL,
      valor_min DECIMAL(18,2) NULL,
      valor_max DECIMAL(18,2) NULL,
      esfera VARCHAR(40) NULL,
      srp_filter VARCHAR(8) NULL DEFAULT 'all',
      auto_mira TINYINT(1) NOT NULL DEFAULT 0,
      ultima_execucao_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_radar_usuario (usuario_id),
      INDEX idx_radar_ativo (ativo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  radarTableReady = true;
}

export class LicitacoesRadarRepository {
  async listRules(usuarioId: number) {
    await ensureRadarTable();
    const pool = getWritePool();
    const rows = await queryRows<RadarRuleRow>(
      pool,
      `SELECT * FROM licitacoes_radar_regras
        WHERE usuario_id = :usuarioId
        ORDER BY created_at DESC`,
      { usuarioId },
    );
    return rows.map(mapRadarRule);
  }

  async createRule(usuarioId: number, input: RadarRuleInput) {
    await ensureRadarTable();
    const nome = String(input.nome || "").trim().slice(0, 120);
    if (!nome) throw new AppError("Nome da regra é obrigatório", 400, "VALIDATION_ERROR");

    const pool = getWritePool();
    const result = await execute(
      pool,
      `INSERT INTO licitacoes_radar_regras
        (usuario_id, nome, ativo, palavras_chave, ufs, modalidades, valor_min, valor_max, esfera, srp_filter, auto_mira)
       VALUES
        (:usuarioId, :nome, :ativo, :palavrasChave, :ufs, :modalidades, :valorMin, :valorMax, :esfera, :srpFilter, :autoMira)`,
      {
        usuarioId,
        nome,
        ativo: input.ativo === false ? 0 : 1,
        palavrasChave: toJsonArray(input.palavras_chave),
        ufs: toJsonArray(input.ufs),
        modalidades: toJsonArray(input.modalidades),
        valorMin: input.valor_min ?? null,
        valorMax: input.valor_max ?? null,
        esfera: input.esfera || null,
        srpFilter: input.srp_filter || "all",
        autoMira: input.auto_mira ? 1 : 0,
      },
    );
    return { id: result.insertId };
  }

  async updateRule(usuarioId: number, ruleId: number, input: Partial<RadarRuleInput>) {
    await ensureRadarTable();
    const pool = getWritePool();
    const existing = await queryOne<RadarRuleRow>(
      pool,
      `SELECT id FROM licitacoes_radar_regras WHERE id = :ruleId AND usuario_id = :usuarioId`,
      { ruleId, usuarioId },
    );
    if (!existing) throw new AppError("Regra não encontrada", 404, "NOT_FOUND");

    const sets: string[] = [];
    const params: Record<string, string | number | null> = { ruleId, usuarioId };

    if (input.nome != null) {
      const nome = String(input.nome).trim().slice(0, 120);
      if (!nome) throw new AppError("Nome da regra é obrigatório", 400, "VALIDATION_ERROR");
      sets.push("nome = :nome");
      params.nome = nome;
    }
    if (input.ativo != null) {
      sets.push("ativo = :ativo");
      params.ativo = input.ativo ? 1 : 0;
    }
    if (input.palavras_chave != null) {
      sets.push("palavras_chave = :palavrasChave");
      params.palavrasChave = toJsonArray(input.palavras_chave);
    }
    if (input.ufs != null) {
      sets.push("ufs = :ufs");
      params.ufs = toJsonArray(input.ufs);
    }
    if (input.modalidades != null) {
      sets.push("modalidades = :modalidades");
      params.modalidades = toJsonArray(input.modalidades);
    }
    if (input.valor_min !== undefined) {
      sets.push("valor_min = :valorMin");
      params.valorMin = input.valor_min;
    }
    if (input.valor_max !== undefined) {
      sets.push("valor_max = :valorMax");
      params.valorMax = input.valor_max;
    }
    if (input.esfera !== undefined) {
      sets.push("esfera = :esfera");
      params.esfera = input.esfera;
    }
    if (input.srp_filter != null) {
      sets.push("srp_filter = :srpFilter");
      params.srpFilter = input.srp_filter;
    }
    if (input.auto_mira != null) {
      sets.push("auto_mira = :autoMira");
      params.autoMira = input.auto_mira ? 1 : 0;
    }

    if (!sets.length) return { ok: true };

    await execute(
      pool,
      `UPDATE licitacoes_radar_regras SET ${sets.join(", ")} WHERE id = :ruleId AND usuario_id = :usuarioId`,
      params,
    );
    return { ok: true };
  }

  async deleteRule(usuarioId: number, ruleId: number) {
    await ensureRadarTable();
    const pool = getWritePool();
    const result = await execute(
      pool,
      `DELETE FROM licitacoes_radar_regras WHERE id = :ruleId AND usuario_id = :usuarioId`,
      { ruleId, usuarioId },
    );
    if (!result.affectedRows) throw new AppError("Regra não encontrada", 404, "NOT_FOUND");
    return { ok: true };
  }

  async runRules(usuarioId: number, { autoMiraOnly = false } = {}) {
    await ensureRadarTable();
    const pool = getWritePool();

    const rules = await queryRows<RadarRuleRow>(
      pool,
      `SELECT * FROM licitacoes_radar_regras WHERE usuario_id = :usuarioId AND ativo = 1`,
      { usuarioId },
    );
    if (!rules.length) {
      return { matches: [] as RadarMatch[], addedToMira: 0 };
    }

    const recent = await queryRows<LicitacaoRow>(
      pool,
      `SELECT * FROM licitacoes ORDER BY created_at DESC LIMIT 200`,
    );

    const miraRows = await queryRows<RowDataPacket & { licitacao_id: number }>(
      pool,
      `SELECT licitacao_id FROM licitacoes_mira WHERE usuario_id = :usuarioId`,
      { usuarioId },
    );
    const miraIds = new Set(miraRows.map((r) => r.licitacao_id));

    const matches: RadarMatch[] = [];
    let addedToMira = 0;

    for (const lic of recent) {
      for (const rule of rules) {
        if (autoMiraOnly && !rule.auto_mira) continue;
        if (!matchRadarRule(lic, rule)) continue;

        matches.push({
          licitacaoId: lic.id,
          ruleId: rule.id,
          ruleNome: rule.nome,
          numero_processo: lic.numero_processo,
          nome_orgao: lic.nome_orgao,
          uf: lic.uf,
          modalidade: lic.modalidade,
          valor_estimado: lic.valor_estimado != null ? Number(lic.valor_estimado) : null,
        });

        if (rule.auto_mira && !miraIds.has(lic.id)) {
          await execute(
            pool,
            `INSERT INTO licitacoes_mira (usuario_id, licitacao_id, pipeline_status)
             VALUES (:usuarioId, :licitacaoId, 'na_mira')`,
            { usuarioId, licitacaoId: lic.id },
          ).catch(() => {});
          miraIds.add(lic.id);
          addedToMira += 1;
        }
        break;
      }
    }

    await execute(
      pool,
      `UPDATE licitacoes_radar_regras SET ultima_execucao_at = NOW() WHERE usuario_id = :usuarioId`,
      { usuarioId },
    );

    return { matches: matches.slice(0, 50), addedToMira };
  }
}

export const licitacoesRadarRepository = new LicitacoesRadarRepository();
