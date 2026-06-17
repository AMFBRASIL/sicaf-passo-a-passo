import type { RowDataPacket } from "mysql2/promise";
import { getWritePool } from "@/lib/db/mysql";
import { execute, queryOne, queryRows } from "@/lib/db/query";
import { buildInClause, safeDate, safeDecimal } from "@/modules/licitacoes/licitacoes.utils";

export type StatsBucket = { label: string; count: number };

export type LicitacaoRow = RowDataPacket & {
  id: number;
  numero_processo: string | null;
  numero_controle_pncp: string | null;
  origem: string | null;
  lei: string | null;
  modalidade: string | null;
  modo_disputa: string | null;
  tipo: string | null;
  criterio_julgamento: string | null;
  orgao_id: number | null;
  uasg_id: number | null;
  codigo_orgao: string | null;
  nome_orgao: string | null;
  codigo_uasg: string | null;
  nome_uasg: string | null;
  uf: string | null;
  municipio: string | null;
  esfera: string | null;
  objeto: string | null;
  objeto_resumido: string | null;
  informacoes_complementares: string | null;
  data_publicacao: Date | string | null;
  data_abertura: Date | string | null;
  data_encerramento: Date | string | null;
  data_homologacao: Date | string | null;
  valor_estimado: number | null;
  valor_homologado: number | null;
  status: string | null;
  situacao: string | null;
  srp: number | null;
  link_edital: string | null;
  link_portal: string | null;
};

export type MiraMetaRow = RowDataPacket & {
  licitacao_id: number;
  id: number;
  pipeline_status: string;
  notas: string | null;
  cliente_id: number | null;
  alertas_ativos: number;
  updated_at: Date | string | null;
};

export type ListFilters = {
  usuarioId: number;
  q?: string;
  status?: string[];
  modalidade?: string[];
  esfera?: string[];
  uf?: string[];
  lei?: string[];
  modoDisputa?: string[];
  criterio?: string[];
  origem?: string[];
  srp?: "all" | "sim" | "nao";
  valorMin?: number | null;
  valorMax?: number | null;
  dataFrom?: string | null;
  dataTo?: string | null;
  mira?: "" | "0" | "1";
  prazoMaxDays?: number | null;
  orderBy: string;
  orderDir: "asc" | "desc";
  limit: number;
  offset: number;
};

const GROUP_COLUMNS = [
  "status",
  "lei",
  "esfera",
  "uf",
  "modalidade",
  "origem",
  "modo_disputa",
  "criterio_julgamento",
] as const;

type LicitacoesStats = {
  total_licitacoes: number;
  total_orgaos: number;
  total_contratos: number;
  total_fornecedores: number;
  valor_estimado_total: number;
  por_status: StatsBucket[];
  por_lei: StatsBucket[];
  por_esfera: StatsBucket[];
  por_uf: StatsBucket[];
  por_modalidade: StatsBucket[];
  por_origem: StatsBucket[];
  por_modo_disputa: StatsBucket[];
  por_criterio_julgamento: StatsBucket[];
};

const STATS_CACHE_TTL_MS = 60_000;
let statsCache: { data: LicitacoesStats; expiresAt: number } | null = null;
let statsInflight: Promise<LicitacoesStats> | null = null;

