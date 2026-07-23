import { apiFetch } from "@/lib/api-fetch";
import {
  enviarCobrancaCliente,
  fetchCobrancasPendentes,
  formatBRL,
  type ClienteCobrancaPendente,
  type CobrancaPendentesFiltros,
  type CobrancaPendentesResumo,
} from "@/lib/admin-financeiro-api";

export type SeveridadeCobranca = "leve" | "media" | "critica";

export type PublicoAlvoKey = "todos" | "critica" | "media" | "leve";

export type ResumoPublicoAlvo = {
  todos: number;
  critica: number;
  media: number;
  leve: number;
};

export type CanalCobranca = "email" | "whatsapp" | "sms" | "ligacao" | "nenhum";

export type ModeloMensagemKey = "lembrete_amigavel" | "segunda_cobranca" | "aviso_final";

export type ReguaEtapa = {
  id?: number;
  ordem: number;
  diasRelativo: number;
  diasLabel?: string;
  canal: CanalCobranca;
  titulo: string;
  mensagem: string;
  ativo: boolean;
};

export type ReguaCobrancaData = {
  automacaoAtiva: boolean;
  ultimaExecucaoEm: string | null;
  etapas: ReguaEtapa[];
  resumo: { total: number; ativas: number };
};

export async function fetchResumoPublicoAlvo(): Promise<{
  ok: boolean;
  error?: string;
  publico?: ResumoPublicoAlvo;
  valorTotal?: number;
}> {
  const res = await apiFetch("/api/admin/cobranca/resumo-publico");
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    publico?: ResumoPublicoAlvo;
    valorTotal?: number;
  };
}

export async function fetchReguaCobranca(): Promise<{
  ok: boolean;
  error?: string;
} & Partial<ReguaCobrancaData>> {
  const res = await apiFetch("/api/admin/cobranca/regua");
  return (await res.json()) as { ok: boolean; error?: string } & Partial<ReguaCobrancaData>;
}

export async function saveReguaCobranca(payload: {
  automacaoAtiva: boolean;
  etapas: ReguaEtapa[];
}): Promise<{ ok: boolean; error?: string; message?: string } & Partial<ReguaCobrancaData>> {
  const res = await apiFetch("/api/admin/cobranca/regua", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as { ok: boolean; error?: string; message?: string } & Partial<ReguaCobrancaData>;
}

export async function executarDisparoMassa(payload: {
  publicoAlvo: PublicoAlvoKey;
  canais: Array<"email" | "whatsapp" | "sms">;
  modelo?: ModeloMensagemKey;
  mensagem: string;
  agendar?: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  agendado?: boolean;
  totalDestinatarios?: number;
  totalEnviados?: number;
  totalErros?: number;
}> {
  const res = await apiFetch("/api/admin/cobranca/disparo-massa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    message?: string;
    agendado?: boolean;
    totalDestinatarios?: number;
    totalEnviados?: number;
    totalErros?: number;
  };
}

export type CobrancaDisparoEvent =
  | {
      type: "start";
      disparoId?: number;
      total: number;
      canais?: string[];
      publicoAlvo?: string;
    }
  | {
      type: "item";
      index: number;
      total: number;
      clienteId?: number;
      empresa?: string;
      email?: string;
      nome?: string;
      ok: boolean;
      error?: string | null;
      enviados: number;
      erros?: number;
      falhas?: number;
      percent: number;
    }
  | {
      type: "done";
      ok: boolean;
      message?: string;
      totalDestinatarios?: number;
      totalEnviados?: number;
      totalErros?: number;
      enviados?: number;
      falhas?: number;
      total?: number;
      error?: string;
    }
  | {
      type: "error";
      ok?: boolean;
      error?: string;
    };

/** Disparo em massa com progresso SSE (e-mail via serviço existente). */
export async function executarDisparoMassaStream(
  payload: {
    publicoAlvo: PublicoAlvoKey;
    canais: Array<"email" | "whatsapp" | "sms">;
    modelo?: ModeloMensagemKey;
    mensagem: string;
  },
  onEvent: (event: CobrancaDisparoEvent) => void,
): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  totalDestinatarios?: number;
  totalEnviados?: number;
  totalErros?: number;
}> {
  const res = await apiFetch("/api/admin/cobranca/disparo-massa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true, action: "send-stream" }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error || `Erro HTTP ${res.status}` };
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !res.body) {
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message?: string;
      totalDestinatarios?: number;
      totalEnviados?: number;
      totalErros?: number;
    };
    return {
      ok: data.ok !== false,
      error: data.error,
      message: data.message,
      totalDestinatarios: data.totalDestinatarios,
      totalEnviados: data.totalEnviados,
      totalErros: data.totalErros,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastDone: CobrancaDisparoEvent | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";

    for (const rawLine of parts) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payloadLine = line.slice(5).trim();
      if (!payloadLine || payloadLine === "[DONE]") continue;
      try {
        const event = JSON.parse(payloadLine) as CobrancaDisparoEvent;
        onEvent(event);
        if (event.type === "done" || event.type === "error") lastDone = event;
      } catch {
        // ignore
      }
    }
  }

  if (lastDone?.type === "done") {
    return {
      ok: lastDone.ok !== false,
      message: lastDone.message,
      error: lastDone.error,
      totalDestinatarios: lastDone.totalDestinatarios ?? lastDone.total,
      totalEnviados: lastDone.totalEnviados ?? lastDone.enviados,
      totalErros: lastDone.totalErros ?? lastDone.falhas,
    };
  }
  if (lastDone?.type === "error") {
    return { ok: false, error: lastDone.error || "Falha no disparo" };
  }
  return { ok: false, error: "Disparo interrompido sem confirmação" };
}

