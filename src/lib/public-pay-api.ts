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
  cliente: {
    nome: string;
    nomeMascarado: string;
    documento: string;
    email: string;
  };
  empresa: {
    razao: string;
    cnpj: string;
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

export async function fetchPublicPayPage(code: string): Promise<{
  ok: boolean;
  error?: string;
} & Partial<PublicPayPage>> {
  const res = await apiFetch(`/api/public/pay/${encodeURIComponent(code)}`, { auth: false });
  return (await res.json()) as { ok: boolean; error?: string } & Partial<PublicPayPage>;
}
