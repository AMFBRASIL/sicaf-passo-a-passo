import { fetchClientByDocumento } from "@/lib/api-fetch";
import {
  fetchEmpresaGerenciar,
  fetchEmpresas,
  fetchSicafValores,
  type EmpresaGerenciarPainel,
} from "@/lib/empresas-api";
import {
  fetchCertificadoDigital,
  type CertificadoDigitalInfo,
} from "@/lib/certificado-api";
import {
  needsSicafTaxaPaymentFromPainel,
  sicafTaxaLiberada,
} from "@/lib/sicaf-access-rules";
import {
  calcSaudeDocumentalFromDocs,
  type SaudeDocumentalStats,
} from "@/components/saude-documental-card";

export type EstadoSicaf = "novo" | "vencido" | "completo";

export type SicafPageCliente = {
  clienteId: number;
  nome: string;
  cnpj: string;
  documento: string;
  tipoDocumento: "CPF" | "CNPJ";
  endereco: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  responsavel: string;
  ramoAtividade: string;
  estado: EstadoSicaf;
  validade?: string;
  vencidoEm?: string;
  niveis?: number[];
};

export type SicafPageData = {
  ok: boolean;
  error?: string;
  cliente?: SicafPageCliente;
  painel?: EmpresaGerenciarPainel;
  certificado?: CertificadoDigitalInfo | null;
  valorRenovacaoFmt?: string;
};

function formatDocumento(doc: string): string {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return String(doc || "").trim();
}

function resolveTipoDocumento(doc: string): "CPF" | "CNPJ" {
  const d = String(doc || "").replace(/\D/g, "");
  return d.length === 11 ? "CPF" : "CNPJ";
}

const NIVEIS_SICAF_TOTAL = 6;

const NUM_TO_ROMAN: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
};

function getNivelDetail(
  niveisDetail: EmpresaGerenciarPainel["niveisDetail"],
  n: number,
) {
  if (!niveisDetail) return undefined;
  const roman = NUM_TO_ROMAN[n];
  return niveisDetail[roman] ?? niveisDetail[String(n)];
}

function nivelValidado(
  niveisDetail: EmpresaGerenciarPainel["niveisDetail"],
  n: number,
): boolean {
  return getNivelDetail(niveisDetail, n)?.status === "validado";
}

function nivelCadastrado(
  niveisDetail: EmpresaGerenciarPainel["niveisDetail"],
  n: number,
): boolean {
  const status = getNivelDetail(niveisDetail, n)?.status;
  return !!status && status !== "nao_cadastrado";
}

/** Níveis I, II e III cadastrados no Compras.gov.br (habilitados com situação informada). */
export function sicafNiveisIIIEmOrdem(
  niveisDetail: EmpresaGerenciarPainel["niveisDetail"] | null | undefined,
): boolean {
  if (!niveisDetail) return false;
  return (
    nivelCadastrado(niveisDetail, 1) &&
    nivelCadastrado(niveisDetail, 2) &&
    nivelCadastrado(niveisDetail, 3)
  );
}

function countNiveisValidados(niveisDetail: EmpresaGerenciarPainel["niveisDetail"]): number {
  let count = 0;
  for (let n = 1; n <= NIVEIS_SICAF_TOTAL; n++) {
    if (nivelValidado(niveisDetail, n)) count++;
  }
  return count;
}

export function todosNiveisValidados(niveisDetail: EmpresaGerenciarPainel["niveisDetail"]): boolean {
  return countNiveisValidados(niveisDetail) >= NIVEIS_SICAF_TOTAL;
}

/** Pelo menos um nível SICAF (I–VI) habilitado no cadastro do cliente. */
export function temAlgumNivelSicafHabilitado(
  niveisDetail: EmpresaGerenciarPainel["niveisDetail"] | null | undefined,
): boolean {
  if (!niveisDetail) return false;
  for (let n = 1; n <= NIVEIS_SICAF_TOTAL; n++) {
    if (nivelCadastrado(niveisDetail, n)) return true;
  }
  return false;
}

