import { apiFetch } from "@/lib/api-fetch";

export type PropostaModulo = {
  nome: string;
  valor: number | null;
  codigo?: string | null;
  descricao?: string | null;
};

export type PropostaComercial = {
  id: number;
  clienteId: number;
  protocoloCadastro: string;
  protocoloProposta: string;
  razaoSocial: string | null;
  documento: string | null;
  valorBase: number;
  valorExtras: number;
  valorTotal: number;
  periodicidade: string;
  modulosBase: PropostaModulo[];
  modulosExtras: PropostaModulo[];
  status: string;
  observacoes?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
};

export type PagamentoProposta = {
  pagamentoId?: number;
  tipo: "pix" | "boleto" | string;
  valor: number;
  vencimento?: string;
  protocolo?: string;
  barcode?: string | null;
  link?: string | null;
  pdf?: string | null;
  qrcodeText?: string | null;
  qrcodeImage?: string | null;
  txid?: string | null;
};

export async function fetchPropostasPendentes(): Promise<{
  ok: boolean;
  propostas: PropostaComercial[];
  total?: number;
  error?: string;
}> {
  const res = await apiFetch("/api/propostas");
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, propostas: [], error: data.error || "Erro ao carregar propostas" };
  }
  return {
    ok: true,
    propostas: (data.propostas || []) as PropostaComercial[],
    total: data.total,
  };
}

export async function cancelarPropostaComercial(
  propostaId: number,
  motivo?: string,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await apiFetch(`/api/propostas/${propostaId}/cancelar`, {
    method: "POST",
    body: JSON.stringify({ motivo: motivo || undefined }),
  });
  return res.json();
}

export async function pagarPropostaComercial(
  propostaId: number,
  formaPagamento: "pix" | "boleto",
  dataVencimento?: string,
): Promise<{
  ok: boolean;
  error?: string;
  pagamento?: PagamentoProposta;
  proposta?: PropostaComercial;
}> {
  const res = await apiFetch(`/api/propostas/${propostaId}/pagar`, {
    method: "POST",
    body: JSON.stringify({ formaPagamento, dataVencimento }),
  });
  return res.json();
}

export function formatMoedaProposta(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function labelPeriodicidade(p: string) {
  const s = String(p || "").toLowerCase();
  if (s === "mensal") return "Mensal";
  if (s === "trimestral") return "Trimestral";
  if (s === "semestral") return "Semestral";
  return "Anual";
}
