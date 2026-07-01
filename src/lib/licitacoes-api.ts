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
  mira_meta?: {
    pipelineStatus?: string;
    notas?: string;
    clienteId?: number | null;
    alertasAtivos?: boolean;
  } | null;
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
  pipelineStatus?: string | null;
  vaiParticipar?: boolean;
  status?: string | null;
  numero_processo?: string | null;
  numero_controle_pncp?: string | null;
  link_edital?: string | null;
  link_portal?: string | null;
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

function isHttpUrl(value?: string | null): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Monta URL pública PNCP a partir do número de controle (CNPJ-1-SEQUENCIAL/ANO). */
export function buildPncpUrlFromControle(numeroControle?: string | null): string | null {
  const raw = String(numeroControle || "").trim();
  if (!raw) return null;

  const slashIdx = raw.lastIndexOf("/");
  if (slashIdx <= 0) return null;
  const ano = raw.slice(slashIdx + 1).replace(/\D/g, "");
  const prefix = raw.slice(0, slashIdx);
  const marker = "-1-";
  const markerIdx = prefix.lastIndexOf(marker);
  if (markerIdx <= 0 || ano.length !== 4) return null;

  const cnpj = prefix.slice(0, markerIdx).replace(/\D/g, "");
  const sequencial = prefix.slice(markerIdx + marker.length).replace(/\D/g, "");
  if (cnpj.length !== 14 || !sequencial) return null;

  const seq = String(parseInt(sequencial, 10));
  if (!seq || seq === "NaN") return null;

  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;
}

/** Corrige URLs PNCP no formato legado (/editais/CNPJ-1-SEQ/ANO → /editais/CNPJ/ANO/SEQ). */
export function normalizePncpEditalUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("pncp.gov.br")) return null;

    const canonical = u.pathname.match(/^\/app\/editais\/(\d{14})\/(\d{4})\/(\d+)\/?$/);
    if (canonical) return url;

    const malformed = u.pathname.match(/^\/app\/editais\/([^/]+)\/(\d{4})\/?$/);
    if (malformed?.[1]?.includes("-1-")) {
      return buildPncpUrlFromControle(`${malformed[1]}/${malformed[2]}`);
    }

    return url;
  } catch {
    return null;
  }
}

type LicitacaoLinkSource = Pick<
  ApiLicitacao | LicitacaoDisplay,
  "link_portal" | "link_edital" | "numero_controle_pncp"
>;

/** URL para participar da licitação no PNCP (página oficial da contratação). */
export function resolveLicitacaoPncpUrl(item: LicitacaoLinkSource): string | null {
  const fromControle = buildPncpUrlFromControle(item.numero_controle_pncp);
  if (fromControle) return fromControle;

  const portal = String(item.link_portal || "").trim();
  if (isHttpUrl(portal)) {
    if (portal.includes("pncp.gov.br")) {
      return normalizePncpEditalUrl(portal) ?? portal;
    }
    return portal;
  }

  const edital = String(item.link_edital || "").trim();
  if (isHttpUrl(edital)) {
    if (edital.includes("pncp.gov.br")) {
      return normalizePncpEditalUrl(edital) ?? edital;
    }
    return edital;
  }

  const controle = String(item.numero_controle_pncp || "").trim();
  if (controle) {
    return `https://pncp.gov.br/app/editais?palavraChave=${encodeURIComponent(controle)}`;
  }

  return null;
}

export function isVaiParticipar(pipelineStatus?: string | null): boolean {
  return pipelineStatus === "vai_participar";
}

export function mapApiToDisplay(item: ApiLicitacao): LicitacaoDisplay {
  const valorNum = Number(item.valor_estimado) || 0;
  const orgao = [item.nome_orgao, item.municipio, item.uf].filter(Boolean).join(" / ") || "—";
  const pipelineStatus = item.mira_meta?.pipelineStatus ?? null;
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
    pipelineStatus,
    vaiParticipar: isVaiParticipar(pipelineStatus),
    status: item.status,
    numero_processo: item.numero_processo,
    numero_controle_pncp: item.numero_controle_pncp,
    link_edital: item.link_edital,
    link_portal: item.link_portal,
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

export async function confirmarLicitacaoParticipacao(id: number) {
  const res = await apiFetch(`/api/licitacoes/${id}/participacao`, { method: "POST" });
  return res.json() as Promise<{
    ok: boolean;
    pipelineStatus?: string;
    na_mira?: boolean;
    message?: string;
    error?: string;
  }>;
}

export async function fetchMiraIds(): Promise<{ ok: boolean; ids?: number[]; total?: number }> {
  const res = await apiFetch("/api/licitacoes/mira");
  return res.json();
}

export type RadarRule = {
  id: number;
  nome: string;
  ativo: boolean;
  palavras_chave: string[];
  ufs: string[];
  modalidades: string[];
  valor_min: number | null;
  valor_max: number | null;
  esfera: string | null;
  srp_filter: "all" | "sim" | "nao";
  auto_mira: boolean;
  ultima_execucao_at: string | null;
  created_at: string | null;
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

export async function fetchRadarRules(): Promise<{
  ok: boolean;
  rules?: RadarRule[];
  error?: string;
}> {
  const res = await apiFetch("/api/licitacoes/radar");
  return res.json();
}

export async function createRadarRule(input: RadarRuleInput) {
  const res = await apiFetch("/api/licitacoes/radar", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function updateRadarRule(id: number, input: Partial<RadarRuleInput>) {
  const res = await apiFetch(`/api/licitacoes/radar/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function deleteRadarRule(id: number) {
  const res = await apiFetch(`/api/licitacoes/radar/${id}`, { method: "DELETE" });
  return res.json();
}

export async function runRadar(options?: { autoMiraOnly?: boolean }): Promise<{
  ok: boolean;
  matches?: RadarMatch[];
  addedToMira?: number;
  error?: string;
}> {
  const res = await apiFetch("/api/licitacoes/radar/run", {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
  return res.json();
}
