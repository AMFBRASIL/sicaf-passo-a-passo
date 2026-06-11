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

export type EstadoSicaf = "novo" | "vencido" | "completo";

export type SicafPageCliente = {
  clienteId: number;
  nome: string;
  cnpj: string;
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

function formatCnpj(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length !== 14) return doc;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

const NIVEIS_SICAF_TOTAL = 6;

function nivelValidado(
  niveisDetail: EmpresaGerenciarPainel["niveisDetail"],
  n: number,
): boolean {
  const item = niveisDetail?.[String(n)] || niveisDetail?.[n as unknown as string];
  return item?.status === "validado";
}

function countNiveisValidados(niveisDetail: EmpresaGerenciarPainel["niveisDetail"]): number {
  let count = 0;
  for (let n = 1; n <= NIVEIS_SICAF_TOTAL; n++) {
    if (nivelValidado(niveisDetail, n)) count++;
  }
  return count;
}

function todosNiveisValidados(niveisDetail: EmpresaGerenciarPainel["niveisDetail"]): boolean {
  return countNiveisValidados(niveisDetail) >= NIVEIS_SICAF_TOTAL;
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

  // Fluxo passo a passo — certificado digital é opcional (Assistente / configurações)
  if (!painel.financeiro.taxaPaga) return 1;
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
  const niveis = Object.entries(painel.niveisDetail || {})
    .filter(([, v]) => v.status === "validado")
    .map(([k]) => Number(k))
    .filter((n) => Number.isFinite(n));

  return {
    clienteId: c.id,
    nome: c.razaoSocial || c.nomeFantasia || "",
    cnpj: formatCnpj(c.documento),
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