export class LicitacoesRepository {
  private buildWhere(filters: ListFilters): { whereSql: string; params: Record<string, string | number> } {
    const parts: string[] = ["1=1"];
    const params: Record<string, string | number> = {};

    if (filters.mira === "1") {
      parts.push(
        "EXISTS (SELECT 1 FROM licitacoes_mira m WHERE m.licitacao_id = l.id AND m.usuario_id = :miraUsuario)",
      );
      params.miraUsuario = filters.usuarioId;
    } else if (filters.mira === "0") {
      parts.push(
        "NOT EXISTS (SELECT 1 FROM licitacoes_mira m WHERE m.licitacao_id = l.id AND m.usuario_id = :miraUsuario)",
      );
      params.miraUsuario = filters.usuarioId;
    }

    if (filters.q) {
      parts.push(
        `(l.numero_processo LIKE :q OR l.numero_controle_pncp LIKE :q OR l.nome_orgao LIKE :q OR l.nome_uasg LIKE :q OR l.objeto_resumido LIKE :q OR l.objeto LIKE :q)`,
      );
      params.q = `%${filters.q}%`;
    }

    const addIn = (column: string, values: string[] | undefined, prefix: string) => {
      if (!values?.length) return;
      const { sql, params: inParams } = buildInClause(values, prefix);
      parts.push(`l.${column} IN (${sql})`);
      Object.assign(params, inParams);
    };

    addIn("status", filters.status, "st");
    addIn("modalidade", filters.modalidade, "md");
    addIn("esfera", filters.esfera, "es");
    addIn("uf", filters.uf, "uf");
    addIn("lei", filters.lei, "le");
    addIn("modo_disputa", filters.modoDisputa, "mo");
    addIn("criterio_julgamento", filters.criterio, "cr");
    addIn("origem", filters.origem, "or");

    if (filters.srp === "sim") parts.push("l.srp = 1");
    else if (filters.srp === "nao") parts.push("l.srp = 0");

    if (filters.valorMin != null) {
      parts.push("l.valor_estimado >= :valorMin");
      params.valorMin = filters.valorMin;
    }
    if (filters.valorMax != null) {
      parts.push("l.valor_estimado <= :valorMax");
      params.valorMax = filters.valorMax;
    }
    if (filters.dataFrom) {
      parts.push("l.data_abertura >= :dataFrom");
      params.dataFrom = filters.dataFrom;
    }
    if (filters.dataTo) {
      parts.push("l.data_abertura <= :dataTo");
      params.dataTo = `${filters.dataTo} 23:59:59`;
    }
    if (filters.prazoMaxDays != null && filters.prazoMaxDays < 999) {
      parts.push(
        "COALESCE(l.data_encerramento, l.data_abertura) IS NOT NULL AND COALESCE(l.data_encerramento, l.data_abertura) >= NOW() AND COALESCE(l.data_encerramento, l.data_abertura) <= DATE_ADD(NOW(), INTERVAL :prazoMaxDays DAY)",
      );
      params.prazoMaxDays = filters.prazoMaxDays;
    }

    return { whereSql: parts.join(" AND "), params };
  }

  private async safeCount(pool: ReturnType<typeof getWritePool>, table: string) {
    try {
      const row = await queryOne<RowDataPacket & { total: number }>(
        pool,
        `SELECT COUNT(*) AS total FROM ${table}`,
      );
      return row;
    } catch {
      return { total: 0 };
    }
  }

  async groupTop(column: (typeof GROUP_COLUMNS)[number], limit = 8): Promise<StatsBucket[]> {
    const pool = getWritePool();
    const rows = await queryRows<RowDataPacket & { label: string; count: number }>(
      pool,
      `SELECT ${column} AS label, COUNT(*) AS count
         FROM licitacoes
        WHERE ${column} IS NOT NULL AND ${column} <> ''
        GROUP BY ${column}
        ORDER BY count DESC
        LIMIT :limit`,
      { limit },
    );
    return rows.map((r) => ({
      label: String(r.label ?? ""),
      count: Number(r.count ?? 0),
    }));
  }

  async getStats(): Promise<LicitacoesStats> {
    const now = Date.now();
    if (statsCache && statsCache.expiresAt > now) {
      return statsCache.data;
    }

    if (!statsInflight) {
      statsInflight = this.fetchStats()
        .then((data) => {
          statsCache = { data, expiresAt: Date.now() + STATS_CACHE_TTL_MS };
          return data;
        })
        .finally(() => {
          statsInflight = null;
        });
    }

    return statsInflight;
  }

  private async fetchStats(): Promise<LicitacoesStats> {
    const pool = getWritePool();

    const [
      totalRow,
      orgRow,
      valorRow,
      contratosRow,
      fornRow,
      por_status,
      por_lei,
      por_esfera,
      por_uf,
      por_modalidade,
      por_origem,
      por_modo_disputa,
      por_criterio_julgamento,
    ] = await Promise.all([
      queryOne<RowDataPacket & { total: number }>(pool, `SELECT COUNT(*) AS total FROM licitacoes`),
      queryOne<RowDataPacket & { total: number }>(
        pool,
        `SELECT COUNT(DISTINCT orgao_id) AS total FROM licitacoes WHERE orgao_id IS NOT NULL`,
      ),
      queryOne<RowDataPacket & { total: number }>(
        pool,
        `SELECT COALESCE(SUM(valor_estimado), 0) AS total FROM licitacoes`,
      ),
      this.safeCount(pool, "contratos"),
      this.safeCount(pool, "fornecedores"),
      this.groupTop("status", 12),
      this.groupTop("lei", 6),
      this.groupTop("esfera", 6),
      this.groupTop("uf", 30),
      this.groupTop("modalidade", 50),
      this.groupTop("origem", 10),
      this.groupTop("modo_disputa", 20),
      this.groupTop("criterio_julgamento", 20),
    ]);

    return {
      total_licitacoes: Number(totalRow?.total ?? 0),
      total_orgaos: Number(orgRow?.total ?? 0),
      total_contratos: Number(contratosRow?.total ?? 0),
      total_fornecedores: Number(fornRow?.total ?? 0),
      valor_estimado_total: Number(valorRow?.total ?? 0),
      por_status,
      por_lei,
      por_esfera,
      por_uf,
      por_modalidade,
      por_origem,
      por_modo_disputa,
      por_criterio_julgamento,
    };
  }

