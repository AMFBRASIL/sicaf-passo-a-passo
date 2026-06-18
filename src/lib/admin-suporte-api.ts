import { apiFetch } from "@/lib/api-fetch";

/** Situações do kanban em /admin/suporte */
export const TICKET_SITUACOES = [
  "Novo",
  "Triagem",
  "Em andamento",
  "Aguardando Cliente",
  "Aguardando Governo",
  "Resolvido",
  "Fechado",
] as const;

export type TicketSituacao = (typeof TICKET_SITUACOES)[number];
export type ModoSituacaoTicket = "padrao" | "manual";

export type TicketRespostaOptions = {
  modoSituacao: ModoSituacaoTicket;
  situacaoManual?: TicketSituacao;
  marcarResolvido?: boolean;
};

export function situacaoPadraoAposEnvio(_statusAtual: string, marcarResolvido: boolean): TicketSituacao {
  if (marcarResolvido) return "Resolvido";
  return "Aguardando Cliente";
}

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

export type AdminTicketAnexo = {
  id: number;
  nomeOriginal: string;
  url: string;
  tamanho: number;
  mimetype?: string;
};

export type AdminTicketMensagem = {
  id: number;
  sender: string;
  senderName: string;
  message: string;
  date: string;
  anexos?: AdminTicketAnexo[];
};

export type AdminTicketDetalhe = Omit<AdminTicketApi, "messages"> & {
  clientDocumento?: string;
  assigneeId?: number | null;
  updatedAt?: string;
  messageCount?: number;
  messages: AdminTicketMensagem[];
  anexos?: AdminTicketAnexo[];
};

export function calcAguardandoRespostaFromMessages(messages: AdminTicketMensagem[]): boolean {
  if (!messages.length) return false;
  const ultimo = messages[messages.length - 1];
  const temMsgCliente = messages.some((m) => m.sender === "client");
  return ultimo.sender === "support" && temMsgCliente;
}

export function colunaDoTicketDetalhe(ticket: AdminTicketDetalhe): ColunaKanban {
  const temAtribuido = !!ticket.assignee && ticket.assignee !== "Não atribuído";
  const aguardando = calcAguardandoRespostaFromMessages(ticket.messages || []);
  return statusDbParaColuna(ticket.status, aguardando, temAtribuido);
}

export function formatTamanhoArquivo(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function coletarTodosAnexos(ticket: AdminTicketDetalhe): AdminTicketAnexo[] {
  const doTicket = ticket.anexos || [];
  const dasMensagens = (ticket.messages || []).flatMap((m) => m.anexos || []);
  const vistos = new Set<number>();
  return [...doTicket, ...dasMensagens].filter((a) => {
    if (vistos.has(a.id)) return false;
    vistos.add(a.id);
    return true;
  });
}

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

export function statusDbParaColuna(
  status: string,
  aguardandoResposta = false,
  temAtribuido = false,
): ColunaKanban {
  const s = String(status || "").toLowerCase();
  if (s === "fechado") return "Fechado";
  if (s === "resolvido") return "Resolvido";
  if (aguardandoResposta) return "Aguardando Cliente";
  if (s === "em_andamento") return "Em andamento";
  if (s === "aberto") return temAtribuido ? "Triagem" : "Novo";
  if (s === "aguardando_cliente") return "Em andamento";
  return "Em andamento";
}

/** Mapeia coluna do kanban para ENUM válido em `tickets.status`. */
export function colunaParaStatusDb(coluna: ColunaKanban | TicketSituacao): string {
  const map: Record<string, string> = {
    Novo: "aberto",
    Triagem: "aberto",
    "Em andamento": "em_andamento",
    "Aguardando Cliente": "aguardando_cliente",
    "Aguardando Governo": "em_andamento",
    Resolvido: "resolvido",
    Fechado: "fechado",
  };
  return map[coluna] || "em_andamento";
}

async function parseApiJson<T>(res: Response): Promise<T & { ok: boolean; error?: string }> {
  const text = await res.text();
  let data: T & { ok?: boolean; error?: string };
  try {
    data = JSON.parse(text) as T & { ok?: boolean; error?: string };
  } catch {
    return {
      ok: false,
      error: res.ok
        ? "Resposta inválida da API"
        : `Erro HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`,
    } as T & { ok: boolean; error?: string };
  }

  if (!res.ok) {
    return {
      ...data,
      ok: false,
      error:
        data.error ||
        (res.status === 401
          ? "Sessão expirada — faça login novamente"
          : res.status === 403
            ? "Acesso restrito a administradores"
            : res.status === 404
              ? "Rota /api/tickets-admin não encontrada — atualize o backend no VPS"
              : `Erro HTTP ${res.status}`),
    };
  }

  return { ...data, ok: data.ok !== false };
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
  const temAtribuido = !!t.assignee && t.assignee !== "Não atribuído";
  return {
    id: t.id,
    dbId: t.dbId,
    titulo: t.title,
    cli: t.client,
    resp: temAtribuido ? t.assignee : "—",
    sla: formatSlaUi(t.slaMinutes, t.status),
    prio: prioridadeParaUi(t.priority),
    data: t.createdAt,
    coluna: statusDbParaColuna(t.status, !!t.aguardandoResposta, temAtribuido),
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
  return parseApiJson<{
    tickets?: AdminTicketApi[];
    counts?: Record<string, number>;
  }>(res);
}

export async function fetchAdminTicketDetalhe(id: string) {
  const res = await apiFetch(`/api/tickets-admin/${encodeURIComponent(id)}`);
  return parseApiJson<{ ticket?: AdminTicketDetalhe }>(res);
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
  return parseApiJson<{
    codigo?: string;
    id?: number;
    message?: string;
  }>(res);
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
  return parseApiJson<{ status?: string }>(res);
}

export async function atualizarTicketAdmin(id: string, payload: { status?: string; prioridade?: string }) {
  const res = await apiFetch(`/api/tickets-admin/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return parseApiJson<{ message?: string }>(res);
}
