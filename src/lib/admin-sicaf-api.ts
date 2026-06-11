import { apiFetch } from "@/lib/api-fetch";
import type { NivelStatus } from "@/components/admin/nivel-dots";

export type SicafGestaoStatus = "completo" | "incompleto" | "vencendo" | "vencido";

export type SicafGestaoRow = {
  id: number;
  cli: string;
  cnpj: string;
  niveis: (boolean | "p")[];
  niveisDetalhe: Record<string, NivelStatus>;
  status: SicafGestaoStatus;
  diasVenc: number;
  sicafStatus?: string | null;
  sicafValidade?: string | null;
  sicafId?: number | null;
};

export type SicafGestaoCounts = {
  completo: number;
  incompleto: number;
  vencendo: number;
  vencido: number;
};

export async function fetchAdminSicaf(opts: {
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  ok: boolean;
  error?: string;
  rows?: SicafGestaoRow[];
  counts?: SicafGestaoCounts;
  total?: number;
}> {
  const params = new URLSearchParams();
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await apiFetch(`/api/admin/sicaf${qs ? `?${qs}` : ""}`);
  return res.json();
}
