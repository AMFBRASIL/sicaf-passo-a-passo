/**
 * Cliente NFS-e Nacional — reutilizável em qualquer tela do portal/admin.
 *
 * Exemplos:
 *   await getNfseStatus()
 *   await emitirNfseCliente(clienteId, { dps: {...} })
 *   await consultarNfseCliente(clienteId, { chaveAcesso })
 *   await emitirNfseAdmin({ dps: {...}, useSystemCert: true })
 */
import { apiFetch } from "@/lib/api-fetch";

export type NfseStatusConfig = {
  ok: boolean;
  enabled?: boolean;
  ambiente?: "producao" | "producaorestrita" | string;
  urls?: {
    sefin?: string;
    adnContribuintes?: string;
    danfse?: string;
    swaggerSefin?: string;
  };
  certificadoSistemaConfigurado?: boolean;
  error?: string;
};

export type NfseDpsPayload = {
  cMun?: string;
  codigoMunicipio?: string;
  serie?: string | number;
  nDPS?: string | number;
  numero?: string | number;
  dhEmi?: string;
  dCompet?: string;
  cnpjPrestador?: string;
  cpfPrestador?: string;
  imPrestador?: string;
  prestador?: {
    cnpj?: string;
    cpf?: string;
    im?: string;
  };
  tomador?: {
    cnpj?: string;
    cpf?: string;
    xNome?: string;
    nome?: string;
    email?: string;
  };
  servico?: {
    cTribNac?: string;
    codigoTributacaoNacional?: string;
    cTribMun?: string;
    codigoTributacaoMunicipal?: string;
    cNBS?: string;
    cLocPrestacao?: string;
    cMun?: string;
    xDescServ?: string;
    descricao?: string;
    valores?: Record<string, number | string>;
  };
  valores?: {
    vServPrest?: number;
    valorServico?: number;
    vBC?: number;
    baseCalculo?: number;
    pAliq?: number;
    aliquota?: number;
    vISSQN?: number;
    valorIss?: number;
    tpRetISSQN?: string | number;
    tipoRetencaoIss?: string | number;
    vLiq?: number;
    valorLiquido?: number;
  };
  [key: string]: unknown;
};

export type NfseEmitirInput = {
  dps?: NfseDpsPayload;
  dpsXml?: string;
  xml?: string;
  jaAssinado?: boolean;
  useSystemCert?: boolean;
  senhaCertificado?: string;
  pagamentoId?: number;
};

export type NfseEmitirResult = {
  ok: boolean;
  error?: string;
  message?: string;
  chaveAcesso?: string | null;
  nfseXml?: string | null;
  emissaoId?: number | null;
  ambiente?: string;
  resposta?: unknown;
  [key: string]: unknown;
};

export type NfseEmissao = {
  id: number;
  clienteId: number | null;
  ambiente: string;
  status: string;
  chaveAcesso: string | null;
  idDps: string | null;
  serie: string | null;
  numeroDps: string | null;
  valor: number | null;
  tomadorDoc: string | null;
  tomadorNome: string | null;
  descricao: string | null;
  pagamentoId: number | null;
  erro: string | null;
  createdAt: string | null;
};

export async function getNfseStatus() {
  const res = await apiFetch("/api/nfse/status");
  return res.json() as Promise<NfseStatusConfig>;
}

export async function listarNfseCliente(clienteId: number, opts?: { limit?: number; status?: string }) {
  const qs = new URLSearchParams();
  if (opts?.limit) qs.set("limit", String(opts.limit));
  if (opts?.status) qs.set("status", opts.status);
  const q = qs.toString();
  const res = await apiFetch(`/api/clients/${clienteId}/nfse${q ? `?${q}` : ""}`);
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    total?: number;
    emissoes?: NfseEmissao[];
  }>;
}

