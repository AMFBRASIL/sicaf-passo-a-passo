import { apiFetch } from "@/lib/api-fetch";
import { uploadStorageFile } from "@/lib/storage-api";
import { readAuthToken } from "@/lib/auth-cookie";
import { apiUrl } from "@/lib/api-config";

export type SituacaoPortal =
  | "publicada"
  | "propostas_abertas"
  | "em_disputa"
  | "em_homologacao"
  | "concluida";

export type EtapaAssistente =
  | "localizar"
  | "edital"
  | "aptidao"
  | "checklist"
  | "proposta"
  | "envio"
  | "disputa"
  | "habilitacao"
  | "resultado";

export type EtapaAcesso =
  | "certificado"
  | "documentos"
  | "formulario"
  | "agencia"
  | "chave"
  | "primeiro_acesso";

export type ResultadoLicitacao =
  | "vencedora"
  | "nao_vencedora"
  | "fracassada"
  | "deserta"
  | "revogada";

export type ChecklistItem = {
  id: string;
  categoria: string;
  item: string;
  status: "pendente" | "ok" | "nao_aplica";
};

export type AnaliseEdital = {
  orgao?: string | null;
  modalidade?: string | null;
  numero?: string | null;
  objeto?: string | null;
  valorEstimado?: string | null;
  dataSessao?: string | null;
  localidade?: string | null;
  criterioJulgamento?: string | null;
  exclusivaME?: boolean | null;
  documentos?: string[];
  pontosAtencao?: string[];
  requisitosHabilitacao?: { categoria?: string; itens?: string[] }[];
  cronograma?: { evento?: string; data?: string; status?: string }[];
};

export type Acompanhamento = {
  id: number;
  licitacaoId: number | null;
  numeroLicitacao: string | null;
  orgao: string | null;
  objeto: string | null;
  uf: string | null;
  modalidade: string | null;
  dataDisputa: string | null;
  valorEstimado: number | null;
  link: string | null;
  situacaoPortal: SituacaoPortal;
  etapas: EtapaAssistente[];
  checklist: ChecklistItem[];
  editalUrl: string | null;
  editalNome: string | null;
  analise: AnaliseEdital | null;
  analiseEm: string | null;
  resultado: ResultadoLicitacao | null;
  apoioSolicitadoEm: string | null;
  apoioMensagem: string | null;
  observacaoCadbrasil: string | null;
  createdAt: string | null;
};

export type LicitacoesEPainel = {
  acessoEtapas: EtapaAcesso[];
  acompanhamentos: Acompanhamento[];
};

export type LicitacaoEncontrada = {
  id: number;
  numeroLicitacao: string | null;
  orgao: string | null;
  uf: string | null;
  municipio: string | null;
  modalidade: string | null;
  objeto: string | null;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  valorEstimado: number | null;
  link: string | null;
  linkPncp: string | null;
};

type Resp<T> = ({ ok: true } & T) | { ok: false; error: string };

async function parse<T>(res: Response): Promise<Resp<T>> {
  const data = await res
    .json()
    .catch(() => ({ ok: false, error: "Resposta inválida do servidor" }));
  if (!data.ok) return { ok: false, error: data.error || "Erro no Assistente Licitações-e" };
  return data as Resp<T>;
}

function acao(clienteId: number, body: Record<string, unknown>) {
  return apiFetch(`/api/licitacoes-e/${clienteId}`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => parse<LicitacoesEPainel & { criadoId?: number }>(r));
}

export async function fetchLicitacoesEPainel(clienteId: number) {
  return parse<LicitacoesEPainel>(await apiFetch(`/api/licitacoes-e/${clienteId}`));
}

export function salvarAcessoLicitacoesE(clienteId: number, etapas: EtapaAcesso[]) {
  return acao(clienteId, { acao: "acesso", etapas });
}

export function criarAcompanhamento(
  clienteId: number,
  dados: {
    licitacaoId?: number;
    numeroLicitacao?: string;
    orgao?: string;
    objeto?: string;
    uf?: string;
    dataDisputa?: string;
    link?: string;
  },
) {
  return acao(clienteId, { acao: "criar", dados });
}

export function atualizarAcompanhamento(
  clienteId: number,
  id: number,
  campos: Partial<{
    situacaoPortal: SituacaoPortal;
    etapas: EtapaAssistente[];
    checklist: ChecklistItem[];
    resultado: ResultadoLicitacao | null;
    dataDisputa: string | null;
    numeroLicitacao: string | null;
    link: string | null;
  }>,
) {
  return acao(clienteId, { acao: "atualizar", id, campos });
}

