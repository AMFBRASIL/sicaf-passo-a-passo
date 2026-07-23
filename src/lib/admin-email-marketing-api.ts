import { apiFetch } from "@/lib/api-fetch";

export type EmailMktStatus =
  | "enviado"
  | "agendado"
  | "rascunho"
  | "falhou"
  | "cancelado"
  | "enviando"
  | "pausado";

export type EmailMktPublicoOpcao = {
  id: string;
  label: string;
  desc: string;
  count: number;
  grupo?: string;
};

export type EmailMktFormato = "texto" | "html";

export type EmailMktCampanha = {
  id: string;
  titulo: string;
  categoria: "licitacoes" | "certidoes" | "avisos" | "boas-vindas";
  publico: string;
  publicoTipo?: string;
  assunto?: string;
  corpo?: string;
  formato?: EmailMktFormato;
  destinatarios: number;
  enviados: number;
  falhas?: number;
  aberturas: number;
  cliques: number;
  status: EmailMktStatus;
  data: string;
  dataAgendada?: string | null;
  dataEnvio?: string | null;
  erroResumo?: string | null;
};

export type EmailMktTemplate = {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  categoria: EmailMktCampanha["categoria"];
  ativo?: boolean;
};

export type EmailMktAutomacao = {
  id: string;
  codigo?: string;
  nome: string;
  descricao: string;
  icon: string;
  tone: string;
  ativo: boolean;
  stats: string;
};

export type EmailMktVariavel = {
  key: string;
  label: string;
  sample?: string;
};

export type EmailMktDashboard = {
  ok: boolean;
  error?: string;
  campanhas?: EmailMktCampanha[];
  templates?: EmailMktTemplate[];
  automacoes?: EmailMktAutomacao[];
  publicoOpcoes?: EmailMktPublicoOpcao[];
  variaveis?: EmailMktVariavel[];
  agendamentos?: EmailMktCampanha[];
  kpis?: {
    enviados30: number;
    taxaAbertura: number;
    taxaCliques: number;
    clientesAtivos: number;
  };
};

async function parseJson<T>(res: Response): Promise<T & { ok: boolean; error?: string }> {
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok) return { ...data, ok: false, error: data.error || `Erro HTTP ${res.status}` };
  return { ...data, ok: data.ok !== false };
}

export async function fetchEmailMarketingDashboard(opts?: {
  search?: string;
  categoria?: string;
}): Promise<EmailMktDashboard> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.categoria) params.set("categoria", opts.categoria);
  const qs = params.toString();
  const res = await apiFetch(`/api/admin/email-marketing${qs ? `?${qs}` : ""}`);
  return parseJson(res);
}

export async function createEmailCampanha(payload: {
  titulo: string;
  categoria: string;
  publicoTipo: string;
  assunto: string;
  corpo: string;
  formato?: EmailMktFormato;
  modo: "agora" | "agendar" | "rascunho";
  dataAgendada?: string;
  templateId?: string;
  /** Cria a campanha e deixa o front disparar o envio com progresso (SSE). */
  deferSend?: boolean;
  stream?: boolean;
}) {
  const res = await apiFetch("/api/admin/email-marketing", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJson<{ campanha?: EmailMktCampanha }>(res);
}

export async function gerarHtmlCampanhaIa(payload: {
  assunto?: string;
  rascunho?: string;
  categoria?: string;
  publicoTipo?: string;
  publicoLabel?: string;
  instrucao?: string;
}) {
  const res = await apiFetch("/api/admin/email-marketing", {
    method: "POST",
    body: JSON.stringify({ action: "gerar-html", ...payload }),
  });
  return parseJson<{ html?: string; formato?: EmailMktFormato }>(res);
}

export type EmailMktSendEvent =
  | {
      type: "start";
      campanhaId?: string;
      total: number;
      pendentes?: number;
      jaEnviados?: number;
      destinatarios?: number;
      assunto?: string;
      retomada?: boolean;
    }
  | {
      type: "item";
      index: number;
      total: number;
      email: string;
      nome?: string;
      empresa?: string;
      ok: boolean;
      error?: string | null;
      enviados: number;
      falhas: number;
      percent: number;
    }
  | {
      type: "done";
      ok: boolean;
      paused?: boolean;
      enviados?: number;
      falhas?: number;
      total?: number;
      error?: string | null;
      message?: string;
      campanha?: EmailMktCampanha;
    }
  | {
      type: "paused";
      ok?: boolean;
      paused?: boolean;
      enviados?: number;
      falhas?: number;
      total?: number;
      error?: string | null;
      campanha?: EmailMktCampanha;
    }
  | {
      type: "error";
      ok?: boolean;
      error?: string;
      campanha?: EmailMktCampanha;
    };

export async function sendEmailCampanha(id: string) {
  const res = await apiFetch(`/api/admin/email-marketing/campanhas/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ action: "send" }),
  });
  return parseJson<{ campanha?: EmailMktCampanha; enviados?: number; falhas?: number }>(res);
}

export async function pauseEmailCampanha(id: string) {
  const res = await apiFetch(`/api/admin/email-marketing/campanhas/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ action: "pause" }),
  });
  return parseJson<{ campanha?: EmailMktCampanha }>(res);
}

