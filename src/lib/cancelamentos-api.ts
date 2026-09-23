import { apiFetch } from "@/lib/api-fetch";

export type CancelamentoStatus =
  | "solicitada"
  | "em_andamento"
  | "em_analise"
  | "analisada"
  | "procedente"
  | "improcedente"
  | "processada"
  | "cancelada"
  | "revertida";

export type SolicitacaoCancelamento = {
  id: number;
  clienteId: number | null;
  protocolo: string | null;
  documento: string | null;
  razaoSocial: string | null;
  protocoloCadastro: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  motivos: string[];
  motivosRaw: unknown;
  servicoEsperado: string | null;
  servicoEsperadoOutro: string | null;
  dadosReembolso: Record<string, unknown> | null;
  desejaMonitoramento: boolean;
  reverterCancelamento: boolean;
  status: CancelamentoStatus;
  statusLabel: string;
  observacoes: string | null;
  tracking: unknown;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CancelamentoResposta = {
  id: number;
  solicitacaoId: number;
  usuarioId: number | null;
  usuarioNome: string | null;
  statusAnterior: string | null;
  statusNovo: CancelamentoStatus;
  statusNovoLabel: string;
  assunto: string | null;
  mensagem: string;
  interno: boolean;
  emailEnviado: boolean;
  emailDestino: string | null;
  emailErro: string | null;
  createdAt: string | null;
};

export type CancelamentoAnexo = {
  id: number;
  solicitacaoId: number;
  respostaId: number | null;
  usuarioId: number | null;
  nomeOriginal: string;
  mimeType: string | null;
  tamanho: number;
  url: string;
  createdAt: string | null;
};

export type CancelamentoResumo = {
  total: number;
  solicitada: number;
  emAndamento: number;
  emAnalise: number;
  analisada: number;
  procedente: number;
  improcedente: number;
  processada: number;
  cancelada: number;
  revertida: number;
  abertas: number;
};

export type StatusOption = { value: CancelamentoStatus; label: string };

export async function fetchCancelamentos(opts: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.q) params.set("q", opts.q);
  if (opts.status) params.set("status", opts.status);
  const qs = params.toString();
  const res = await apiFetch(`/api/admin/cancelamentos${qs ? `?${qs}` : ""}`);
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    items?: SolicitacaoCancelamento[];
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
    resumo?: CancelamentoResumo;
    statusOptions?: StatusOption[];
  }>;
}

export async function fetchCancelamentoDetalhe(id: number) {
  const res = await apiFetch(`/api/admin/cancelamentos/${id}`);
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    solicitacao?: SolicitacaoCancelamento;
    respostas?: CancelamentoResposta[];
    anexos?: CancelamentoAnexo[];
    cliente?: {
      id: number;
      razaoSocial?: string;
      documento?: string;
      email?: string;
      telefone?: string;
      status?: string;
      cidade?: string;
      estado?: string;
    } | null;
    statusOptions?: StatusOption[];
  }>;
}

export async function atualizarStatusCancelamento(
  id: number,
  status: CancelamentoStatus,
  observacoes?: string,
) {
  const res = await apiFetch(`/api/admin/cancelamentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, observacoes }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; message?: string }>;
}

export async function responderCancelamento(
  id: number,
  opts: {
    mensagem: string;
    assunto?: string;
    status?: CancelamentoStatus;
    emailDestino?: string;
    interno?: boolean;
    enviarEmail?: boolean;
    observacoesInternas?: string;
    files?: File[];
  },
) {
  const hasFiles = opts.files && opts.files.length > 0;
  if (hasFiles) {
    const fd = new FormData();
    fd.set("mensagem", opts.mensagem);
    if (opts.assunto) fd.set("assunto", opts.assunto);
    if (opts.status) fd.set("status", opts.status);
    if (opts.emailDestino) fd.set("emailDestino", opts.emailDestino);
    fd.set("interno", opts.interno ? "1" : "0");
    fd.set("enviarEmail", opts.enviarEmail === false ? "0" : "1");
    if (opts.observacoesInternas) fd.set("observacoesInternas", opts.observacoesInternas);
    for (const f of opts.files!) fd.append("files", f);
    const res = await apiFetch(`/api/admin/cancelamentos/${id}/responder`, {
      method: "POST",
      body: fd,
    });
    return res.json() as Promise<{
      ok: boolean;
      error?: string;
      message?: string;
      emailNotificacao?: { enviado?: boolean; simulado?: boolean; para?: string; motivo?: string };
    }>;
  }

  const res = await apiFetch(`/api/admin/cancelamentos/${id}/responder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mensagem: opts.mensagem,
      assunto: opts.assunto,
      status: opts.status,
      emailDestino: opts.emailDestino,
      interno: opts.interno,
      enviarEmail: opts.enviarEmail,
      observacoesInternas: opts.observacoesInternas,
    }),
  });
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    message?: string;
    emailNotificacao?: { enviado?: boolean; simulado?: boolean; para?: string; motivo?: string };
  }>;
}

export const STATUS_BADGE: Record<
  CancelamentoStatus,
  { label: string; cls: string }
> = {
  solicitada: { label: "Solicitada", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  em_andamento: { label: "Em andamento", cls: "bg-sky-100 text-sky-800 border-sky-200" },
  em_analise: { label: "Em análise", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  analisada: { label: "Analisada", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  procedente: { label: "Procedente", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  improcedente: { label: "Improcedente", cls: "bg-rose-100 text-rose-800 border-rose-200" },
  processada: { label: "Processada", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  cancelada: { label: "Cancelada", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  revertida: { label: "Revertida", cls: "bg-teal-100 text-teal-800 border-teal-200" },
};
