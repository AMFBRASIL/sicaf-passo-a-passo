import { apiFetch } from "@/lib/api-fetch";

export type ServicoCaptacaoId =
  | "sicaf"
  | "manutencao"
  | "caufesp"
  | "bll"
  | "licitacoes_e"
  | "pncp"
  | "leitor_ia";

export type TipoSegmento =
  | "quente"
  | "renovacao"
  | "recuperacao"
  | "relacionamento"
  | "frio"
  | "prospeccao";

export type ServicoKpis = {
  ativos: number;
  andamento: number;
  potencial: number;
  potencialLabel: string;
  vendas30d: number;
  receita30d: number;
};

export type ServicoResumo = {
  id: ServicoCaptacaoId;
  nome: string;
  sigla: string;
  abrangencia: string;
  resumo: string;
  cor: string;
  rota: string;
  ativoLabel: string;
  andamentoLabel: string;
  preco: { valor: number; texto: string };
};

export type ModeloEmail = { assunto: string; corpo: string; cta: string };

export type Segmento = {
  id: string;
  nome: string;
  descricao: string;
  tipo: TipoSegmento;
  /** "fornecedores" = base pública de fornecedores do governo que ainda não são clientes. */
  base: "clientes" | "fornecedores";
  /** E-mails aptos a receber. */
  total: number;
  /** Registros com telefone (só fornecedores). */
  totalTelefone: number | null;
  email: ModeloEmail;
  whatsapp: string;
};

export type FornecedoresStatus = {
  total: number;
  comTelefone: number;
  comEmail: number;
  jaClientes: number;
  atualizadoEm: string | null;
  atualizando: boolean;
};

export type CampanhaStatus = "agendada" | "enviando" | "pausada" | "concluida" | "cancelada";

export type Campanha = {
  id: number;
  servico: ServicoCaptacaoId;
  servicoNome: string;
  rotinaId: number | null;
  segmento: string;
  segmentoNome: string;
  uf: string | null;
  assunto: string;
  status: CampanhaStatus;
  total: number;
  enviados: number;
  falhas: number;
  pendentes: number;
  cancelados: number;
  aberturas: number;
  cliques: number;
  conversoes: number;
  receita: number;
  agendadaPara: string | null;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  criadaEm: string;
  ultimoErro: string | null;
};

export type FrequenciaRotina = "uma_vez" | "diaria" | "semanal" | "mensal";

export type Rotina = {
  id: number;
  nome: string;
  servico: ServicoCaptacaoId;
  servicoNome: string;
  cor: string | null;
  segmento: string;
  segmentoNome: string;
  uf: string | null;
  cooldownDias: number;
  limite: number;
  assunto: string;
  frequencia: FrequenciaRotina;
  proximaExecucao: string | null;
  ultimaExecucao: string | null;
  ultimoResultado: string | null;
  execucoes: number;
  ativa: boolean;
  criadaEm: string;
  ultimaCampanhaId: number | null;
};

export type LogEnvio = {
  id: number;
  email: string;
  empresa: string;
  status: "processando" | "enviado" | "falha" | "cancelado";
  erro: string | null;
  enviadoEm: string | null;
};

export type ServicoDetalhe = ServicoResumo & {
  beneficios: string[];
  pitch: {
    gancho: string;
    argumentos: string[];
    objecoes: { pergunta: string; resposta: string }[];
  };
  whatsapp: string;
};

export type ResultadoContato =
  | "contatado"
  | "interessado"
  | "sem_interesse"
  | "sem_resposta"
  | "vendido";

export type ClientePublico = {
  clienteId: number | null;
  fornecedorId: number | null;
  empresa: string;
  documento: string;
  responsavel: string;
  email: string;
  telefone: string;
  whatsapp: string;
  cidade: string;
  uf: string;
  cadastradoEm: string;
  ultimoContato: {
    canal: string;
    resultado: ResultadoContato;
    observacao: string | null;
    em: string;
    por: string | null;
  } | null;
};

type Resposta<T> = ({ ok: true } & T) | { ok: false; error: string };

async function json<T>(res: Response): Promise<Resposta<T>> {
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    return { ok: false, error: data.error || `Erro HTTP ${res.status}` };
  }
  return { ...(data as T), ok: true };
}

export async function fetchServicosVisao(refresh = false) {
  const res = await apiFetch(`/api/admin/servicos-captacao${refresh ? "?refresh=1" : ""}`);
  return json<{
    servicos: (ServicoResumo & { kpis: ServicoKpis })[];
    campanhasAtivas: number;
    campanhasTotal: number;
  }>(res);
}

export async function fetchServicoDetalhe(
  servico: string,
  filtros: { uf?: string; cooldown?: number } = {},
) {
  const qs = new URLSearchParams();
  if (filtros.uf) qs.set("uf", filtros.uf);
  if (filtros.cooldown) qs.set("cooldown", String(filtros.cooldown));
  const query = qs.toString();
  const res = await apiFetch(
    `/api/admin/servicos-captacao/${encodeURIComponent(servico)}${query ? `?${query}` : ""}`,
  );
  return json<{
    servico: ServicoDetalhe;
    filtros: { uf: string | null; cooldownDias: number };
    kpis: ServicoKpis;
    segmentos: Segmento[];
    fornecedores: FornecedoresStatus;
    campanhas: Campanha[];
    rotinas: Rotina[];
  }>(res);
}

