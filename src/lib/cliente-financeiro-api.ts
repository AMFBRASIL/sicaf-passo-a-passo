import { apiFetch } from "@/lib/api-fetch";

export type PagamentoFinanceiroItem = {
  id: number;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  dataVencimento: string | null;
  dataPagamento: string | null;
  formaPagamento: string | null;
  anoReferencia: number | null;
  mesReferencia?: number | null;
  createdAt: string | null;
  pagamentoId: number | null;
  pago: boolean;
  pendente: boolean;
  vencido: boolean;
  linkPdf: string | null;
  linkBoleto: string | null;
  protocolo: string | null;
  barcode: string | null;
  qrcodeText: string | null;
  qrcodeImage: string | null;
  txid: string | null;
  chargeId: string | number | null;
};

/** @deprecated use PagamentoFinanceiroItem */
export type PagamentoSicafItem = PagamentoFinanceiroItem;

export type ClienteFinanceiroResumo = {
  totalPagoSicaf?: number;
  totalPagoManutencao?: number;
  totalPendente?: number;
  totalInadimplencia?: number;
  qtdPagoSicaf?: number;
  qtdPagoManutencao?: number;
  qtdPendentes?: number;
  qtdVencidos?: number;
};

export type ClienteFinanceiroPainel = {
  resumo: ClienteFinanceiroResumo;
  sicaf: {
    pagos: PagamentoFinanceiroItem[];
    pendentes: PagamentoFinanceiroItem[];
  };
  manutencao?: {
    pagos: PagamentoFinanceiroItem[];
    pendentes: PagamentoFinanceiroItem[];
  };
  personalizados?: PagamentoFinanceiroItem[];
  pendencias?: PagamentoFinanceiroItem[];
};

export function formatFinanceBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatFinanceDateBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("pt-BR");
  }
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

/** Pagamento SICAF já emitido (boleto ou PIX) aguardando compensação. */
export function isPagamentoSicafGerado(item: PagamentoFinanceiroItem): boolean {
  if (!item.pendente || item.pago) return false;
  if (item.pagamentoId) return true;
  return Boolean(item.barcode || item.linkBoleto || item.qrcodeText);
}

export function isFormaPix(item: PagamentoFinanceiroItem): boolean {
  const f = String(item.formaPagamento || "").toLowerCase();
  return f.includes("pix") || Boolean(item.qrcodeText || item.txid);
}

export async function fetchClienteFinanceiro(clienteId: number): Promise<{
  ok: boolean;
  error?: string;
  financeiro?: ClienteFinanceiroPainel;
}> {
  const res = await apiFetch(`/api/clients/${clienteId}/financeiro`);
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao carregar pagamentos" };
  }
  return { ok: true, financeiro: data.financeiro as ClienteFinanceiroPainel };
}

export async function fetchPagamentosSicafGerados(clienteId: number): Promise<{
  ok: boolean;
  error?: string;
  pendentes: PagamentoFinanceiroItem[];
}> {
  const res = await fetchClienteFinanceiro(clienteId);
  if (!res.ok || !res.financeiro) {
    return { ok: false, error: res.error, pendentes: [] };
  }
  const pendentes = (res.financeiro.sicaf?.pendentes || []).filter(isPagamentoSicafGerado);
  return { ok: true, pendentes };
}

export type FluxoPagamentoSicaf = "pendentes" | "novo";

export async function detectarFluxoPagamentoSicaf(clienteId: number): Promise<{
  ok: boolean;
  fluxo: FluxoPagamentoSicaf;
  pendentes: PagamentoFinanceiroItem[];
  error?: string;
}> {
  const res = await fetchPagamentosSicafGerados(clienteId);
  if (!res.ok) {
    return { ok: false, fluxo: "novo", pendentes: [], error: res.error };
  }
  return {
    ok: true,
    fluxo: res.pendentes.length > 0 ? "pendentes" : "novo",
    pendentes: res.pendentes,
  };
}

export type SituacaoFinanceiraEmpresa = "em_dia" | "pendente" | "vencido" | "sem_cobranca";

export function classificarSituacaoFinanceira(financeiro?: ClienteFinanceiroPainel | null): SituacaoFinanceiraEmpresa {
  if (!financeiro) return "sem_cobranca";
  const vencidos = financeiro.resumo?.qtdVencidos ?? 0;
  if (vencidos > 0) return "vencido";
  const pendentes = financeiro.resumo?.qtdPendentes ?? 0;
  if (pendentes > 0) return "pendente";
  const temHistorico =
    (financeiro.sicaf?.pagos?.length ?? 0) +
      (financeiro.sicaf?.pendentes?.length ?? 0) +
      (financeiro.manutencao?.pagos?.length ?? 0) +
      (financeiro.manutencao?.pendentes?.length ?? 0) >
    0;
  return temHistorico ? "em_dia" : "sem_cobranca";
}

export function labelSituacaoFinanceira(s: SituacaoFinanceiraEmpresa): string {
  if (s === "em_dia") return "Em dia";
  if (s === "pendente") return "Pagamento pendente";
  if (s === "vencido") return "Cobrança vencida";
  return "Sem cobranças";
}
