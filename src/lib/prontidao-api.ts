import { apiFetch } from "@/lib/api-fetch";

export type EmpresaProntidao = {
  id: string;
  razao: string;
  cnpj: string;
  uf: string;
  score: number;
  sicaf: { nivel: number; status: "ok" | "warn" | "danger" };
  certidoes: {
    ok: number;
    warn: number;
    danger: number;
    alertaCentral?: number;
    alertaCentralWarn?: number;
    alertaCentralDanger?: number;
  };
  docs: { ok: number; total: number };
  propostas?: number;
  prioridade: "alta" | "media" | "baixa";
  acao: string;
  clienteId?: number;
};

export async function fetchProntidao(search = "") {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const qs = params.toString();
  const res = await apiFetch(`/api/prontidao${qs ? `?${qs}` : ""}`);
  return res.json() as Promise<{
    ok: boolean;
    empresas?: EmpresaProntidao[];
    resumo?: { media: number; prontas: number; atencao: number; criticas: number };
    atualizadoEm?: string;
    error?: string;
  }>;
}