/** Nível I–VI com situação ativa (validado, vencendo ou pendente no Compras.gov.br). */
function nivelComValidade(
  niveisDetail: EmpresaGerenciarPainel["niveisDetail"] | null | undefined,
  n: number,
): boolean {
  const st = getNivelDetail(niveisDetail, n)?.status;
  return st === "validado" || st === "vencendo" || st === "pendente";
}

/** Algum nível de I a VI com validade informada. */
export function algumNivelSicafComValidade(
  niveisDetail: EmpresaGerenciarPainel["niveisDetail"] | null | undefined,
): boolean {
  for (let n = 1; n <= NIVEIS_SICAF_TOTAL; n++) {
    if (nivelComValidade(niveisDetail, n)) return true;
  }
  return false;
}

export function etapasSicafConcluidas(etapaAtual: number, totalEtapas: number): boolean {
  return etapaAtual > totalEtapas;
}

/**
 * Saúde documental na página /sicaf:
 * - Etapas em andamento + algum nível I–VI com validade → 50% (progresso parcial).
 * - Etapas concluídas → % real pelos documentos (válido 100%, vencendo 50%, vencida/pendente 0%).
 */
export function calcSaudeDocumentalSicaf(
  docs: { status: string }[],
  niveisDetail?: EmpresaGerenciarPainel["niveisDetail"] | null,
  options?: { etapasConcluidas?: boolean },
): SaudeDocumentalStats {
  const fromDocs = calcSaudeDocumentalFromDocs(docs);
  if (options?.etapasConcluidas) {
    return fromDocs;
  }
  if (algumNivelSicafComValidade(niveisDetail)) {
    return { ...fromDocs, score: 50 };
  }
  return fromDocs;
}

/** Estado exibido nos banners — não confundir com status "Ativo" só pela data de validade. */
function mapSicafEstado(painel: EmpresaGerenciarPainel): EstadoSicaf {
  const status = String(painel.sicaf?.status || "").toLowerCase();
  if (status.includes("vencid")) return "vencido";
  if (todosNiveisValidados(painel.niveisDetail)) return "completo";
  return "novo";
}

function hasRequiredDocumentos(painel: EmpresaGerenciarPainel): boolean {
  const uploaded = painel.documentos.filter((d) => d.status === "ok" || d.arquivoUrl);
  return uploaded.length >= 4;
}

/** Regra 1 — SICAF Ativo e taxa paga. */
export function pagamentoSicafConfirmado(painel: EmpresaGerenciarPainel | null | undefined): boolean {
  if (painel?.financeiro?.acessoLiberado != null) {
    return painel.financeiro.acessoLiberado;
  }
  return sicafTaxaLiberada(painel);
}

export function deriveEtapaAtual(
  painel: EmpresaGerenciarPainel,
  _certificado: CertificadoDigitalInfo | null | undefined,
  extensionInstalled: boolean,
  renovando: boolean,
  total: number,
): number {
  const estado = mapSicafEstado(painel);

  // SICAF vencido: etapas já concluídas até o usuário iniciar renovação
  if (estado === "vencido" && !renovando) {
    return total + 1;
  }

  // Níveis I–III cadastrados: processo essencial concluído — acompanhar no Assistente
  if (!renovando && sicafNiveisIIIEmOrdem(painel.niveisDetail)) {
    return total + 1;
  }

  // Fluxo passo a passo — certificado digital é opcional (Assistente / configurações)
  if (needsSicafTaxaPaymentFromPainel(painel)) return 1;
  if (!hasRequiredDocumentos(painel)) return 2;
  if (!extensionInstalled) return 3;
  if (!nivelValidado(painel.niveisDetail, 3)) return 4;
  if (!nivelValidado(painel.niveisDetail, 4)) return 5;
  if (!todosNiveisValidados(painel.niveisDetail)) return 6;

  return total + 1;
}

