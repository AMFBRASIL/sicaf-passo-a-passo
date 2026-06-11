import { apiFetch } from "@/lib/api-fetch";

export type FunilEtapa = {
  nome: string;
  v: number;
  perda: boolean;
  color: string;
  convAnterior: number | null;
  pctDoTopo: number;
};

export type FunilInsight = {
  label: string;
  value: string;
  valor: string;
  tone: "rose" | "emerald" | "violet";
};

export async function fetchAdminFunil(opts: { days?: number } = {}): Promise<{
  ok: boolean;
  error?: string;
  periodo?: { days: number; since: string };
  etapas?: FunilEtapa[];
  insights?: FunilInsight[];
  resumo?: {
    taxaCadastro: number;
    taxaPagamento: number;
    taxaSicaf: number;
  };
}> {
  const params = new URLSearchParams();
  if (opts.days) params.set("days", String(opts.days));
  const qs = params.toString();
  const res = await apiFetch(`/api/admin/funil${qs ? `?${qs}` : ""}`);
  return res.json();
}