  /** KPIs rápidos para a home — só `licitacoes_mira` (sem scan em `licitacoes`). */
  async getHomeKpis(usuarioId: number) {
    const pool = getWritePool();
    const miraRow = await queryOne<RowDataPacket & { total: number }>(
      pool,
      `SELECT COUNT(*) AS total FROM licitacoes_mira WHERE usuario_id = :usuarioId`,
      { usuarioId },
    );

    return {
      na_mira: Number(miraRow?.total ?? 0),
      encerram_semana: 0,
      abertas_hoje: 0,
    };
  }

  async getPersonalKpisFull(usuarioId: number) {
    const pool = getWritePool();
    const [miraRow, encerramRow, abertasRow] = await Promise.all([
      queryOne<RowDataPacket & { total: number }>(
        pool,
        `SELECT COUNT(*) AS total FROM licitacoes_mira WHERE usuario_id = :usuarioId`,
        { usuarioId },
      ),
      queryOne<RowDataPacket & { total: number }>(
        pool,
        `SELECT COUNT(*) AS total FROM licitacoes
          WHERE data_encerramento >= NOW()
            AND data_encerramento <= DATE_ADD(NOW(), INTERVAL 7 DAY)`,
      ),
      queryOne<RowDataPacket & { total: number }>(
        pool,
        `SELECT COUNT(*) AS total FROM licitacoes
          WHERE data_abertura >= CURDATE()
            AND data_abertura < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`,
      ),
    ]);

    return {
      na_mira: Number(miraRow?.total ?? 0),
      encerram_semana: Number(encerramRow?.total ?? 0),
      abertas_hoje: Number(abertasRow?.total ?? 0),
    };
  }

  async distinctTop(column: string, limit = 50): Promise<{ value: string; count: number }[]> {
    const allowed = [...GROUP_COLUMNS, "modo_disputa", "criterio_julgamento"];
    if (!allowed.includes(column as (typeof allowed)[number])) {
      throw new Error(`Coluna inválida: ${column}`);
    }
    const pool = getWritePool();
    const rows = await queryRows<RowDataPacket & { value: string; count: number }>(
      pool,
      `SELECT ${column} AS value, COUNT(*) AS count
         FROM licitacoes
        WHERE ${column} IS NOT NULL AND ${column} <> ''
        GROUP BY ${column}
        ORDER BY count DESC
        LIMIT :limit`,
      { limit },
    );
    return rows.map((r) => ({
      value: String(r.value ?? ""),
      count: Number(r.count ?? 0),
    }));
  }

  async countList(filters: ListFilters): Promise<number> {
    const pool = getWritePool();
    const { whereSql, params } = this.buildWhere(filters);
    const row = await queryOne<RowDataPacket & { total: number }>(
      pool,
      `SELECT COUNT(*) AS total FROM licitacoes l WHERE ${whereSql}`,
      params,
    );
    return Number(row?.total ?? 0);
  }

  async list(filters: ListFilters): Promise<LicitacaoRow[]> {
    const pool = getWritePool();
    const { whereSql, params } = this.buildWhere(filters);
    const orderBy = filters.orderBy;
    const orderDir = filters.orderDir;

    return queryRows<LicitacaoRow>(
      pool,
      `SELECT
          l.id, l.numero_processo, l.numero_controle_pncp, l.origem, l.lei,
          l.modalidade, l.modo_disputa, l.tipo, l.criterio_julgamento,
          l.orgao_id, l.uasg_id, l.codigo_orgao, l.nome_orgao,
          l.codigo_uasg, l.nome_uasg, l.uf, l.municipio, l.esfera,
          l.objeto, l.objeto_resumido, l.informacoes_complementares,
          l.data_publicacao, l.data_abertura, l.data_encerramento,
          l.data_homologacao,
          l.valor_estimado, l.valor_homologado,
          l.status, l.situacao, l.srp,
          l.link_edital, l.link_portal
         FROM licitacoes l
        WHERE ${whereSql}
        ORDER BY l.${orderBy} ${orderDir}
        LIMIT :limit OFFSET :offset`,
      { ...params, limit: filters.limit, offset: filters.offset },
    );
  }

  async findById(id: number): Promise<LicitacaoRow | null> {
    const pool = getWritePool();
    return queryOne<LicitacaoRow>(pool, `SELECT * FROM licitacoes WHERE id = :id`, { id });
  }

