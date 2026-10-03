import { apiFetch } from "@/lib/api-fetch";
import { uploadStorageFile } from "@/lib/storage-api";

export type AssessoriaPortal = "caufesp" | "bll";

export type AssessoriaStatus =
  | "aguardando_pagamento"
  | "documentacao"
  | "conferencia_cadbrasil"
  | "pendencia_documentos"
  | "protocolado"
  | "analise_governo"
  | "exigencia_governo"
  | "aprovado"
  | "indeferido";

export type AssessoriaDocumento = {
  codigo: string;
  grupo: string;
  nome: string;
  descricao: string;
  obrigatorio: boolean;
  condicional: boolean;
  pedeValidade: boolean;
  enviado: {
    arquivoUrl: string;
    arquivoNome: string | null;
    dataValidade: string | null;
    status: "enviado" | "aprovado" | "recusado";
    observacao: string | null;
    enviadoEm: string | null;
  } | null;
};

export type AssessoriaPagamento = {
  id: number;
  tipo: "boleto" | "pix";
  status: "aguardando" | "gerado" | "pago";
  valor: number;
  vencimento: string | null;
  protocolo: string;
  barcode: string;
  link: string;
  pdf: string;
  txid: string;
  qrcodeText: string;
  qrcodeImage: string;
  criadoEm?: string | null;
};

export type TermoStatus =
  | "aguardando_modelo"
  | "aguardando_assinatura"
  | "assinado"
  | "aprovado"
  | "recusado";

/** Termo gerado pelo portal (Termo de Adesão da BLL) que o cliente devolve assinado. */
export type AssessoriaTermo = {
  nome: string;
  status: TermoStatus;
  modeloUrl: string | null;
  modeloNome: string | null;
  disponibilizadoEm: string | null;
  assinadoUrl: string | null;
  assinadoNome: string | null;
  assinadoEm: string | null;
  observacao: string | null;
  podeEnviarAssinado: boolean;
};

export type AssessoriaPainel = {
  termo: AssessoriaTermo | null;
  processo: {
    id: number;
    status: AssessoriaStatus;
    /** Escolha do cliente (atividade no CAUFESP, plano na BLL). */
    atividade: string | null;
    valor: number;
    pago: boolean;
    dataPagamento: string | null;
    observacaoCliente: string | null;
    observacaoCadbrasil: string | null;
    protocoloPortal: string | null;
    cadastroValidade: string | null;
    enviadoAnaliseEm: string | null;
    editavel: boolean;
  };
  pagamento: AssessoriaPagamento | null;
  documentos: AssessoriaDocumento[];
  resumo: {
    obrigatoriosTotal: number;
    obrigatoriosEnviados: number;
    podeEnviarAnalise: boolean;
  };
};

type Resp<T> = ({ ok: true } & T) | { ok: false; error: string };

async function parse<T>(res: Response): Promise<Resp<T>> {
  const data = await res
    .json()
    .catch(() => ({ ok: false, error: "Resposta inválida do servidor" }));
  if (!data.ok) return { ok: false, error: data.error || "Erro no processo" };
  return data as Resp<T>;
}

function base(portal: AssessoriaPortal, clienteId: number) {
  return `/api/assessoria/${portal}/${clienteId}`;
}

function acao(portal: AssessoriaPortal, clienteId: number, body: Record<string, unknown>) {
  return apiFetch(base(portal, clienteId), { method: "POST", body: JSON.stringify(body) }).then(
    (r) => parse<AssessoriaPainel>(r),
  );
}

export async function fetchAssessoriaPainel(portal: AssessoriaPortal, clienteId: number) {
  return parse<AssessoriaPainel>(await apiFetch(base(portal, clienteId)));
}

export async function gerarCobrancaAssessoria(
  portal: AssessoriaPortal,
  clienteId: number,
  formaPagamento: "boleto" | "pix",
) {
  return parse<{ pagamento: AssessoriaPagamento; reutilizado?: boolean }>(
    await apiFetch(base(portal, clienteId), {
      method: "POST",
      body: JSON.stringify({ acao: "cobranca", formaPagamento }),
    }),
  );
}

export function definirEscolhaAssessoria(
  portal: AssessoriaPortal,
  clienteId: number,
  atividade: string,
) {
  return acao(portal, clienteId, { acao: "atividade", atividade });
}

export async function enviarTermoAssinado(payload: {
  portal: AssessoriaPortal;
  clienteId: number;
  arquivo: File;
}) {
  const upload = await uploadStorageFile(
    payload.arquivo,
    `clientes/${payload.clienteId}/${payload.portal}`,
  );
  if (!upload.ok || !(upload.fullUrl || upload.url)) {
    return { ok: false as const, error: upload.error || "Falha no upload do arquivo" };
  }
  return acao(payload.portal, payload.clienteId, {
    acao: "termo_assinado",
    arquivoUrl: upload.fullUrl || upload.url,
    arquivoNome: upload.originalName || payload.arquivo.name,
  });
}

export async function enviarDocumentoAssessoria(payload: {
  portal: AssessoriaPortal;
  clienteId: number;
  codigo: string;
  arquivo: File;
  dataValidade?: string;
}) {
  const upload = await uploadStorageFile(
    payload.arquivo,
    `clientes/${payload.clienteId}/${payload.portal}`,
  );
  if (!upload.ok || !(upload.fullUrl || upload.url)) {
    return { ok: false as const, error: upload.error || "Falha no upload do arquivo" };
  }
  return acao(payload.portal, payload.clienteId, {
    acao: "documento",
    codigo: payload.codigo,
    arquivoUrl: upload.fullUrl || upload.url,
    arquivoNome: upload.originalName || payload.arquivo.name,
    dataValidade: payload.dataValidade || null,
  });
}

export function removerDocumentoAssessoria(
  portal: AssessoriaPortal,
  clienteId: number,
  codigo: string,
) {
  return acao(portal, clienteId, { acao: "remover_documento", codigo });
}

export function enviarAnaliseAssessoria(
  portal: AssessoriaPortal,
  clienteId: number,
  observacao?: string,
) {
  return acao(portal, clienteId, { acao: "enviar_analise", observacao });
}