export const MODELOS_MENSAGEM_PADRAO: Record<ModeloMensagemKey, string> = {
  lembrete_amigavel:
    "{nome}, lembramos que o pagamento de {valor} referente a {servico} está pendente. Acesse: {link}",
  segunda_cobranca:
    "{nome}, sua pendência de {valor} segue em aberto há {dias} dias. Para evitar bloqueio, regularize pelo link: {link}",
  aviso_final:
    "{nome}, aviso final: pendência de {valor} ({servico}) em aberto há {dias} dias. Regularize imediatamente: {link}",
};


export type CobrancaHistoricoItem = {
  id: number;
  email: string;
  enviadoEm: string;
  enviadoEmFormatado: string;
  sucesso: boolean;
  erro: string | null;
  enviadoPor: string;
  canal: string;
  descricao: string;
};

export type CobrancaPendentesFiltrosExt = CobrancaPendentesFiltros & {
  severidade?: "todos" | SeveridadeCobranca;
  clienteId?: number;
};

export {
  fetchCobrancasPendentes,
  enviarCobrancaCliente,
  formatBRL,
  type ClienteCobrancaPendente,
  type CobrancaPendentesResumo,
};

export async function fetchCobrancasAdmin(
  filtros: CobrancaPendentesFiltrosExt = {},
): Promise<{
  ok: boolean;
  error?: string;
  clientes?: ClienteCobrancaPendente[];
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  resumo?: CobrancaPendentesResumo & { totalCriticos?: number; mediaAtrasoDias?: number };
}> {
  const params = new URLSearchParams();
  if (filtros.page) params.set("page", String(filtros.page));
  if (filtros.pageSize) params.set("pageSize", String(filtros.pageSize));
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.cobrado) params.set("cobrado", filtros.cobrado);
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.severidade && filtros.severidade !== "todos") {
    params.set("severidade", filtros.severidade);
  }
  if (filtros.diasMin !== undefined && filtros.diasMin !== "") {
    params.set("diasMin", String(filtros.diasMin));
  }
  if (filtros.semEmail) params.set("semEmail", filtros.semEmail);
  if (filtros.clienteId) params.set("clienteId", String(filtros.clienteId));

  const qs = params.toString();
  const res = await apiFetch(`/api/admin/financeiro/cobrancas-pendentes${qs ? `?${qs}` : ""}`);
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    clientes?: ClienteCobrancaPendente[];
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
    resumo?: CobrancaPendentesResumo & { totalCriticos?: number; mediaAtrasoDias?: number };
  };
}

export async function fetchCobrancaCliente(clienteId: number): Promise<{
  ok: boolean;
  error?: string;
  cliente?: ClienteCobrancaPendente;
}> {
  const res = await fetchCobrancasAdmin({ clienteId, page: 1, pageSize: 1 });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, cliente: res.clientes?.[0] };
}

export async function fetchCobrancaHistorico(clienteId: number): Promise<{
  ok: boolean;
  error?: string;
  historico?: CobrancaHistoricoItem[];
}> {
  const res = await apiFetch(`/api/admin/cobranca/historico/${clienteId}`);
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    historico?: CobrancaHistoricoItem[];
  };
}