  async getMiraMetaMap(usuarioId: number): Promise<Map<number, MiraMetaRow>> {
    const pool = getWritePool();
    const rows = await queryRows<MiraMetaRow>(
      pool,
      `SELECT id, licitacao_id, pipeline_status, notas, cliente_id, alertas_ativos, updated_at
         FROM licitacoes_mira
        WHERE usuario_id = :usuarioId`,
      { usuarioId },
    );
    const map = new Map<number, MiraMetaRow>();
    for (const r of rows) map.set(r.licitacao_id, r);
    return map;
  }

  async getMiraIds(usuarioId: number): Promise<number[]> {
    const pool = getWritePool();
    const rows = await queryRows<RowDataPacket & { licitacao_id: number }>(
      pool,
      `SELECT licitacao_id FROM licitacoes_mira WHERE usuario_id = :usuarioId`,
      { usuarioId },
    );
    return rows.map((r) => r.licitacao_id);
  }

  async confirmParticipacao(
    usuarioId: number,
    licitacaoId: number,
  ): Promise<{ pipeline_status: string }> {
    const pool = getWritePool();
    const existing = await queryOne<RowDataPacket & { id: number }>(
      pool,
      `SELECT id FROM licitacoes_mira WHERE usuario_id = :usuarioId AND licitacao_id = :licitacaoId`,
      { usuarioId, licitacaoId },
    );

    if (existing) {
      await execute(
        pool,
        `UPDATE licitacoes_mira SET pipeline_status = 'vai_participar' WHERE id = :id`,
        { id: existing.id },
      );
      return { pipeline_status: "vai_participar" };
    }

    await execute(
      pool,
      `INSERT INTO licitacoes_mira (usuario_id, licitacao_id, pipeline_status) VALUES (:usuarioId, :licitacaoId, 'vai_participar')`,
      { usuarioId, licitacaoId },
    );
    return { pipeline_status: "vai_participar" };
  }

  async toggleMira(usuarioId: number, licitacaoId: number): Promise<{ na_mira: boolean }> {
    const pool = getWritePool();
    const existing = await queryOne<RowDataPacket & { id: number }>(
      pool,
      `SELECT id FROM licitacoes_mira WHERE usuario_id = :usuarioId AND licitacao_id = :licitacaoId`,
      { usuarioId, licitacaoId },
    );

    if (existing) {
      await execute(
        pool,
        `DELETE FROM licitacoes_mira WHERE id = :id`,
        { id: existing.id },
      );
      return { na_mira: false };
    }

    await execute(
      pool,
      `INSERT INTO licitacoes_mira (usuario_id, licitacao_id, pipeline_status) VALUES (:usuarioId, :licitacaoId, 'na_mira')`,
      { usuarioId, licitacaoId },
    );
    return { na_mira: true };
  }

  parseListFiltersFromUrl(usuarioId: number, sp: URLSearchParams): ListFilters {
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? "20")));
    const allowedOrderBy = new Set([
      "data_publicacao",
      "data_abertura",
      "data_encerramento",
      "valor_estimado",
      "valor_homologado",
      "created_at",
    ]);
    const orderBy = allowedOrderBy.has(sp.get("order_by") ?? "")
      ? (sp.get("order_by") as string)
      : "data_abertura";
    const orderDir = sp.get("order_dir")?.toLowerCase() === "asc" ? "asc" : "desc";

    const prazoParam = sp.get("prazo_max_days");
    const prazoMaxDays = prazoParam ? Number(prazoParam) : null;

    return {
      usuarioId,
      q: String(sp.get("q") ?? "").trim() || undefined,
      status: this.split(sp.get("status")),
      modalidade: this.split(sp.get("modalidade")),
      esfera: this.split(sp.get("esfera")),
      uf: this.split(sp.get("uf")),
      lei: this.split(sp.get("lei")),
      modoDisputa: this.split(sp.get("modo_disputa")),
      criterio: this.split(sp.get("criterio_julgamento")),
      origem: this.split(sp.get("origem")),
      srp: (sp.get("srp") as "all" | "sim" | "nao") || "all",
      valorMin: safeDecimal(sp.get("valor_min")),
      valorMax: safeDecimal(sp.get("valor_max")),
      dataFrom: safeDate(sp.get("data_from")),
      dataTo: safeDate(sp.get("data_to")),
      mira: (sp.get("mira") === "1" ? "1" : sp.get("mira") === "0" ? "0" : "") as "" | "0" | "1",
      prazoMaxDays: prazoMaxDays != null && Number.isFinite(prazoMaxDays) ? prazoMaxDays : null,
      orderBy,
      orderDir,
      limit,
      offset: (page - 1) * limit,
    };
  }

  private split(raw: string | null): string[] | undefined {
    if (!raw) return undefined;
    const v = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return v.length ? v : undefined;
  }
}

export const licitacoesRepository = new LicitacoesRepository();
