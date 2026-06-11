import { apiFetch } from "@/lib/api-fetch";

export type RevisaoAgendada = {
  id: string;
  origem: "manual" | "sicaf";
  clienteId: number;
  empresa: string;
  cnpj: string;
  dataAlvo: string;
  criadoEm: string | null;
  mesesLembrete: number | null;
  removivel: boolean;
  statusSicaf?: string | null;
};

export async function fetchRevisoesAgendadas() {
  const res = await apiFetch("/api/revisoes-agendadas");
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false as const,
      error: data.error || `Erro ${res.status} ao carregar revisões`,
    };
  }
  return res.json() as Promise<{
    ok: boolean;
    agendamentos?: RevisaoAgendada[];
    error?: string;
  }>;
}

export async function criarRevisaoAgendada(clienteId: number, meses: number) {
  const res = await apiFetch("/api/revisoes-agendadas", {
    method: "POST",
    body: JSON.stringify({ clienteId, meses }),
  });
  return res.json() as Promise<{
    ok: boolean;
    agendamento?: RevisaoAgendada;
    error?: string;
  }>;
}

export async function removerRevisaoAgendada(id: string) {
  const res = await apiFetch(`/api/revisoes-agendadas/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}
