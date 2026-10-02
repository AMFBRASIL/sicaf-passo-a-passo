import { apiFetch } from "@/lib/api-fetch";

export type PncpInteligencia = {
  termo: string;
  uf: string | null;
  meses: number;
  resumo: {
    licitacoes: number;
    valorEstimado: number;
    orgaos: number;
    abertas: number;
    contratos: number;
    valorContratado: number;
    empresasContratadas: number;
  };
  orgaos: {
    nome: string;
    uf: string | null;
    municipio: string | null;
    quantidade: number;
    valor: number;
    ultima: string | null;
  }[];
  porUf: { uf: string; quantidade: number; valor: number }[];
  porModalidade: { modalidade: string; quantidade: number }[];
  porMes: { mes: string; quantidade: number; valor: number }[];
  abertas: {
    id: number;
    orgao: string | null;
    uf: string | null;
    municipio: string | null;
    modalidade: string | null;
    objeto: string | null;
    encerramento: string | null;
    valor: number | null;
    numeroControlePncp: string | null;
    linkPortal: string | null;
    linkEdital: string | null;
  }[];
  fornecedores: { nome: string; cnpj: string | null; contratos: number; valor: number }[];
};

export async function fetchPncpInteligencia(params: {
  clienteId: number;
  q: string;
  uf?: string;
  meses?: number;
}) {
  const sp = new URLSearchParams({ clienteId: String(params.clienteId), q: params.q });
  if (params.uf) sp.set("uf", params.uf);
  if (params.meses) sp.set("meses", String(params.meses));
  const res = await apiFetch(`/api/pncp/inteligencia?${sp.toString()}`);
  const data = await res
    .json()
    .catch(() => ({ ok: false, error: "Resposta inválida do servidor" }));
  if (!data.ok) return { ok: false as const, error: String(data.error || "Erro na pesquisa") };
  return data as { ok: true } & PncpInteligencia;
}

/** Atalhos para as pesquisas oficiais do PNCP já filtradas pela palavra-chave. */
export function linksPncp(termo: string) {
  const q = encodeURIComponent(termo.trim());
  return {
    editaisAbertos: `https://pncp.gov.br/app/editais?q=${q}&status=recebendo_proposta&pagina=1`,
    editais: `https://pncp.gov.br/app/editais?q=${q}&pagina=1`,
    atas: `https://pncp.gov.br/app/atas?q=${q}&pagina=1`,
    contratos: `https://pncp.gov.br/app/contratos?q=${q}&pagina=1`,
    pca: `https://pncp.gov.br/app/pca?q=${q}&pagina=1`,
  };
}
