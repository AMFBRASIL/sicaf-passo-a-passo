import { apiFetch } from "@/lib/api-fetch";

export type ConcorrenciaGrupo = {
  nome: string;
  quantidade: number;
  valor: number;
  percentual: number;
};

export type ConcorrenciaContrato = {
  id: number;
  numeroContrato: string | null;
  numeroControlePncp: string | null;
  orgao: string | null;
  objeto: string | null;
  modalidade: string | null;
  tipo: string | null;
  situacao: string | null;
  valor: number;
  dataAssinatura: string | null;
  dataPublicacao: string | null;
  dataInicioVigencia: string | null;
  dataFimVigencia: string | null;
  urlPncp: string | null;
};

export type ConcorrenciaBuscaResponse = {
  ok: boolean;
  error?: string;
  code?: string;
  empresa?: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    uf: string | null;
    municipio: string | null;
    fonteDados: string;
  };
  kpis?: {
    totalContratos: number;
    valorTotal: number;
    valorMedio: number;
    totalOrgaos: number;
  };
  orgaos?: ConcorrenciaGrupo[];
  modalidades?: ConcorrenciaGrupo[];
  ministerios?: ConcorrenciaGrupo[];
  contratos?: ConcorrenciaContrato[];
  totalContratos?: number;
  links?: {
    portalTransparencia: string;
  };
};

export function formatCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export async function fetchConcorrenciaBusca(cnpj: string): Promise<ConcorrenciaBuscaResponse> {
  const digits = cnpj.replace(/\D/g, "");
  const res = await apiFetch(`/api/concorrencia/busca?cnpj=${encodeURIComponent(digits)}`);
  const data = (await res.json()) as ConcorrenciaBuscaResponse;
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: data.error || "Não foi possível consultar os contratos do concorrente.",
      code: data.code,
    };
  }
  return data;
}
