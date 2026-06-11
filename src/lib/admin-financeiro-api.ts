import { apiFetch } from "@/lib/api-fetch";

export type FinanceiroMovimento = {
  id: number;
  cliente: string;
  meio: string;
  valor: number;
  status: "Recebido" | "Aguardando" | "Vencido" | "Estornado";
  data: string;
  origem?: string;
  descricao?: string | null;
};

export type FinanceiroMeio = {
  name: string;
  value: number;
  valor: number;
  color: string;
};

export type AdminFinanceiroPainel = {
  kpis: {
    recebimentosHoje: number;
    recebimentosOntem: number;
    changeHoje: number;
    recebimentosMes: number;
    recebimentosMesAnterior: number;
    changeMes: number;
    inadimplentes: number;
    inadimplenciaValor: number;
    renovacoes30d: number;
    renovacoesDelta: number;
    cancelamentos30d: number;
    cancelamentosDelta: number;
  };
  serieMes: { d: string; v: number }[];
  meios: FinanceiroMeio[];
  movimentos: FinanceiroMovimento[];
};

export type PagamentoPendente = {
  id: number;
  company: string;
  cnpj: string;
  type: string;
  method: string;
  amountNumber: number;
  dueDate: string;
  generatedAt: string;
  status: string;
};

export async function fetchAdminFinanceiro(): Promise<{
  ok: boolean;
  error?: string;
  kpis?: AdminFinanceiroPainel["kpis"];
  serieMes?: AdminFinanceiroPainel["serieMes"];
  meios?: FinanceiroMeio[];
  movimentos?: FinanceiroMovimento[];
}> {
  const res = await apiFetch("/api/admin/financeiro");
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    kpis?: AdminFinanceiroPainel["kpis"];
    serieMes?: AdminFinanceiroPainel["serieMes"];
    meios?: FinanceiroMeio[];
    movimentos?: FinanceiroMovimento[];
  };
}

export async function fetchPagamentosPendentes(): Promise<{
  ok: boolean;
  error?: string;
  pagamentos?: PagamentoPendente[];
  total?: number;
}> {
  const res = await apiFetch("/api/admin/financeiro/pagamentos-pendentes");
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    pagamentos?: PagamentoPendente[];
    total?: number;
  };
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDeltaPct(change: number, suffix = "vs. ontem"): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toLocaleString("pt-BR")}% ${suffix}`;
}