function mapPainelToCliente(painel: EmpresaGerenciarPainel): SicafPageCliente {
  const c = painel.cliente;
  const estado = mapSicafEstado(painel);
  const ROMAN_TO_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  const niveis = Object.entries(painel.niveisDetail || {})
    .filter(([, v]) => v.status === "validado")
    .map(([k]) => ROMAN_TO_NUM[k] ?? Number(k))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 6);

  return {
    clienteId: c.id,
    nome: c.razaoSocial || c.nomeFantasia || "",
    cnpj: formatDocumento(c.documento),
    documento: formatDocumento(c.documento),
    tipoDocumento: resolveTipoDocumento(c.documento),
    endereco: c.endereco || "",
    cidade: c.cidade || "",
    uf: c.estado || "",
    telefone: c.telefone || "",
    email: c.email || "",
    responsavel: c.responsavel || "",
    ramoAtividade: c.ramoAtividade || "",
    estado,
    validade: painel.sicaf?.validade || undefined,
    vencidoEm: estado === "vencido" ? painel.sicaf?.validade || undefined : undefined,
    niveis: niveis.length ? niveis : undefined,
  };
}

async function resolveClienteId(cnpj?: string): Promise<{
  ok: boolean;
  clienteId?: number;
  error?: string;
}> {
  if (cnpj) {
    const doc = cnpj.replace(/\D/g, "");
    const found = await fetchClientByDocumento(doc);
    if (!found.found || !found.client) {
      return { ok: false, error: found.error || "Empresa não encontrada para este CNPJ" };
    }
    const c = found.client as { id?: number };
    if (!c.id) return { ok: false, error: "Empresa não encontrada" };
    return { ok: true, clienteId: c.id };
  }

  const list = await fetchEmpresas();
  if (!list.ok || !list.empresas?.length) {
    return { ok: false, error: list.error || "Nenhuma empresa cadastrada" };
  }
  const first = list.empresas[0];
  if (!first.clienteId) {
    return { ok: false, error: "Empresa sem identificador" };
  }
  return { ok: true, clienteId: first.clienteId };
}

export async function loadSicafPageData(cnpj?: string): Promise<SicafPageData> {
  const resolved = await resolveClienteId(cnpj);
  if (!resolved.ok || !resolved.clienteId) {
    return { ok: false, error: resolved.error };
  }

  const [gerenciar, cert, valores] = await Promise.all([
    fetchEmpresaGerenciar(resolved.clienteId),
    fetchCertificadoDigital(resolved.clienteId),
    fetchSicafValores(),
  ]);

  if (!gerenciar.ok || !gerenciar.painel) {
    return { ok: false, error: gerenciar.error || "Erro ao carregar dados da empresa" };
  }

  const valorRenovacaoFmt =
    gerenciar.painel.financeiro.valorCadastroSicafFmt ||
    (valores.valores
      ? valores.valores.valorCadastroSicaf.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : "R$ 985,00");

  return {
    ok: true,
    cliente: mapPainelToCliente(gerenciar.painel),
    painel: gerenciar.painel,
    certificado: cert.certificado ?? null,
    valorRenovacaoFmt,
  };
}

export async function reloadSicafPainel(clienteId: number): Promise<{
  ok: boolean;
  painel?: EmpresaGerenciarPainel;
  certificado?: CertificadoDigitalInfo | null;
  cliente?: SicafPageCliente;
  error?: string;
}> {
  const [gerenciar, cert] = await Promise.all([
    fetchEmpresaGerenciar(clienteId),
    fetchCertificadoDigital(clienteId),
  ]);

  if (!gerenciar.ok || !gerenciar.painel) {
    return { ok: false, error: gerenciar.error };
  }

  return {
    ok: true,
    painel: gerenciar.painel,
    certificado: cert.certificado ?? null,
    cliente: mapPainelToCliente(gerenciar.painel),
  };
}
