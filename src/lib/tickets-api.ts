import { apiFetch } from "@/lib/api-fetch";

export type TicketResumo = {
  id: string;
  dbId?: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  assignee: string;
  messageCount: number;
};

export type TicketMensagem = {
  id: number;
  sender: string;
  senderName: string;
  message: string;
  date: string;
  anexos?: TicketAnexo[];
};

export type TicketAnexo = {
  id: number;
  nomeOriginal: string;
  url: string;
  tamanho: number;
  mimetype?: string;
};

export type TicketDetalhe = TicketResumo & {
  messages: TicketMensagem[];
  anexos?: TicketAnexo[];
};

export async function fetchTickets(search = "", status = "todos") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const res = await apiFetch(`/api/tickets?${params.toString()}`);
  return res.json() as Promise<{ ok: boolean; tickets?: TicketResumo[]; error?: string }>;
}

export async function fetchTicket(id: string) {
  const res = await apiFetch(`/api/tickets/${encodeURIComponent(id)}`);
  return res.json() as Promise<{
    ok: boolean;
    ticket?: TicketDetalhe;
    error?: string;
  }>;
}

export async function criarTicket(payload: {
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  clienteId?: number;
}) {
  const res = await apiFetch("/api/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; codigo?: string; id?: number; error?: string; message?: string }>;
}

export async function uploadTicketAnexo(
  ticketId: string,
  file: File,
  mensagemId?: number,
): Promise<{ ok: boolean; error?: string; anexo?: TicketAnexo }> {
  const formData = new FormData();
  formData.append("file", file);
  if (mensagemId != null) {
    formData.append("mensagemId", String(mensagemId));
  }

  const res = await apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}/anexos`, {
    method: "POST",
    body: formData,
  });
  return res.json() as Promise<{ ok: boolean; error?: string; anexo?: TicketAnexo }>;
}

export async function responderTicket(id: string, mensagem: string) {
  const res = await apiFetch(`/api/tickets/${encodeURIComponent(id)}/responder`, {
    method: "POST",
    body: JSON.stringify({ mensagem }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export function mapTicketStatusUi(status: string): { status: "ok" | "warn" | "danger"; label: string } {
  if (status === "resolvido" || status === "fechado") return { status: "ok", label: "Resolvido" };
  if (status === "em_andamento") return { status: "warn", label: "Em atendimento" };
  return { status: "warn", label: "Aberto" };
}
