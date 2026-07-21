import { apiFetch } from "@/lib/api-fetch";

export type EmailMktStatus = "enviado" | "agendado" | "rascunho" | "falhou" | "cancelado";

export type EmailMktCampanha = {
  id: string;
  titulo: string;
  categoria: "licitacoes" | "certidoes" | "avisos" | "boas-vindas";
  publico: string;
  publicoTipo?: string;
  assunto?: string;
  corpo?: string;
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

export type EmailMktPublicoOpcao = {
  id: string;
  label: string;
  desc: string;
  count: number;
};

export type EmailMktDashboard = {
  ok: boolean;
  error?: string;
  campanhas?: EmailMktCampanha[];
  templates?: EmailMktTemplate[];
  automacoes?: EmailMktAutomacao[];
  publicoOpcoes?: EmailMktPublicoOpcao[];
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
  modo: "agora" | "agendar" | "rascunho";
  dataAgendada?: string;
  templateId?: string;
}) {
  const res = await apiFetch("/api/admin/email-marketing", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJson<{ campanha?: EmailMktCampanha }>(res);
}

export async function sendEmailCampanha(id: string) {
  const res = await apiFetch(`/api/admin/email-marketing/campanhas/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ action: "send" }),
  });
  return parseJson<{ campanha?: EmailMktCampanha; enviados?: number; falhas?: number }>(res);
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
