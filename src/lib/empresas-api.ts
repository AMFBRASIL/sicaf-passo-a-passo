import { apiFetch } from "@/lib/api-fetch";
import type { EmpresaData, SicafStatus } from "@/lib/empresas-shared";
import {
  needsSicafTaxaPaymentFromInput,
  shouldGerenciarAbrirPagamentoFromInput,
} from "@/lib/sicaf-access-rules";
import { Plus, RefreshCw, Rocket } from "lucide-react";
import { mapNivelStatusFromRaw } from "@/lib/nivel-status";

/**
 * Regras alinhadas ao SIstema-Antigo (SICAF.tsx) — ver sicaf-access-rules.ts.
 */
export function needsSicafTaxaPayment(item: SicafListItem): boolean {
  return needsSicafTaxaPaymentFromInput({
    hasSicaf: !!item.hasSicaf,
    status: item.status,
    financialReleased: !!item.financialReleased,
  });
}

/** Regra do botão Gerenciar — pagamento quando há taxa pendente. */
export function shouldGerenciarAbrirPagamento(item: SicafListItem): boolean {
  return shouldGerenciarAbrirPagamentoFromInput({
    hasSicaf: !!item.hasSicaf,
    status: item.status,
    financialReleased: !!item.financialReleased,
  });
}

export type SicafListItem = {
  id: number;
  clienteId: number;
  client: string;
  fantasyName?: string;
  documento: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  status: string;
  expiryDate?: string;
  lastUpdate?: string;
  levels?: string[];
  levelsDetail?: Record<string, { status: string; observacao?: string | null }>;
  maintenanceActive?: boolean;
  financialReleased?: boolean;
  hasSicaf?: boolean;
  daysValid?: number | null;
};

export type SicafValores = {
  valorCadastroSicaf: number;
  valorManutencaoMensal: number;
};

export type SicafPlano = {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  preco: number;
  prazo: string | null;
  badge: string | null;
  icon: string | null;
  destaque: boolean;
};

const ROMAN_TO_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

function mapSicafStatus(item: SicafListItem): SicafStatus {
  if (!item.hasSicaf || item.status === "Sem SICAF") return "sem_cadastro";
  const s = item.status;
  if (s === "Ativo") return "ativo";
  if (s === "Vencendo") return "atencao";
  if (s === "Vencido") return "vencido";
  if (s === "Pendente" || s === "Cancelado" || s === "Inativo") return "sem_cadastro";
  return "sem_cadastro";
}

function proximoPasso(item: SicafListItem, sicaf: SicafStatus): string {
  if (needsSicafTaxaPayment(item)) {
    if (!item.hasSicaf || item.status === "Sem SICAF") {
      return "Esta empresa ainda não possui SICAF. Gere e pague a taxa para cadastrar.";
    }
    if (item.status === "Vencido") {
      return "SICAF vencido — regularize o pagamento para voltar a licitar.";
    }
    if (item.status === "Vencendo") {
      return `SICAF vencendo${item.expiryDate ? ` em ${item.expiryDate}` : ""}. Gere a taxa de renovação.`;
    }
    if (item.status === "Ativo" && !item.financialReleased) {
      return "SICAF ativo, mas o pagamento da taxa ainda não foi confirmado.";
    }
    return "Gere e pague a taxa de cadastro para iniciar o SICAF.";
  }
  if (sicaf === "vencido") return "Sua empresa está fora de licitações. Atualize agora.";
  if (sicaf === "atencao") {
    return item.expiryDate
      ? `Validade ${item.expiryDate}. Atualize os níveis antes do vencimento.`
      : "Atualização recomendada antes do vencimento.";
  }
  if (sicaf === "sem_cadastro") return "Esta empresa ainda não possui SICAF. Vamos cadastrar?";
  if (item.daysValid != null && item.daysValid <= 30) {
    return `SICAF válido por mais ${item.daysValid} dias. Monitore certidões e níveis.`;
  }
  return "Licença SICAF paga. Envie a Situação do Fornecedor pelo Assistente para ficar APTO.";
}

