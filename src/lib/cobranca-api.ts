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
  };
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
