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

export type GoogleAdsPagamentoDetalhe = {
  id: string;
  clienteId: number;
  origem: "gerencianet" | "sicaf";
  origemLabel: string;
  valor: number;
  dataPagamento: string;
  status?: string;
  descricao: string;
  forma?: string | null;
};

export type GoogleAdsClientePago = {
  clienteId: number;
  nome: string;
  documento?: string;
  email?: string | null;
  telefone?: string | null;
  cadastroEm?: string;
  sessoes: number;
  primeiraSessao?: string | null;
  ultimaSessao?: string | null;
  pagamentos: GoogleAdsPagamentoDetalhe[];
  valorTotal: number;
  valorTotalFormatado: string;
  qtdPagamentos: number;
  primeiroPagamento?: string | null;
  ultimoPagamento?: string | null;
  diasAtePagar?: number | null;
};

export type GoogleAdsPagosDetalhe = {
  clientes: GoogleAdsClientePago[];
  resumo: {
    totalClientes: number;
    totalPagamentos: number;
    totalValor: number;
    totalValorFormatado: string;
  };
};

export type AdminGoogleAdsPainel = {
  periodo: { days: number; since: string };
  palavra?: string;
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
  pagosDetalhe?: GoogleAdsPagosDetalhe;
  notas?: string[];
};

export async function fetchAdminGoogleAds(opts: {
  days?: number;
  palavra?: string;
  pagos?: boolean;
} = {}): Promise<{ ok: boolean; error?: string } & Partial<AdminGoogleAdsPainel>> {
  const params = new URLSearchParams();
  if (opts.days) params.set("days", String(opts.days));
  if (opts.palavra?.trim()) params.set("palavra", opts.palavra.trim());
  if (opts.pagos) params.set("pagos", "1");
  const qs = params.toString();
  const res = await apiFetch(`/api/admin/google-ads${qs ? `?${qs}` : ""}`);
  return res.json();
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
