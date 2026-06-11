import { apiFetch, fetchClientByDocumento } from "@/lib/api-fetch";
import { fetchEmpresas } from "@/lib/empresas-api";
import { enviarDocumentoChecklist } from "@/lib/documentos-api";

/** Certidões fiscais monitoradas na tela /certidoes (mesmo conjunto do layout original). */
export const MONITORING_CERT_CODIGOS = [
  "cnd_federal",
  "cnd_estadual",
  "cnd_municipal",
  "crf_fgts",
  "cndt_trabalhista",
] as const;

export type CertidaoApiStatus = "valid" | "expiring" | "expired" | "missing";

export type CertidaoItemApi = {
  tipoId: number;
  codigo: string;
  nome: string;
  descricao?: string;
  nivelSicaf?: string;
  orgaoEmissor?: string;
  requerCodigo?: boolean;
  requerValidade?: boolean;
  uploadManual?: boolean;
  certidaoId?: number | null;
  status: CertidaoApiStatus;
  dataEmissao?: string | null;
  dataValidade?: string | null;
  diasRestantes?: number | null;
  numero?: string | null;
  arquivoUrl?: string | null;
  arquivoNome?: string | null;
};

export type CertidoesStatusResponse = {
  ok: boolean;
  error?: string;
  cliente?: {
    id: number;
    razaoSocial: string;
    documento: string;
  };
  stats?: {
    total: number;
    validos: number;
    vencendo: number;
    vencidos: number;
    naoInformados: number;
  };
  items?: CertidaoItemApi[];
};

export type CertidaoUi = {
  tipoId: number;
  codigo: string;
  nome: string;
  emissor: string;
  status: "ok" | "warn" | "danger";
  validade: string;
  diasRestantes: number;
  arquivoUrl?: string | null;
  uploadManual: boolean;
  requerCodigo: boolean;
  requerValidade: boolean;
};

function formatCnpj(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length !== 14) return doc;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function fmtDateBr(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}

export function mapCertStatusUi(status: CertidaoApiStatus): "ok" | "warn" | "danger" {
  if (status === "valid") return "ok";
  if (status === "expiring") return "warn";
  return "danger";
}

export function mapCertidaoToUi(item: CertidaoItemApi): CertidaoUi {
  const uiStatus = mapCertStatusUi(item.status);
  let validade = "Não cadastrada";
  if (item.status === "expired" && item.dataValidade) {
    const fmt = fmtDateBr(item.dataValidade);
    validade = fmt ? `Vencida em ${fmt}` : "Vencida";
  } else if (item.dataValidade) {
    validade = fmtDateBr(item.dataValidade) || "—";
  } else if (item.status === "valid") {
    validade = "Válida (sem data)";
  }

  return {
    tipoId: item.tipoId,
    codigo: item.codigo,
    nome: item.nome,
    emissor: item.orgaoEmissor || "—",
    status: uiStatus,
    validade,
    diasRestantes: item.diasRestantes ?? (item.status === "missing" ? -1 : 0),
    arquivoUrl: item.arquivoUrl,
    uploadManual: item.uploadManual !== false,
    requerCodigo: !!item.requerCodigo,
    requerValidade: !!item.requerValidade,
  };
}

export function filterMonitoringCertidoes(items: CertidaoItemApi[]): CertidaoItemApi[] {
  const order = new Map(MONITORING_CERT_CODIGOS.map((c, i) => [c, i]));
  return items
    .filter((i) => MONITORING_CERT_CODIGOS.includes(i.codigo as (typeof MONITORING_CERT_CODIGOS)[number]))
    .sort((a, b) => (order.get(a.codigo as (typeof MONITORING_CERT_CODIGOS)[number]) ?? 99) - (order.get(b.codigo as (typeof MONITORING_CERT_CODIGOS)[number]) ?? 99));
}

export async function resolveClienteIdCertidoes(cnpj?: string): Promise<{
  ok: boolean;
  clienteId?: number;
  error?: string;
}> {
  if (cnpj?.trim()) {
    const doc = cnpj.replace(/\D/g, "");
    const found = await fetchClientByDocumento(doc);
    if (!found.found || !found.client) {
      return { ok: false, error: found.error || "Empresa não encontrada" };
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
  if (!first.clienteId) return { ok: false, error: "Empresa sem identificador" };
  return { ok: true, clienteId: first.clienteId };
}

export async function fetchCertidoesStatus(clienteId: number): Promise<CertidoesStatusResponse> {
  const res = await apiFetch(`/api/clients/${clienteId}/certidoes`);
  const data = (await res.json()) as CertidoesStatusResponse;
  return data;
}

export async function salvarCertidaoMonitoramento(payload: {
  clienteId: number;
  tipoId: number;
  arquivo: File;
  dataValidade?: string;
  codigo?: string;
  requerCodigo?: boolean;
  requerValidade?: boolean;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  if (payload.requerCodigo && !String(payload.codigo || "").trim()) {
    return { ok: false, error: "Informe o código da certidão" };
  }
  if (payload.requerValidade && !payload.dataValidade) {
    return { ok: false, error: "Informe a data de validade" };
  }

  return enviarDocumentoChecklist({
    clienteId: payload.clienteId,
    tipoCertidaoId: payload.tipoId,
    arquivo: payload.arquivo,
    dataValidade: payload.dataValidade,
    codigo: payload.codigo,
  });
}

export function buildEmpresaCardFromCertidoes(
  data: CertidoesStatusResponse,
  extra?: { cidade?: string; uf?: string; telefone?: string; email?: string; responsavel?: string },
) {
  const c = data.cliente;
  if (!c) return null;
  return {
    clienteId: c.id,
    nome: c.razaoSocial,
    cnpj: formatCnpj(c.documento),
    cidade: extra?.cidade || "",
    uf: extra?.uf || "",
    telefone: extra?.telefone || "",
    email: extra?.email || "",
    responsavel: extra?.responsavel || "",
  };
}

export type HistoricoMonitorItem = {
  quando: string;
  acao: string;
  detalhe: string;
  tone: "ok" | "warn" | "danger";
};

export function buildHistoricoMonitor(items: CertidaoUi[]): HistoricoMonitorItem[] {
  const eventos: HistoricoMonitorItem[] = [];

  for (const c of items) {
    if (c.status === "danger" && c.diasRestantes < 0) {
      eventos.push({
        quando: "Monitoramento",
        acao: `${c.nome} — atenção necessária`,
        detalhe: c.validade,
        tone: "danger",
      });
    } else if (c.status === "warn") {
      eventos.push({
        quando: "Alerta",
        acao: `${c.nome} vence em breve`,
        detalhe: c.diasRestantes > 0 ? `${c.diasRestantes} dias restantes` : c.validade,
        tone: "warn",
      });
    } else if (c.status === "ok" && c.arquivoUrl) {
      eventos.push({
        quando: "Em dia",
        acao: `${c.nome} válida`,
        detalhe: `Validade: ${c.validade}`,
        tone: "ok",
      });
    }
  }

  if (!eventos.length) {
    eventos.push({
      quando: "Agora",
      acao: "Monitoramento ativo",
      detalhe: `${items.length} certidões fiscais acompanhadas`,
      tone: "ok",
    });
  }

  return eventos.slice(0, 6);
}