async function acaoServico<T>(servico: string, body: Record<string, unknown>) {
  const res = await apiFetch(`/api/admin/servicos-captacao/${encodeURIComponent(servico)}`, {
    method: "POST",
    body: JSON.stringify({ ...body, origem: window.location.origin }),
  });
  return json<T>(res);
}

export type ConteudoEmail = {
  segmento: string;
  uf?: string;
  assunto: string;
  corpo: string;
  cta: string;
};

export function previewEmail(servico: string, dados: ConteudoEmail) {
  return acaoServico<{
    assunto: string;
    html: string;
    amostra: { empresa: string; email: string };
  }>(servico, { action: "preview", ...dados });
}

export function enviarEmailTeste(servico: string, dados: ConteudoEmail & { para?: string }) {
  return acaoServico<{ para: string }>(servico, { action: "teste", ...dados });
}

export function criarCampanha(
  servico: string,
  dados: ConteudoEmail & { cooldownDias?: number; limite?: number; agendarPara?: string },
) {
  return acaoServico<{ campanhaId: number; total: number; agendada: boolean }>(servico, {
    action: "campanha",
    ...dados,
  });
}

export function criarRotina(
  servico: string,
  dados: ConteudoEmail & {
    nome?: string;
    frequencia: FrequenciaRotina;
    primeiraExecucao: string;
    cooldownDias?: number;
    limite?: number;
  },
) {
  return acaoServico<{ rotinaId: number; proximaExecucao: string }>(servico, {
    action: "rotina",
    ...dados,
  });
}

export function registrarContato(
  servico: string,
  dados: {
    clienteId?: number | null;
    fornecedorId?: number | null;
    canal: "whatsapp" | "telefone" | "email";
    resultado: ResultadoContato;
  },
) {
  return acaoServico<object>(servico, { action: "contato", ...dados });
}

export async function alterarCampanha(id: number, acao: "pausar" | "retomar" | "cancelar") {
  const res = await apiFetch(`/api/admin/servicos-captacao/campanhas/${id}`, {
    method: "POST",
    body: JSON.stringify({ acao }),
  });
  return json<object>(res);
}

export async function fetchLogCampanha(id: number) {
  const res = await apiFetch(`/api/admin/servicos-captacao/campanhas/${id}`);
  return json<{ campanha: Campanha; porMinuto: number; itens: LogEnvio[] }>(res);
}

export async function fetchAgendaServicos() {
  const res = await apiFetch("/api/admin/servicos-captacao/rotinas");
  return json<{ rotinas: Rotina[]; campanhas: Campanha[] }>(res);
}

export async function alterarRotina(
  id: number,
  acao: "pausar" | "ativar" | "executar" | "excluir",
) {
  const res = await apiFetch(`/api/admin/servicos-captacao/rotinas/${id}`, {
    method: "POST",
    body: JSON.stringify({ acao }),
  });
  return json<{ campanhaId?: number; total?: number }>(res);
}

export async function atualizarBaseFornecedores() {
  const res = await apiFetch("/api/admin/servicos-captacao/fornecedores", { method: "POST" });
  return json<{ fornecedores: FornecedoresStatus }>(res);
}

export async function fetchPublico(
  servico: string,
  params: {
    segmento: string;
    uf?: string;
    busca?: string;
    pagina?: number;
    ocultarContatados?: boolean;
  },
) {
  const qs = new URLSearchParams({ segmento: params.segmento, pagina: String(params.pagina || 1) });
  if (params.uf) qs.set("uf", params.uf);
  if (params.busca) qs.set("busca", params.busca);
  if (params.ocultarContatados) qs.set("ocultarContatados", "1");
  const res = await apiFetch(
    `/api/admin/servicos-captacao/${encodeURIComponent(servico)}/publico?${qs}`,
  );
  return json<{ total: number; pagina: number; porPagina: number; clientes: ClientePublico[] }>(
    res,
  );
}

export async function baixarPublico(
  servico: string,
  params: { segmento: string; uf?: string; cooldown?: number; formato: "padrao" | "google" },
): Promise<{ ok: true; total: number } | { ok: false; error: string }> {
  const qs = new URLSearchParams({ segmento: params.segmento, exportar: params.formato });
  if (params.uf) qs.set("uf", params.uf);
  if (params.cooldown) qs.set("cooldown", String(params.cooldown));
  const res = await apiFetch(
    `/api/admin/servicos-captacao/${encodeURIComponent(servico)}/publico?${qs}`,
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error || `Erro HTTP ${res.status}` };
  }
  const nome =
    /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] ||
    `publico-${servico}.csv`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true, total: Number(res.headers.get("X-Total-Registros") || 0) };
}
