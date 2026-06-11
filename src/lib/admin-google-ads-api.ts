import { apiFetch } from "@/lib/api-fetch";

export type GoogleAdsPalavra = {
  palavra: string;
  clicks: number;
  cadastros: number;
  pagos: number;
  pagosValidados: boolean;
  qtdPagamentos: number;
  conversoesTracking: number;
  receita: number;
  receitaFormatada: string;
  investimentoEstimado: number;
  roas: number | null;
  cpa: number | null;
  fat: number;
};

export type GoogleAdsClientePalavra = {
  clienteId: number;
  nome: string;
  documento?: string;
  sessoes: number;
  ultimaSessao?: string;
  comprou: boolean;
};

export type AdminGoogleAdsPainel = {
  periodo: { days: number; since: string };
  kpis: {
    investimento: number;
    investimentoFormatado: string;
    clicks: number;
    cadastros: number;
    pagos: number;
    receita: number;
    receitaFormatada: string;
    roasMedio: number | null;
    conversoesTracking: number;
  };
  palavras: GoogleAdsPalavra[];
  clientesPorPalavra?: GoogleAdsClientePalavra[];
  notas?: string[];
};

export async function fetchAdminGoogleAds(opts: {
  days?: number;
  palavra?: string;
} = {}): Promise<{ ok: boolean; error?: string } & Partial<AdminGoogleAdsPainel>> {
  const params = new URLSearchParams();
  if (opts.days) params.set("days", String(opts.days));
  if (opts.palavra?.trim()) params.set("palavra", opts.palavra.trim());
  const qs = params.toString();
  const res = await apiFetch(`/api/admin/google-ads${qs ? `?${qs}` : ""}`);
  return res.json();
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