/** Envio com progresso em tempo real (SSE). Usa o mesmo email.service no backend. */
export async function sendEmailCampanhaStream(
  id: string,
  onEvent: (event: EmailMktSendEvent) => void,
): Promise<{
  ok: boolean;
  paused?: boolean;
  error?: string;
  enviados?: number;
  falhas?: number;
  campanha?: EmailMktCampanha;
}> {
  const res = await apiFetch(`/api/admin/email-marketing/campanhas/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ action: "send-stream", stream: true }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error || `Erro HTTP ${res.status}` };
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !res.body) {
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      paused?: boolean;
      error?: string;
      enviados?: number;
      falhas?: number;
      campanha?: EmailMktCampanha;
    };
    return {
      ok: data.ok !== false,
      paused: data.paused,
      error: data.error,
      enviados: data.enviados,
      falhas: data.falhas,
      campanha: data.campanha,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastDone: EmailMktSendEvent | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";

    for (const rawLine of parts) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as EmailMktSendEvent;
        onEvent(event);
        if (event.type === "done" || event.type === "error" || event.type === "paused") {
          lastDone = event;
        }
      } catch {
        // ignora chunk inválido
      }
    }
  }

  if (lastDone?.type === "done") {
    return {
      ok: lastDone.ok,
      paused: lastDone.paused,
      error: lastDone.error || undefined,
      enviados: lastDone.enviados,
      falhas: lastDone.falhas,
      campanha: lastDone.campanha,
    };
  }
  if (lastDone?.type === "paused") {
    return {
      ok: true,
      paused: true,
      enviados: lastDone.enviados,
      falhas: lastDone.falhas,
      campanha: lastDone.campanha,
    };
  }
  if (lastDone?.type === "error") {
    return { ok: false, error: lastDone.error || "Falha no envio", campanha: lastDone.campanha };
  }
  return { ok: false, error: "Envio interrompido sem confirmação" };
}

export async function duplicateEmailCampanha(id: string) {
  const res = await apiFetch(`/api/admin/email-marketing/campanhas/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ action: "duplicate" }),
  });
  return parseJson<{ campanha?: EmailMktCampanha }>(res);
}

export async function deleteEmailCampanha(id: string) {
  const res = await apiFetch(`/api/admin/email-marketing/campanhas/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return parseJson(res);
}

export async function toggleEmailAutomacao(id: string, ativo?: boolean) {
  const res = await apiFetch(`/api/admin/email-marketing/automacoes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ativo }),
  });
  return parseJson<{ automacao?: EmailMktAutomacao }>(res);
}

export async function saveEmailTemplate(payload: {
  id?: string;
  nome: string;
  assunto: string;
  corpo: string;
  categoria: string;
}) {
  const res = await apiFetch("/api/admin/email-marketing/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJson<{ template?: EmailMktTemplate }>(res);
}

export async function deleteEmailTemplate(id: string) {
  const res = await apiFetch(`/api/admin/email-marketing/templates?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return parseJson(res);
}
