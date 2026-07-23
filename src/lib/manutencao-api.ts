import { apiFetch } from "@/lib/api-fetch";

export type ParcelamentoManutencao = "avista" | "6x" | "12x";

export async function fetchValorManutencaoMensal(): Promise<number> {
  const res = await apiFetch("/api/sicaf/valores");
  const data = await res.json();
  if (data.ok && data.valores?.valorManutencaoMensal != null) {
    return Number(data.valores.valorManutencaoMensal) || 155;
  }
  return 155;
}

export function calcParcelamentoManutencao(valorMensal: number, parcelamento: ParcelamentoManutencao) {
  const totalAnual = valorMensal * 12;
  if (parcelamento === "avista") {
    return {
      parcelas: 1,
      valorParcela: totalAnual,
      total: totalAnual,
      titulo: "À vista",
      subtitulo: "1 boleto único · cobertura de 12 meses",
    };
  }
  const parcelas = parseInt(parcelamento, 10);
  const valorParcela = totalAnual / parcelas;
  return {
    parcelas,
    valorParcela,
    total: totalAnual,
    titulo: `${parcelas}x`,
    subtitulo:
      parcelas === 12
        ? "12 boletos mensais"
        : `${parcelas} boletos · a cada ${12 / parcelas} meses`,
  };
}

export function fmtBrl(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function ativarManutencao(
  clienteId: number,
  diaVencimento: number,
  parcelamento?: ParcelamentoManutencao | string,
) {
  const res = await apiFetch("/api/manutencao/ativar", {
    method: "POST",
    body: JSON.stringify({ clienteId, diaVencimento, parcelamento }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; message?: string }>;
}

export type ManutencaoBoleto = {
  id: number;
  mes?: number;
  ano?: number;
  valor: number;
  vencimento: string;
  status: string;
  dataPagamento?: string | null;
  formaPagamento?: string | null;
  pagamentoId?: number | null;
  protocolo?: string | null;
  linkPdf?: string | null;
  linkBoleto?: string | null;
  barcode?: string | null;
  txid?: string | null;
  chargeId?: string | number | null;
  referencia?: string | null;
};

export type ManutencaoBoletoDetalhe = {
  ok: boolean;
  error?: string;
  boleto?: ManutencaoBoleto;
  cliente?: {
    id: number;
    nome: string | null;
    email: string | null;
    cnpj: string | null;
    responsavel: string | null;
  };
};

export async function fetchManutencaoCliente(clienteId: number) {
  const res = await apiFetch(`/api/manutencao/${clienteId}`);
  return res.json() as Promise<{
    ok: boolean;
    manutencao?: {
      id: number;
      status: string;
      dataInicio: string;
      valor: number;
      boletos: ManutencaoBoleto[];
    } | null;
    error?: string;
  }>;
}

export async function fetchBoletoManutencaoDetalhe(boletoId: number) {
  const res = await apiFetch(`/api/manutencao/boletos/${boletoId}`);
  return res.json() as Promise<ManutencaoBoletoDetalhe>;
}

export async function enviarComprovanteManutencao(boletoId: number, emailDestino?: string) {
  const res = await apiFetch(`/api/manutencao/boletos/${boletoId}/enviar-comprovante`, {
    method: "POST",
    body: JSON.stringify(emailDestino ? { emailDestino } : {}),
  });
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    message?: string;
    emailNotificacao?: { enviado?: boolean; simulado?: boolean; para?: string };
  }>;
}

export async function autorizarBoletoManutencao(boletoId: number, clienteId: number) {
  const res = await apiFetch(`/api/manutencao/boletos/${boletoId}/autorizar-pagamento`, {
    method: "POST",
    body: JSON.stringify({ clienteId }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; message?: string }>;
}

export type PagamentoManutencaoGerado = {
  ok: boolean;
  error?: string;
  pagamentoId?: number;
  chargeId?: number;
  barcode?: string;
  link?: string;
  pdf?: string;
  valor?: number;
  vencimento?: string;
  protocolo?: string;
  txid?: string;
  qrcodeText?: string;
  qrcodeImage?: string;
};

export async function gerarBoletoManutencaoPagamento(
  boletoId: number,
  clienteId: number,
  dataVencimento?: string,
) {
  const res = await apiFetch("/api/pagamentos/manutencao/boleto", {
    method: "POST",
    body: JSON.stringify({ boletoId, clienteId, dataVencimento }),
  });
  return res.json() as Promise<PagamentoManutencaoGerado>;
}

export async function gerarPixManutencaoPagamento(boletoId: number, clienteId: number) {
  const res = await apiFetch("/api/pagamentos/manutencao/pix", {
    method: "POST",
    body: JSON.stringify({ boletoId, clienteId }),
  });
  return res.json() as Promise<PagamentoManutencaoGerado>;
}

export async function cancelarManutencao(clienteId: number, motivo?: string) {
  const res = await apiFetch(`/api/manutencao/${clienteId}/cancelar`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    message?: string;
    boletosRemovidos?: number;
  }>;
}
