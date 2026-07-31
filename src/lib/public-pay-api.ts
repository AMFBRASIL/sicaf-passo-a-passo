import { apiFetch } from "@/lib/api-fetch";

export type PublicPayGuia = {
  id: string;
  tipo: string;
  descricao: string;
  competencia: string;
  vencimento: string;
  vencimentoIso: string | null;
  valor: number;
  status: "pendente" | "vencido" | "pago";
  dataPagamento?: string | null;
  pagamentoId: number | null;
  taxaId: number | null;
  formaPagamento: string | null;
  pixCopiaCola: string | null;
  pixQrImage: string | null;
  linhaDigitavel: string | null;
  linkBoleto: string | null;
  linkPdf: string | null;
  protocolo: string | null;
};

export type PublicPayPage = {
  codigo: string;
  payLink: string;
  /** Cobrança já quitada: a página vira comprovante, sem meios de pagamento. */
  quitado?: boolean;
  cliente: {
    nome: string;
    nomeMascarado: string;
    documento: string;
    email: string;
  };
  empresa: {
    razao: string;
    cnpj: string;
    documento?: string;
    tipoDocumento?: "CPF" | "CNPJ";
  };
  cidade: string;
  guias: PublicPayGuia[];
  focusGuiaId: string;
  resumo: {
    totalGuias: number;
    totalAberto: number;
    qtdVencidas: number;
  };
  pagamento: {
    pixCopiaCola: string | null;
    pixQrImage: string | null;
    linhaDigitavel: string | null;
    linkBoleto: string | null;
    linkPdf: string | null;
    formaPagamento: string | null;
  };
  expiraEm: string;
};

export type PublicPayGate = {
  codigo: string;
  requiresCnpj: boolean;
  requiresDocumento?: boolean;
  tipoDocumento?: "CPF" | "CNPJ";
  empresa: {
    razao: string;
    cnpjMascarado: string;
    documentoMascarado?: string;
    tipoDocumento?: "CPF" | "CNPJ";
  };
  message?: string;
};

export async function fetchPublicPayGate(code: string): Promise<{
  ok: boolean;
  error?: string;
} & Partial<PublicPayGate>> {
  const res = await apiFetch(`/api/public/pay/${encodeURIComponent(code)}`, { auth: false });
  return (await res.json()) as { ok: boolean; error?: string } & Partial<PublicPayGate>;
}

export async function verifyPublicPayAccess(
  code: string,
  documento: string,
): Promise<{
  ok: boolean;
  error?: string;
} & Partial<PublicPayPage>> {
  const res = await apiFetch(`/api/public/pay/${encodeURIComponent(code)}/verify`, {
    method: "POST",
    auth: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documento, cnpj: documento, cpf: documento }),
  });
  return (await res.json()) as { ok: boolean; error?: string } & Partial<PublicPayPage>;
}

/** Gera o PIX da guia na hora, quando a cobrança foi emitida só como boleto. */
export async function gerarPixPublicPay(
  code: string,
  documento: string,
  guiaId?: string | null,
): Promise<{
  ok: boolean;
  error?: string;
} & Partial<PublicPayPage>> {
  const res = await apiFetch(`/api/public/pay/${encodeURIComponent(code)}/pix`, {
    method: "POST",
    auth: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documento, guiaId: guiaId || undefined }),
  });
  return (await res.json()) as { ok: boolean; error?: string } & Partial<PublicPayPage>;
}

/** @deprecated Use fetchPublicPayGate + verifyPublicPayAccess */
export async function fetchPublicPayPage(code: string): Promise<{
  ok: boolean;
  error?: string;
} & Partial<PublicPayPage>> {
  const res = await apiFetch(`/api/public/pay/${encodeURIComponent(code)}`, { auth: false });
  return (await res.json()) as { ok: boolean; error?: string } & Partial<PublicPayPage>;
}
