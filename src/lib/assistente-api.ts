import { apiFetch } from "@/lib/api-fetch";
import type { NivelStatus } from "@/components/admin/nivel-dots";
import type { SnapshotSicaf } from "@/components/comparador-sicaf";
import { fetchEmpresaGerenciar, type EmpresaGerenciarPainel } from "@/lib/empresas-api";

const ROMAN_TO_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

const NIVEL_NOMES: Record<number, string> = {
  1: "Credenciamento",
  2: "Hab. Jurídica",
  3: "Reg. Fiscal",
  4: "Qual. Econômica",
  5: "Qual. Técnica",
  6: "Linha de Forn.",
};

export type AssistentePendencia = {
  id: string;
  nivel: string;
  titulo: string;
  detalhe: string;
  severidade: "alta" | "media" | "baixa";
  solucao: {
    passos: string[];
    prazo: string;
    onde: string;
  };
};

export type AssistenteHistoricoItem = {
  id: string;
  arquivo: string;
  data: string;
  hora: string;
  pendencias: number;
  status: "analisado" | "regular" | "atencao";
  resumo?: string;
  analiseRaw?: SicafAnaliseJson;
};

type SicafPendenciaApi = {
  nivel?: string | null;
  titulo?: string;
  problema?: string;
  prioridade?: string;
  solucao?: string;
  onde_resolver?: string;
};

export type SicafAnaliseJson = {
  resumo?: string;
  status_geral?: string;
  pendencias?: SicafPendenciaApi[];
  niveis_status?: { nivel?: string; nome?: string; status?: string; observacao?: string | null }[];
  proximos_passos?: string[];
};

type AnaliseRecord = {
  id: number;
  arquivoNome?: string | null;
  statusGeral?: string | null;
  resumo?: string | null;
  totalPendencias?: number;
  analise?: SicafAnaliseJson;
  niveisResumo?: { nivel?: string; status?: string }[];
  createdAt?: string;
};

