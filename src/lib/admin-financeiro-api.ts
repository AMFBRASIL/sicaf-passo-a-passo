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

export type ClienteCobrancaPendente = {
  clienteId: number;
  taxaId: number | null;
  pagamentoId: number | null;
  company: string;
  cnpj: string;
  email: string;
  telefone: string;
  responsavel: string;
  descricao: string;
  valor: number;
  formaPagamento: string;
  dataVencimento: string | null;
  vencimentoFormatado: string;
  pendenteDesde: string | null;
  pendenteDesdeFormatado: string;
  diasPendente: number;
  status: string;
  origem: string;
  cidade?: string;
  severidade?: "leve" | "media" | "critica";
  payCode?: string;
  payLink?: string;
  foiCobrado: boolean;
  ultimaCobrancaEm: string | null;
  ultimaCobrancaFormatada: string;
  totalCobrancas: number;
};

export type CobrancaPendentesResumo = {
  total: number;
  totalVencidos: number;
  totalAguardando: number;
  totalCobrados: number;
  totalNaoCobrados: number;
  totalSemEmail: number;
  valorTotal: number;
  totalCriticos?: number;
  mediaAtrasoDias?: number;
};

export type CobrancaPendentesFiltros = {
  page?: number;
  pageSize?: number;
  q?: string;
  cobrado?: "todos" | "sim" | "nao";
  status?: "todos" | "vencido" | "aguardando";
  diasMin?: number | "";
  semEmail?: "todos" | "sim" | "nao";
};

export async function fetchCobrancasPendentes(
  filtros: CobrancaPendentesFiltros = {},
): Promise<{
  ok: boolean;
  error?: string;
  clientes?: ClienteCobrancaPendente[];
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  resumo?: CobrancaPendentesResumo;
}> {
  const params = new URLSearchParams();
  if (filtros.page) params.set("page", String(filtros.page));
  if (filtros.pageSize) params.set("pageSize", String(filtros.pageSize));
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.cobrado) params.set("cobrado", filtros.cobrado);
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.diasMin !== undefined && filtros.diasMin !== "") {
    params.set("diasMin", String(filtros.diasMin));
  }
  if (filtros.semEmail) params.set("semEmail", filtros.semEmail);

  const qs = params.toString();
  const res = await apiFetch(`/api/admin/financeiro/cobrancas-pendentes${qs ? `?${qs}` : ""}`);
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    clientes?: ClienteCobrancaPendente[];
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
    resumo?: CobrancaPendentesResumo;
  };
}

export async function enviarCobrancaCliente(opts: {
  clienteId: number;
  taxaId?: number | null;
  pagamentoId?: number | null;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  simulado?: boolean;
  para?: string;
  ultimaCobrancaFormatada?: string;
}> {
  const res = await apiFetch("/api/admin/financeiro/cobrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clienteId: opts.clienteId,
      taxaId: opts.taxaId ?? undefined,
      pagamentoId: opts.pagamentoId ?? undefined,
    }),
  });
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    message?: string;
    simulado?: boolean;
    para?: string;
    ultimaCobrancaFormatada?: string;
  };
}
