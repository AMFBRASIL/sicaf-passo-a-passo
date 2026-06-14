import { apiFetch } from "@/lib/api-fetch";

export type PagamentoSicafItem = {
  id: number;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  dataVencimento: string | null;
  dataPagamento: string | null;
  formaPagamento: string | null;
  anoReferencia: number | null;
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

export type ClienteFinanceiroPainel = {
  resumo: {
    totalPendente: number;
    qtdPendentes: number;
    qtdVencidos: number;
  };
  sicaf: {
    pagos: PagamentoSicafItem[];
    pendentes: PagamentoSicafItem[];
  };
};

/** Pagamento SICAF já emitido (boleto ou PIX) aguardando compensação. */
export function isPagamentoSicafGerado(item: PagamentoSicafItem): boolean {
  if (!item.pendente || item.pago) return false;
  if (item.pagamentoId) return true;
  return Boolean(item.barcode || item.linkBoleto || item.qrcodeText);
}

export function isFormaPix(item: PagamentoSicafItem): boolean {
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
  pendentes: PagamentoSicafItem[];
}> {
  const res = await fetchClienteFinanceiro(clienteId);
  if (!res.ok || !res.financeiro) {
    return { ok: false, error: res.error, pendentes: [] };
  }
  const pendentes = (res.financeiro.sicaf?.pendentes || []).filter(isPagamentoSicafGerado);
  return { ok: true, pendentes };
}

export type FluxoPagamentoSicaf = "pendentes" | "novo";

/**
 * Regra 3 — sem taxa liberada: abre modal de pagamento.
 * Se já existem boletos/PIX gerados, retorna fluxo "pendentes" (wizard) em vez de criar outro.
 */
export async function detectarFluxoPagamentoSicaf(clienteId: number): Promise<{
  ok: boolean;
  fluxo: FluxoPagamentoSicaf;
  pendentes: PagamentoSicafItem[];
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