export async function emitirNfseCliente(clienteId: number, input: NfseEmitirInput) {
  const res = await apiFetch(`/api/clients/${clienteId}/nfse`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.json() as Promise<NfseEmitirResult>;
}

export async function consultarNfseCliente(
  clienteId: number,
  opts: { chaveAcesso?: string; idDps?: string; useSystemCert?: boolean },
) {
  const res = await apiFetch(`/api/clients/${clienteId}/nfse/consultar`, {
    method: "POST",
    body: JSON.stringify(opts),
  });
  return res.json() as Promise<NfseEmitirResult>;
}

export async function listarNfseAdmin(opts?: { clienteId?: number; limit?: number; status?: string }) {
  const qs = new URLSearchParams();
  if (opts?.clienteId) qs.set("clienteId", String(opts.clienteId));
  if (opts?.limit) qs.set("limit", String(opts.limit));
  if (opts?.status) qs.set("status", opts.status);
  const q = qs.toString();
  const res = await apiFetch(`/api/admin/nfse${q ? `?${q}` : ""}`);
  return res.json() as Promise<NfseStatusConfig & {
    ok?: boolean;
    error?: string;
    total?: number;
    emissoes?: NfseEmissao[];
  }>;
}

/** Emite com certificado do sistema por padrão (CadBrasil prestador). */
export async function emitirNfseAdmin(input: NfseEmitirInput & { clienteId?: number }) {
  const res = await apiFetch("/api/admin/nfse", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      useSystemCert: input.useSystemCert !== false,
    }),
  });
  return res.json() as Promise<NfseEmitirResult>;
}

export type NfseFiscalItem = {
  key: string;
  tipo: string;
  tipoLabel: string;
  origemId: number;
  pagamentoId?: number | null;
  descricao: string;
  valor: number;
  dataPagamento?: string | null;
  dataVencimento?: string | null;
  formaPagamento?: string | null;
  statusFinanceiro: string;
  podeEmitir?: boolean;
  podeCancelar?: boolean;
  nfse?: {
    id: number;
    status: string;
    chaveAcesso?: string | null;
    xmlUrl?: string | null;
    pdfUrl?: string | null;
    emailEnviadoEm?: string | null;
    erro?: string | null;
    ambiente?: string | null;
    createdAt?: string | null;
  } | null;
};

export async function listarFiscalCliente(clienteId: number) {
  const res = await apiFetch(`/api/clients/${clienteId}/nfse/fiscal`);
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    totalPagos?: number;
    totalComNfse?: number;
    totalPendentes?: number;
    itens?: NfseFiscalItem[];
    prestador?: { cnpj?: string; ambiente?: string };
  }>;
}

export async function emitirFiscalCliente(
  clienteId: number,
  input: { key?: string; pagamentoId?: number; origem?: string; origemId?: number },
) {
  const res = await apiFetch(`/api/clients/${clienteId}/nfse/fiscal`, {
    method: "POST",
    body: JSON.stringify({ ...input, acao: "emitir" }),
  });
  return res.json() as Promise<
    NfseEmitirResult & {
      alreadyIssued?: boolean;
      xmlUrl?: string | null;
      pdfUrl?: string | null;
      email?: { ok?: boolean; error?: string };
    }
  >;
}

export async function cancelarFiscalCliente(
  clienteId: number,
  input: { emissaoId: number; motivo?: string; cMotivo?: string },
) {
  const res = await apiFetch(`/api/clients/${clienteId}/nfse/fiscal`, {
    method: "POST",
    body: JSON.stringify({ ...input, acao: "cancelar" }),
  });
  return res.json() as Promise<
    NfseEmitirResult & {
      alreadyCancelled?: boolean;
      status?: string;
      emissaoId?: number;
    }
  >;
}

export function arquivoNfseUrl(clienteId: number, emissaoId: number, tipo: "pdf" | "xml" = "pdf") {
  return `/api/clients/${clienteId}/nfse/emissoes/${emissaoId}/arquivo?tipo=${tipo}`;
}
