import { apiFetch } from "@/lib/api-fetch";
import type { ContractData } from "@/lib/contract-template";

export type ContratoDigital = {
  id: number;
  clienteId: number;
  plano: string;
  dataInicio: string;
  dataVencimento: string;
  status: string;
  assinadoEm?: string | null;
  assinadoPor?: string | null;
  valorMensal?: number | null;
  vigenciaMeses?: number | null;
  emailSignatario?: string | null;
  razaoSocial?: string;
  documento?: string;
  tipoDocumento?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  responsavelNome?: string;
};

function toInputDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function formatContratoDataBr(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("pt-BR");
}

export async function fetchClienteContrato(clienteId: number): Promise<{
  ok: boolean;
  contrato?: ContratoDigital | null;
  error?: string;
}> {
  const res = await apiFetch(`/api/clients/${clienteId}/contrato`);
  const data = (await res.json()) as {
    ok: boolean;
    contrato?: ContratoDigital | null;
    error?: string;
  };
  return data;
}

export function contratoToContractData(contrato: ContratoDigital): ContractData {
  const assinado = contrato.status === "Assinado";
  const dataInicio = toInputDate(contrato.dataInicio);
  const dataAssinatura = toInputDate(contrato.assinadoEm) || dataInicio;

  return {
    razao_social: contrato.razaoSocial || "—",
    documento: contrato.documento || "—",
    tipo_documento: contrato.tipoDocumento || "CNPJ",
    email: contrato.emailSignatario || contrato.email || "",
    telefone: contrato.telefone || "",
    cidade: contrato.cidade || "",
    estado: contrato.estado || "",
    plano: contrato.plano || "Licença + Manutenção",
    data_inicio: dataInicio,
    data_vencimento: toInputDate(contrato.dataVencimento),
    status: contrato.status,
    assinado_por: assinado ? contrato.assinadoPor || contrato.responsavelNome || null : null,
    assinado_em: assinado ? dataAssinatura : null,
    data_documento: dataAssinatura || dataInicio,
  };
}

export function isContratoAssinado(contrato?: ContratoDigital | null): boolean {
  return String(contrato?.status || "").toLowerCase() === "assinado";
}