export function solicitarApoioAcompanhamento(clienteId: number, id: number, mensagem?: string) {
  return acao(clienteId, { acao: "apoio", id, mensagem });
}

export function removerAcompanhamento(clienteId: number, id: number) {
  return acao(clienteId, { acao: "remover", id });
}

/**
 * Leitor de editais com IA no contexto da empresa: incluído no PNCP Inteligente;
 * sem o módulo, consome 1 crédito de IA do usuário.
 */
export async function lerEditalComIa(clienteId: number, arquivo: File) {
  const token = readAuthToken() || localStorage.getItem("cadbrasil_token") || "";
  const form = new FormData();
  form.append("file", arquivo, arquivo.name);
  const res = await fetch(apiUrl(`/api/modulos/edital/${clienteId}`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = (await res.json().catch(() => ({ ok: false }))) as {
    ok: boolean;
    error?: string;
    resultado?: AnaliseEdital;
    incluidoNoModulo?: boolean;
  };
  if (!data.ok || !data.resultado) {
    return { ok: false as const, error: data.error || "Não foi possível analisar o edital." };
  }
  return {
    ok: true as const,
    resultado: data.resultado,
    incluidoNoModulo: Boolean(data.incluidoNoModulo),
  };
}

/** Lê o edital com IA e grava o resultado no acompanhamento, gerando o checklist. */
export async function analisarEditalAcompanhamento(clienteId: number, id: number, arquivo: File) {
  const upload = await uploadStorageFile(arquivo, `clientes/${clienteId}/licitacoes-e`);
  const leitura = await lerEditalComIa(clienteId, arquivo);
  if (!leitura.ok) return leitura;
  const data = leitura;
  return acao(clienteId, {
    acao: "analise",
    id,
    editalUrl: upload.ok ? upload.fullUrl || upload.url : undefined,
    editalNome: arquivo.name,
    analise: data.resultado,
  });
}

export async function buscarLicitacoesE(params: {
  clienteId: number;
  q?: string;
  uf?: string;
  abertas?: boolean;
  pagina?: number;
}) {
  const sp = new URLSearchParams({ clienteId: String(params.clienteId) });
  if (params.q) sp.set("q", params.q);
  if (params.uf) sp.set("uf", params.uf);
  if (params.abertas) sp.set("abertas", "1");
  if (params.pagina) sp.set("pagina", String(params.pagina));
  return parse<{
    total: number;
    pagina: number;
    totalPaginas: number;
    licitacoes: LicitacaoEncontrada[];
  }>(await apiFetch(`/api/licitacoes-e/busca?${sp.toString()}`));
}

export function dataHoraFmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Apta quando todos os itens do checklist (exceto “não se aplica”) estão OK. */
export function calcularAptidao(checklist: ChecklistItem[]) {
  const considerados = checklist.filter((i) => i.status !== "nao_aplica");
  const ok = considerados.filter((i) => i.status === "ok").length;
  const total = considerados.length;
  const pct = total ? Math.round((ok / total) * 100) : 0;
  return { ok, total, pct, pendentes: total - ok, apto: total > 0 && ok === total };
}

export const SITUACOES_PORTAL: { id: SituacaoPortal; label: string; descricao: string }[] = [
  {
    id: "publicada",
    label: "Publicada",
    descricao: "Edital divulgado no Licitações-e. Hora de ler o edital e decidir se vale disputar.",
  },
  {
    id: "propostas_abertas",
    label: "Propostas abertas",
    descricao:
      "Período de acolhimento: a proposta e os anexos são cadastrados no portal até a data limite.",
  },
  {
    id: "em_disputa",
    label: "Em disputa",
    descricao: "Sessão pública na Sala de Disputa: fase de lances em tempo real.",
  },
  {
    id: "em_homologacao",
    label: "Em homologação",
    descricao:
      "Análise da proposta e dos documentos de habilitação do arrematante, recursos e adjudicação.",
  },
  {
    id: "concluida",
    label: "Concluída",
    descricao: "Processo homologado (ou encerrado). Resultado final disponível.",
  },
];

export const RESULTADOS: { id: ResultadoLicitacao; label: string }[] = [
  { id: "vencedora", label: "Empresa vencedora" },
  { id: "nao_vencedora", label: "Não vencemos" },
  { id: "fracassada", label: "Licitação fracassada" },
  { id: "deserta", label: "Licitação deserta" },
  { id: "revogada", label: "Revogada / anulada" },
];