function formatDateBr(iso?: string | null): { data: string; hora: string } {
  if (!iso) return { data: "—", hora: "—" };
  try {
    const d = new Date(iso);
    return {
      data: d.toLocaleDateString("pt-BR"),
      hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  } catch {
    return { data: "—", hora: "—" };
  }
}

function mapSeveridade(prioridade?: string): AssistentePendencia["severidade"] {
  const p = String(prioridade || "").toLowerCase();
  if (p.includes("alta") || p.includes("crit")) return "alta";
  if (p.includes("baixa")) return "baixa";
  return "media";
}

function mapSolucaoPassos(solucao?: string): string[] {
  if (!solucao?.trim()) {
    return ["Regularize no portal SICAF conforme orientação do Assistente CADBRASIL."];
  }
  const parts = solucao
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [solucao.trim()];
  return parts.map((p) => (p.endsWith(".") ? p : `${p}.`));
}

export function mapPendenciasFromAnalise(analise?: SicafAnaliseJson | null): AssistentePendencia[] {
  if (!analise?.pendencias?.length) return [];
  return analise.pendencias.map((p, i) => ({
    id: `p-${i}-${p.titulo?.slice(0, 12) || i}`,
    nivel: p.nivel ? `Nível ${p.nivel}` : "SICAF",
    titulo: p.titulo || "Pendência",
    detalhe: p.problema || p.titulo || "Requer atenção no cadastro SICAF.",
    severidade: mapSeveridade(p.prioridade),
    solucao: {
      passos: mapSolucaoPassos(p.solucao),
      prazo:
        analise.proximos_passos?.[0] ||
        (mapSeveridade(p.prioridade) === "alta" ? "Prioridade alta — resolva o quanto antes" : "Resolva em até 15 dias úteis"),
      onde: p.onde_resolver || "Portal SICAF / Compras.gov.br",
    },
  }));
}

export function mapNiveisFromPainel(
  niveisDetail?: EmpresaGerenciarPainel["niveisDetail"],
): Record<number, NivelStatus> {
  const out: Record<number, NivelStatus> = {};
  for (let i = 1; i <= 6; i++) out[i] = "nao_cadastrado";
  if (!niveisDetail) return out;

  for (const [key, info] of Object.entries(niveisDetail)) {
    const num = ROMAN_TO_NUM[key] ?? (Number.isFinite(Number(key)) ? Number(key) : null);
    if (num && num >= 1 && num <= 6) {
      out[num] = (info.status as NivelStatus) || "nao_cadastrado";
    }
  }
  return out;
}

function mapHistoricoStatus(totalPendencias: number, statusGeral?: string | null): AssistenteHistoricoItem["status"] {
  if (totalPendencias === 0) return "regular";
  const sg = String(statusGeral || "").toLowerCase();
  if (sg.includes("regular")) return "analisado";
  if (totalPendencias >= 3) return "atencao";
  return "analisado";
}

export function mapAnaliseToHistorico(a: AnaliseRecord): AssistenteHistoricoItem {
  const { data, hora } = formatDateBr(a.createdAt);
  const pendencias = a.totalPendencias ?? a.analise?.pendencias?.length ?? 0;
  return {
    id: String(a.id),
    arquivo: a.arquivoNome || `analise-${a.id}.pdf`,
    data,
    hora,
    pendencias,
    status: mapHistoricoStatus(pendencias, a.statusGeral || a.analise?.status_geral),
    resumo: a.resumo || a.analise?.resumo || undefined,
    analiseRaw: a.analise,
  };
}

function nivelAtivoFromStatus(status?: string): boolean {
  const s = String(status || "").toLowerCase();
  return s.includes("valid") || s.includes("regular") || s.includes("habilit");
}

function snapshotFromAnalise(
  analise: SicafAnaliseJson | undefined,
  validadeFallback: string,
): SnapshotSicaf {
  const niveisStatus = analise?.niveis_status || [];
  const niveis = [1, 2, 3, 4, 5, 6].map((num) => {
    const roman = ["", "I", "II", "III", "IV", "V", "VI"][num];
    const found = niveisStatus.find((n) => n.nivel === roman || n.nivel === String(num));
    return {
      numero: num,
      nome: found?.nome || NIVEL_NOMES[num],
      ativo: nivelAtivoFromStatus(found?.status),
    };
  });
  const pendencias = (analise?.pendencias || []).map((p) => p.titulo || p.problema || "Pendência").filter(Boolean);
  return {
    validade: validadeFallback,
    niveis,
    pendencias,
  };
}

export function buildComparadorSnapshots(
  historico: AssistenteHistoricoItem[],
  sicafValidade?: string | null,
): { antes: SnapshotSicaf; depois: SnapshotSicaf } | null {
  if (historico.length < 2) return null;
  const depoisItem = historico[0];
  const antesItem = historico[1];
  const validade = sicafValidade || "—";
  return {
    antes: snapshotFromAnalise(antesItem.analiseRaw, validade),
    depois: snapshotFromAnalise(depoisItem.analiseRaw, validade),
  };
}

export async function fetchAssistentePainel(clienteId: number) {
  return fetchEmpresaGerenciar(clienteId);
}

export async function fetchHistoricoAnalises(clienteId: number, limit = 20) {
  const res = await apiFetch(`/api/clients/${clienteId}/sicaf/analises?limit=${limit}`);
  const data = await res.json() as {
    ok: boolean;
    analises?: AnaliseRecord[];
    error?: string;
  };
  if (!data.ok) {
    return { ok: false as const, error: data.error || "Erro ao carregar histórico" };
  }
  return {
    ok: true as const,
    historico: (data.analises || []).map(mapAnaliseToHistorico),
  };
}

export async function fetchAnaliseDetalhe(clienteId: number, analiseId: number) {
  const res = await apiFetch(`/api/clients/${clienteId}/sicaf/analises/${analiseId}`);
  const data = await res.json() as {
    ok: boolean;
    analise?: AnaliseRecord;
    error?: string;
  };
  if (!data.ok || !data.analise) {
    return { ok: false as const, error: data.error || "Análise não encontrada" };
  }
  return {
    ok: true as const,
    historico: mapAnaliseToHistorico(data.analise),
    pendencias: mapPendenciasFromAnalise(data.analise.analise),
  };
}

export type AnalisarSituacaoResult = {
  ok: boolean;
  error?: string;
  message?: string;
  analise?: SicafAnaliseJson;
  analiseId?: number | null;
  saveWarning?: string | null;
  niveisResumo?: { nivel?: string; status?: string }[];
  certidoesInserted?: number;
  certidoesUpdated?: number;
};

export async function analisarSituacaoPdf(
  clienteId: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<AnalisarSituacaoResult> {
  onProgress?.(8);
  const formData = new FormData();
  formData.append("file", file, file.name);

  onProgress?.(25);
  const res = await apiFetch(`/api/clients/${clienteId}/sicaf/analisar-problema`, {
    method: "POST",
    body: formData,
  });

  onProgress?.(85);
  const data = await res.json() as AnalisarSituacaoResult & Record<string, unknown>;
  onProgress?.(100);

  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao analisar PDF" };
  }

  return {
    ok: true,
    message: data.message,
    analise: data.analise as SicafAnaliseJson | undefined,
    analiseId: data.analiseId ?? null,
    saveWarning: data.saveWarning ?? null,
    niveisResumo: data.niveisResumo as { nivel?: string; status?: string }[] | undefined,
    certidoesInserted: Number(data.certidoesInserted) || 0,
    certidoesUpdated: Number(data.certidoesUpdated) || 0,
  };
}