function mapAcao(item: SicafListItem, sicaf: SicafStatus): EmpresaData["acao"] {
  if (needsSicafTaxaPayment(item)) {
    if (item.status === "Vencido") {
      return { label: "Renovar SICAF", icon: Rocket };
    }
    if (item.status === "Ativo") {
      return { label: "Confirmar pagamento", icon: Plus };
    }
    return { label: "Cadastrar SICAF", icon: Plus };
  }
  if (sicaf === "vencido" || sicaf === "atencao") {
    return { label: sicaf === "vencido" ? "Resolver agora" : "Atualizar SICAF", icon: Rocket };
  }
  return { label: "Ver detalhes", variant: "outline", icon: RefreshCw };
}

export function mapSicafItemToEmpresa(item: SicafListItem): EmpresaData {
  const sicaf = mapSicafStatus(item);
  const taxaPendente = needsSicafTaxaPayment(item);

  const niveis = (item.levels || [])
    .map((r) => ROMAN_TO_NUM[r] ?? 0)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  const detalhesNiveis: EmpresaData["detalhesNiveis"] = {};
  if (item.levelsDetail) {
    for (const [roman, detail] of Object.entries(item.levelsDetail)) {
      const num = ROMAN_TO_NUM[roman];
      if (!num) continue;
      detalhesNiveis[num] = {
        status: mapNivelStatusFromRaw(detail.status),
        observacao: detail.observacao || undefined,
      };
    }
  }

  let validade = item.expiryDate || undefined;
  if (sicaf === "vencido" && item.expiryDate) {
    validade = `Vencido em ${item.expiryDate}`;
  }

  return {
    clienteId: item.clienteId,
    sicafId: item.id || undefined,
    nome: item.client,
    cnpj: item.documento,
    sicaf,
    validade,
    proximoPasso: proximoPasso(item, sicaf),
    acao: mapAcao(item, sicaf),
    endereco: item.endereco || "",
    cidade: item.cidade || "",
    uf: item.estado || "",
    telefone: item.telefone || "",
    email: item.email || "",
    responsavel: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    ramoAtividade: "",
    niveis: niveis.length ? niveis : undefined,
    detalhesNiveis: Object.keys(detalhesNiveis).length ? detalhesNiveis : undefined,
    taxaPendente,
    manutencaoAtiva: item.maintenanceActive,
    diasValidade: item.daysValid ?? null,
  };
}

export async function fetchEmpresas(search = ""): Promise<{
  ok: boolean;
  empresas: EmpresaData[];
  valorTaxa?: number;
  error?: string;
}> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const qs = params.toString();
  const res = await apiFetch(`/api/sicaf/list${qs ? `?${qs}` : ""}`);
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, empresas: [], error: data.error || "Erro ao carregar empresas" };
  }
  const items = (data.items || []) as SicafListItem[];
  return {
    ok: true,
    empresas: items.map(mapSicafItemToEmpresa),
    valorTaxa: data.valorTaxa,
  };
}

export async function fetchSicafPlanos(): Promise<{ ok: boolean; planos?: SicafPlano[]; error?: string }> {
  const res = await apiFetch("/api/sicaf/planos");
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao buscar planos" };
  }
  return { ok: true, planos: (data.planos || []) as SicafPlano[] };
}

export async function fetchSicafValores(): Promise<{ ok: boolean; valores?: SicafValores; error?: string }> {
  const res = await apiFetch("/api/sicaf/valores");
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao buscar valores" };
  }
  return { ok: true, valores: data.valores };
}

export type GerarTaxaPayload = {
  clienteId: number;
  formaPagamento: "boleto" | "pix";
  planoCodigo: string;
  ano?: number;
  dataVencimento?: string;
  /** Somente equipe admin — o backend valida permissão antes de aceitar. */
  allowCustomDueDate?: boolean;
};

export type RegistrarEmpresaPayload = {
  documento: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  ramoAtividade?: string;
  responsavelNome?: string;
};

export type RegistrarEmpresaResult = {
  ok: boolean;
  clienteId?: number;
  sicafId?: number;
  message?: string;
  error?: string;
};

