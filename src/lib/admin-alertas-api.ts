import { apiFetch } from "@/lib/api-fetch";
import type { AlertaItem } from "@/components/admin/tratar-alerta-modal";

export type AdminAlerta = AlertaItem & {
  id: string;
  categoria: string;
  referenciaId: number;
  clienteId?: number | null;
  acaoUrl?: string | null;
  estado?: "ativo" | "tratado" | "ignorado";
};

export type AdminAlertasCounts = {
  ativos: number;
  tratados: number;
  ignorados: number;
  rose: number;
  amber: number;
};

export async function fetchAdminAlertas(): Promise<{
  ok: boolean;
  error?: string;
  ativos?: AdminAlerta[];
  historico?: AdminAlerta[];
  counts?: AdminAlertasCounts;
  totalComputados?: number;
}> {
  const res = await apiFetch("/api/admin/alertas");
  return res.json();
}

export async function tratarAlertaAdmin(payload: {
  id: string;
  categoria: string;
  referenciaId: number;
  clienteId?: number | null;
  tipo: string;
  cli: string;
  det: string;
  em: string;
  tom: AlertaItem["tom"];
  acaoUrl?: string | null;
  acao?: string;
  observacao?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await apiFetch("/api/admin/alertas/tratar", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function ignorarAlertaAdmin(payload: {
  id: string;
  categoria: string;
  referenciaId: number;
  clienteId?: number | null;
  tipo: string;
  cli: string;
  det: string;
  em: string;
  tom: AlertaItem["tom"];
  acaoUrl?: string | null;
  motivo: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await apiFetch("/api/admin/alertas/ignorar", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function marcarAlertasVistos(): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await apiFetch("/api/admin/alertas/marcar-vistos", { method: "POST" });
  return res.json();
}
