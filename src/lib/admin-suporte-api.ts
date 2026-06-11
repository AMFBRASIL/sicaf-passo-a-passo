import { apiFetch } from "@/lib/api-fetch";
import type { TicketSituacao } from "@/components/admin/ticket-resposta-modal";

export type AdminTicketApi = {
  id: string;
  dbId?: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  client: string;
  assignee: string;
  createdAt: string;
  slaDeadline?: string;
  slaMinutes: number;
  messages: number;
  aguardandoResposta?: boolean;
};

export type AdminTicketMensagem = {
  id: number;
  sender: string;
  senderName: string;
  message: string;
  date: string;
};

export type AdminTicketDetalhe = Omit<AdminTicketApi, "messages"> & {
  clientDocumento?: string;
  assigneeId?: number | null;
  updatedAt?: string;
  messageCount?: number;
  messages: AdminTicketMensagem[];
};

export type ColunaKanban =
  | "Novo"
  | "Triagem"
  | "Em andamento"
  | "Aguardando Cliente"
  | "Aguardando Governo"
  | "Resolvido"
  | "Fechado";

export type TicketKanban = {
  id: string;
  dbId?: number;
  titulo: string;
  cli: string;
  resp: string;
  sla: { restante: string; tom: "ok" | "warn" | "bad" };
  prio: "Alta" | "Média" | "Baixa";
  data: string;
  coluna: ColunaKanban;
};

const COLUNAS: ColunaKanban[] = [
  "Novo",
  "Triagem",
  "Em andamento",
  "Aguardando Cliente",
  "Aguardando Governo",
  "Resolvido",
  "Fechado",
];

export function statusDbParaColuna(status: string, aguardandoResposta = false): ColunaKanban {
  const s = String(status || "").toLowerCase();
  if (s === "fechado") return "Fechado";
  if (s === "resolvido") return "Resolvido";
  if (s === "aguardando_governo") return "Aguardando Governo";
  if (s === "aguardando_cliente" || aguardandoResposta) return "Aguardando Cliente";
  if (s === "triagem") return "Triagem";
  if (s === "em_andamento") return "Em andamento";
  if (s === "aberto") return "Novo";
  return "Em andamento";
}

export function colunaParaStatusDb(coluna: ColunaKanban | TicketSituacao): string {
  const map: Record<string, string> = {
    Novo: "aberto",
    Triagem: "triagem",
    "Em andamento": "em_andamento",
    "Aguardando Cliente": "aguardando_cliente",
    "Aguardando Governo": "aguardando_governo",
    Resolvido: "resolvido",
    Fechado: "fechado",
  };
  return map[coluna] || "em_andamento";
}

export function prioridadeParaUi(p: string): "Alta" | "Média" | "Baixa" {
  const s = String(p || "").toLowerCase();
  if (s === "alta" || s === "urgente") return "Alta";
  if (s === "baixa") return "Baixa";
  return "Média";
}

export function prioridadeParaApi(p: string): string {
  const s = String(p || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (s === "alta") return "alta";
  if (s === "baixa") return "baixa";
  return "media";
}

export function formatSlaUi(minutes: number, status: string): { restante: string; tom: "ok" | "warn" | "bad" } {
  const s = String(status || "").toLowerCase();
  if (s === "resolvido" || s === "fechado") {
    return { restante: "Ok", tom: "ok" };
  }
  if (!Number.isFinite(minutes)) {
    return { restante: "—", tom: "ok" };
  }
  if (minutes <= 0) {
    return { restante: "Vencido", tom: "bad" };
  }
  if (minutes < 60) {
    return { restante: `${minutes}min`, tom: minutes <= 30 ? "warn" : "ok" };
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const label = m > 0 ? `${h}h${m}m` : `${h}h`;
  return { restante: label, tom: h < 2 ? "warn" : "ok" };
}

export function mapTicketApiParaKanban(t: AdminTicketApi): TicketKanban {
  return {
    id: t.id,
    dbId: t.dbId,
    titulo: t.title,
    cli: t.client,
    resp: t.assignee === "Não atribuído" ? "—" : t.assignee,
    sla: formatSlaUi(t.slaMinutes, t.status),
    prio: prioridadeParaUi(t.priority),
    data: t.createdAt,
    coluna: statusDbParaColuna(t.status, !!t.aguardandoResposta),
  };
}

export function ticketsParaBoard(tickets: AdminTicketApi[]): Record<ColunaKanban, TicketKanban[]> {
  const board = Object.fromEntries(COLUNAS.map((c) => [c, [] as TicketKanban[]])) as Record<
    ColunaKanban,
    TicketKanban[]
  >;
  for (const t of tickets) {
    const item = mapTicketApiParaKanban(t);
    board[item.coluna].push(item);
  }
  return board;
}

export async function fetchAdminTickets(search = "") {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const res = await apiFetch(`/api/tickets-admin?${params.toString()}`);
  return res.json() as Promise<{
    ok: boolean;
    tickets?: AdminTicketApi[];
    counts?: Record<string, number>;
    error?: string;
  }>;
}

export async function fetchAdminTicketDetalhe(id: string) {
  const res = await apiFetch(`/api/tickets-admin/${encodeURIComponent(id)}`);
  return res.json() as Promise<{
    ok: boolean;
    ticket?: AdminTicketDetalhe;
    error?: string;
  }>;
}

export async function criarTicketAdmin(payload: {
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  clienteId?: number;
  atribuidoA?: number;
}) {
  const res = await apiFetch("/api/tickets-admin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{
    ok: boolean;
    codigo?: string;
    id?: number;
    error?: string;
    message?: string;
  }>;
}

export async function responderTicketAdmin(
  id: string,
  payload: {
    mensagem: string;
    status?: string;
    marcarResolvido?: boolean;
  },
) {
  const res = await apiFetch(`/api/tickets-admin/${encodeURIComponent(id)}/responder`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{
    ok: boolean;
    status?: string;
    error?: string;
  }>;
}

export async function atualizarTicketAdmin(id: string, payload: { status?: string; prioridade?: string }) {
  const res = await apiFetch(`/api/tickets-admin/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; message?: string }>;
}
