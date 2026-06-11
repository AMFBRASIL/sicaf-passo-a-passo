import { apiFetch } from "@/lib/api-fetch";
import type { LicitacaoStats } from "@/components/licitacoes-indicators";

export type PrazoInfo = {
  label: string;
  urgency: string;
  days: number | null;
};

export type ApiLicitacao = {
  id: number;
  numero_processo: string | null;
  numero_controle_pncp: string | null;
  origem: string | null;
  lei: string | null;
  modalidade: string | null;
  modo_disputa: string | null;
  tipo: string | null;
  criterio_julgamento: string | null;
  nome_orgao: string | null;
  nome_uasg: string | null;
  uf: string | null;
  municipio: string | null;
  esfera: string | null;
  objeto: string | null;
  objeto_resumido: string | null;
  data_publicacao: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  valor_estimado: number | string | null;
  valor_homologado: number | string | null;
  status: string | null;
  situacao: string | null;
  srp: number | null;
  link_edital: string | null;
  link_portal: string | null;
  na_mira?: boolean;
  mira_meta?: unknown;
  prazo?: PrazoInfo;
};

export type LicitacaoPersonalKpis = {
  na_mira: number;
  encerram_semana: number;
  abertas_hoje: number;
};

export type FilterOption = { value: string; count: number };

export type LicitacoesFilterOptions = {
  status: FilterOption[];
  modalidades: FilterOption[];
  esferas: FilterOption[];
  ufs: FilterOption[];
  leis: FilterOption[];
  modos_disputa: FilterOption[];
  criterios_julgamento: FilterOption[];
  origens: FilterOption[];
};

export type LicitacoesListParams = {
  page?: number;
  limit?: number;
  q?: string;
  mira?: "0" | "1";
  uf?: string[];
  modalidade?: string[];
  valor_min?: number;
  valor_max?: number;
  prazo_max_days?: number;
  order_by?: string;
  order_dir?: "asc" | "desc";
};

export type LicitacoesListResponse = {
  ok: boolean;
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  licitacoes: ApiLicitacao[];
  error?: string;
};

export type LicitacoesStatsResponse = {
  ok: boolean;
  stats: LicitacaoStats;
  kpis: LicitacaoPersonalKpis;
  error?: string;
};

export type LicitacaoDisplay = {
  id: string;
  idNum: number;
  orgao: string;
  objeto: string;
  uf: string;
  modalidade: string;
  valor: string;
  valorNum: number;
  abertura: string;
  prazo: string;
  diasRestantes: number;
  match: number;
  destaque?: boolean;
  segmento: string;
  descricao: string;
  na_mira?: boolean;
  status?: string | null;
  numero_processo?: string | null;
  link_edital?: string | null;
};

function formatCurrency(raw: number | string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatDate(raw?: string | null): string {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return raw;
  }
}

export function computeMatchScore(item: ApiLicitacao): number {
  let s = 55;
  if (item.na_mira) s += 25;
  const d = item.prazo?.days;
  if (d != null && d >= 0 && d <= 7) s += 15;
  if (d != null && d >= 0 && d <= 3) s += 10;
  const valor = Number(item.valor_estimado);
  if (Number.isFinite(valor) && valor > 100_000) s += 5;
  return Math.min(99, s);
}

export function mapApiToDisplay(item: ApiLicitacao): LicitacaoDisplay {
  const valorNum = Number(item.valor_estimado) || 0;
  const orgao = [item.nome_orgao, item.municipio, item.uf].filter(Boolean).join(" / ") || "—";
  return {
    id: String(item.id),
    idNum: item.id,
    orgao,
    objeto: item.objeto_resumido || item.objeto || "—",
    uf: item.uf || "—",
    modalidade: item.modalidade || "—",
    valor: formatCurrency(item.valor_estimado),
    valorNum,
    abertura: formatDate(item.data_abertura),
    prazo: item.prazo?.label || "Sem prazo",
    diasRestantes: item.prazo?.days ?? 999,
    match: computeMatchScore(item),
    destaque: item.na_mira,
    segmento: item.esfera || item.modalidade || "—",
    descricao: item.objeto || item.objeto_resumido || "—",
    na_mira: item.na_mira,
    status: item.status,
    numero_processo: item.numero_processo,
    link_edital: item.link_edital,
  };
}

function buildQuery(params: LicitacoesListParams): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.q) sp.set("q", params.q);
  if (params.mira) sp.set("mira", params.mira);
  if (params.uf?.length) sp.set("uf", params.uf.join(","));
  if (params.modalidade?.length) sp.set("modalidade", params.modalidade.join(","));
  if (params.valor_min != null) sp.set("valor_min", String(params.valor_min));
  if (params.valor_max != null) sp.set("valor_max", String(params.valor_max));
  if (params.prazo_max_days != null) sp.set("prazo_max_days", String(params.prazo_max_days));
  if (params.order_by) sp.set("order_by", params.order_by);
  if (params.order_dir) sp.set("order_dir", params.order_dir);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchLicitacoesStats(
  options?: { kpisOnly?: boolean },
): Promise<LicitacoesStatsResponse> {
  const qs = options?.kpisOnly ? "?kpisOnly=1" : "";
  const res = await apiFetch(`/api/licitacoes/stats${qs}`);
  return res.json();
}

/** KPIs leves (home) — evita agregações pesadas na tabela licitacoes. */
export async function fetchLicitacoesKpis(): Promise<{
  ok: boolean;
  kpis?: LicitacaoPersonalKpis;
  error?: string;
}> {
  const res = await apiFetch("/api/licitacoes/kpis");
  return res.json();
}

export async function fetchLicitacoesFilters(): Promise<{
  ok: boolean;
  filters?: LicitacoesFilterOptions;
  error?: string;
}> {
  const res = await apiFetch("/api/licitacoes/filters");
  return res.json();
}

export async function fetchLicitacoesList(
  params: LicitacoesListParams,
): Promise<LicitacoesListResponse> {
  const res = await apiFetch(`/api/licitacoes${buildQuery(params)}`);
  return res.json();
}

export async function fetchLicitacaoDetail(id: number) {
  const res = await apiFetch(`/api/licitacoes/${id}`);
  return res.json();
}

export async function toggleLicitacaoMira(id: number) {
  const res = await apiFetch(`/api/licitacoes/${id}/mira`, { method: "POST" });
  return res.json();
}

export async function fetchMiraIds(): Promise<{ ok: boolean; ids?: number[]; total?: number }> {
  const res = await apiFetch("/api/licitacoes/mira");
  return res.json();
}