export async function registrarEmpresa(
  payload: RegistrarEmpresaPayload,
): Promise<RegistrarEmpresaResult> {
  const res = await apiFetch("/api/clients/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

export const PLANO_WIZARD_PARA_CODIGO: Record<"padrao" | "emergencial", string> = {
  padrao: "sicaf_padrao",
  emergencial: "sicaf_imediato",
};

export type PagamentoGerado = {
  barcode?: string;
  link?: string;
  pdf?: string;
  valor: number;
  vencimento?: string;
  protocolo?: string;
  chargeId?: number;
  qrcodeText?: string;
  qrcodeImage?: string;
  txid?: string;
  pagamentoId?: number;
};

export type GerenciarItem = {
  id?: number | string;
  titulo: string;
  descricao: string;
  status: "ok" | "warn" | "danger" | "idle";
  emissor?: string;
  nivel?: string | null;
  dataValidade?: string | null;
  arquivoUrl?: string | null;
  codigo?: string;
  uploadManual?: boolean;
  valor?: number;
  linkPdf?: string | null;
  linkBoleto?: string | null;
};

export type ColaboradorResumo = {
  id: number | string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  cargo?: string | null;
  papel?: string | null;
  papelLabel?: string | null;
  status: "ativo" | "convite" | "inativo";
  ultimoAcesso?: string | null;
};

export type EmpresaGerenciarPainel = {
  cliente: {
    id: number;
    razaoSocial: string;
    nomeFantasia?: string | null;
    documento: string;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
    inscricaoEstadual?: string | null;
    inscricaoMunicipal?: string | null;
    ramoAtividade?: string | null;
    responsavel?: string | null;
  };
  sicaf?: {
    id: number;
    status: string;
    validade?: string | null;
    diasValidade?: number | null;
    completude?: number;
    manutencaoAtiva?: boolean;
  } | null;
  niveisDetail?: Record<string, { status: string; observacao?: string }>;
  certidoes: GerenciarItem[];
  documentos: GerenciarItem[];
  colaboradores: ColaboradorResumo[];
  pendencias: GerenciarItem[];
  manutencao: {
    ativa: boolean;
    valorMensalFmt: string;
    diaVencimento?: number | null;
    proximoVencimento?: string | null;
    acoes: GerenciarItem[];
    historico: GerenciarItem[];
  };
  financeiro: {
    valorCadastroSicafFmt: string;
    valorManutencaoMensalFmt: string;
    taxaPendente: boolean;
    /** Pagamento confirmado em taxas_sicaf */
    taxaPaga: boolean;
    /** Ativo + pago — libera assistente e fluxos completos */
    acessoLiberado?: boolean;
    proximaCobranca?: { valorFmt: string; data?: string | null } | null;
    renovacaoSicaf?: { data?: string | null; valorFmt: string } | null;
    historico: GerenciarItem[];
  };
  badges: {
    faltam: number;
    certidoes: number;
    manutencao?: string;
    documentos?: string;
    colaboradores?: string;
  };
};

export async function fetchEmpresaGerenciar(clienteId: number): Promise<{
  ok: boolean;
  painel?: EmpresaGerenciarPainel;
  error?: string;
}> {
  const res = await apiFetch(`/api/clients/${clienteId}/gerenciar`);
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao carregar dados da empresa" };
  }
  const { ok: _ok, error: _err, ...painel } = data;
  return { ok: true, painel: painel as EmpresaGerenciarPainel };
}

export async function salvarEmpresaGerenciar(
  clienteId: number,
  payload: Record<string, string | undefined>,
): Promise<{ ok: boolean; painel?: EmpresaGerenciarPainel; error?: string }> {
  const res = await apiFetch(`/api/clients/${clienteId}/gerenciar`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao salvar dados" };
  }
  const { ok: _ok, error: _err, ...painel } = data;
  return { ok: true, painel: painel as EmpresaGerenciarPainel };
}

export async function gerarTaxaSicaf(payload: GerarTaxaPayload): Promise<{
  ok: boolean;
  error?: string;
  pagamento?: PagamentoGerado;
}> {
  const res = await apiFetch("/api/sicaf/gerar-taxa", {
    method: "POST",
    body: JSON.stringify({
      clienteId: payload.clienteId,
      ano: payload.ano ?? new Date().getFullYear(),
      formaPagamento: payload.formaPagamento,
      dataVencimento: payload.dataVencimento,
      planoCodigo: payload.planoCodigo,
      allowCustomDueDate: payload.allowCustomDueDate,
    }),
  });
  const result = await res.json();
  if (!result.ok) {
    return { ok: false, error: result.error || "Erro ao gerar pagamento" };
  }
  return { ok: true, pagamento: result.dados?.pagamento as PagamentoGerado };
}
