import { apiFetch } from "@/lib/api-fetch";
import type { FluxoAutomacao } from "@/lib/automacoes-catalog";

export async function fetchAutomacaoFluxos() {
  const res = await apiFetch("/api/admin/automacoes");
  return res.json() as Promise<{ ok: boolean; fluxos?: FluxoAutomacao[]; error?: string }>;
}

export async function salvarAutomacaoFluxo(fluxo: FluxoAutomacao) {
  const res = await apiFetch("/api/admin/automacoes", {
    method: "POST",
    body: JSON.stringify(fluxo),
  });
  return res.json() as Promise<{
    ok: boolean;
    fluxo?: FluxoAutomacao;
    error?: string;
    message?: string;
  }>;
}

export async function toggleAutomacaoFluxo(id: string, ativo: boolean) {
  const res = await apiFetch(`/api/admin/automacoes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ativo }),
  });
  return res.json() as Promise<{
    ok: boolean;
    fluxo?: FluxoAutomacao;
    error?: string;
    message?: string;
  }>;
}
