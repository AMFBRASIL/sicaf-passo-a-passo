import { apiFetch } from "@/lib/api-fetch";
import type {
  AssessoriaPainel,
  AssessoriaPortal,
  AssessoriaStatus,
} from "@/lib/assessoria-portal-api";
import type { Acompanhamento, EtapaAcesso, LicitacoesEPainel } from "@/lib/licitacoes-e-api";
import type { ModuloAssinatura, ModuloPago } from "@/lib/modulos-api";

export type AssessoriaResumo =
  | { existe: false }
  | {
      existe: true;
      status: AssessoriaStatus;
      pago: boolean;
      dataPagamento: string | null;
      atividade: string | null;
      documentosEnviados: number;
      documentosAguardando: number;
      documentosRecusados: number;
      atualizadoEm: string | null;
    };

export type ModuloAssinaturaAdmin = ModuloAssinatura & {
  validoAtePago: string | null;
  cortesiaAte: string | null;
};

export type ServicosCliente = {
  caufesp: AssessoriaResumo;
  bll: AssessoriaResumo;
  modulos: ModuloAssinaturaAdmin[];
  licitacoesE: { acessoEtapas: EtapaAcesso[]; acompanhamentos: Acompanhamento[] };
};

type Resp<T> = ({ ok: true } & T) | { ok: false; error: string };

async function parse<T>(res: Response): Promise<Resp<T>> {
  const data = await res
    .json()
    .catch(() => ({ ok: false, error: "Resposta inválida do servidor" }));
  if (!data.ok) return { ok: false, error: data.error || "Erro ao consultar serviços" };
  return data as Resp<T>;
}

function acao<T>(clienteId: number, body: Record<string, unknown>) {
  return apiFetch(`/api/admin/clients/${clienteId}/servicos`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => parse<T>(r));
}

export async function fetchServicosCliente(clienteId: number) {
  return parse<ServicosCliente>(await apiFetch(`/api/admin/clients/${clienteId}/servicos`));
}

export function definirCortesiaModulo(clienteId: number, modulo: ModuloPago, ate: string | null) {
  return acao<ModuloAssinaturaAdmin>(clienteId, { acao: "cortesia", modulo, ate });
}

export function atualizarAcompanhamentoAdmin(
  clienteId: number,
  id: number,
  campos: Partial<Pick<Acompanhamento, "situacaoPortal" | "resultado">>,
) {
  return acao<LicitacoesEPainel>(clienteId, { acao: "licitacoes_e_atualizar", id, campos });
}

export function responderApoioLicitacoesE(
  clienteId: number,
  id: number,
  observacao: string,
  resolvido: boolean,
) {
  return acao<LicitacoesEPainel>(clienteId, {
    acao: "licitacoes_e_responder",
    id,
    observacao,
    resolvido,
  });
}

export async function atualizarProcessoAssessoriaAdmin(
  portal: AssessoriaPortal,
  clienteId: number,
  campos: {
    status?: AssessoriaStatus;
    observacaoCadbrasil?: string | null;
    protocoloPortal?: string | null;
    cadastroValidade?: string | null;
    documentos?: { codigo: string; status: "aprovado" | "recusado" | "enviado"; observacao?: string }[];
  },
) {
  return parse<AssessoriaPainel>(
    await apiFetch(`/api/assessoria/${portal}/${clienteId}`, {
      method: "PATCH",
      body: JSON.stringify(campos),
    }),
  );
}

export type ServicoEmail = "caufesp" | "bll" | "licitacoes_e" | "pncp";

export function reenviarEmailAtivacao(clienteId: number, servico: ServicoEmail) {
  return acao<{ para?: string; simulado?: boolean; assunto?: string }>(clienteId, {
    acao: "reenviar_email",
    servico,
  });
}

export async function previewEmailAtivacao(clienteId: number, servico: ServicoEmail, renovacao = false) {
  return parse<{ assunto: string; html: string; para: string | null }>(
    await apiFetch(
      `/api/admin/clients/${clienteId}/servicos?preview=${servico}${renovacao ? "&renovacao=1" : ""}`,
    ),
  );
}

/** Quantidade de itens aguardando a equipe (conferência de documentos e pedidos de apoio). */
export function pendenciasEquipe(s: ServicosCliente) {
  const assessoria = (r: AssessoriaResumo) =>
    r.existe && r.status === "conferencia_cadbrasil" ? Math.max(1, r.documentosAguardando) : 0;
  const apoios = s.licitacoesE.acompanhamentos.filter((a) => a.apoioSolicitadoEm).length;
  return assessoria(s.caufesp) + assessoria(s.bll) + apoios;
}
