import { apiFetch } from "@/lib/api-fetch";
import { uploadStorageFile } from "@/lib/storage-api";
import type { EmpresaData } from "@/lib/empresas-shared";
import { RefreshCw } from "lucide-react";

export type DocChecklistItem = {
  id: string;
  tipoCertidaoId: number;
  codigo: string;
  nome: string;
  descricao: string;
  nivelSicaf?: string | null;
  orgaoEmissor?: string | null;
  status: "ok" | "pendente" | "vencida" | "vencendo";
  validade?: string;
  dataValidade?: string | null;
  codigoCertidao?: string | null;
  arquivoUrl?: string | null;
  requerValidade?: boolean;
  requerCodigo?: boolean;
  uploadManual?: boolean;
};

export type DocumentosChecklist = {
  ok: boolean;
  cliente?: {
    id: number;
    razaoSocial: string;
    documento: string;
    email?: string;
    telefone?: string;
    endereco?: string;
    cidade?: string;
    estado?: string;
    inscricaoEstadual?: string;
    inscricaoMunicipal?: string;
    ramoAtividade?: string;
  };
  sicafStatus?: string;
  docsPorNivel?: Record<number, DocChecklistItem[]>;
  error?: string;
};

export async function fetchDocumentosChecklist(clienteId: number): Promise<DocumentosChecklist> {
  const res = await apiFetch(`/api/clients/${clienteId}/documentos-checklist`);
  const data = await res.json();
  return data as DocumentosChecklist;
}

type ClienteByDocApi = {
  id: number;
  name?: string;
  razao_social?: string;
  razaoSocial?: string;
  nome_fantasia?: string;
  nomeFantasia?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  uf?: string;
  responsavel?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  ramoAtividade?: string;
  sicafStatus?: string;
  sicaf_status?: string;
};

export async function resolveEmpresaPorCnpj(cnpj: string): Promise<{
  ok: boolean;
  empresa?: EmpresaData;
  error?: string;
}> {
  const doc = cnpj.replace(/\D/g, "");
  if (!doc) {
    return { ok: false, error: "CNPJ não informado" };
  }

  const res = await apiFetch(`/api/clients/by-documento/${encodeURIComponent(doc)}`);
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    client?: ClienteByDocApi;
    cliente?: ClienteByDocApi;
  };

  const c = data.client || data.cliente;
  if (!data.ok || !c?.id) {
    return { ok: false, error: data.error || "Empresa não encontrada" };
  }

  const sicafRaw = String(c.sicafStatus || c.sicaf_status || "").toLowerCase();
  const sicaf: EmpresaData["sicaf"] =
    sicafRaw === "ativo"
      ? "ativo"
      : sicafRaw === "vencendo"
        ? "atencao"
        : sicafRaw === "vencido"
          ? "vencido"
          : "sem_cadastro";

  const empresa: EmpresaData = {
    clienteId: c.id,
    nome: c.razaoSocial || c.razao_social || c.nomeFantasia || c.nome_fantasia || c.name || "",
    cnpj: c.documento || cnpj,
    sicaf,
    proximoPasso: "Envie os documentos por nível do SICAF.",
    acao: { label: "Ver", icon: RefreshCw },
    endereco: c.endereco || "",
    cidade: c.cidade || "",
    uf: c.estado || c.uf || "",
    telefone: c.telefone || c.celular || "",
    email: c.email || "",
    responsavel: c.responsavel || "",
    inscricaoEstadual: c.inscricaoEstadual || "",
    inscricaoMunicipal: c.inscricaoMunicipal || "",
    ramoAtividade: c.ramoAtividade || "",
  };
  return { ok: true, empresa };
}

export async function uploadDocumentoEmpresa(payload: {
  clienteId: number;
  arquivo: File;
  nome: string;
  pasta?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const formData = new FormData();
  formData.append("file", payload.arquivo);
  formData.append("clienteId", String(payload.clienteId));
  formData.append("nome", payload.nome);
  formData.append("pasta", payload.pasta || "Documentação SICAF");

  const res = await apiFetch("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao enviar documento" };
  }
  return { ok: true, message: "Documento enviado" };
}

export async function enviarDocumentoChecklist(payload: {
  clienteId: number;
  tipoCertidaoId: number;
  arquivo: File;
  dataValidade?: string;
  codigo?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const folder = `clientes/${payload.clienteId}/certidoes`;
  const upload = await uploadStorageFile(payload.arquivo, folder);
  if (!upload.ok || !upload.fullUrl) {
    return { ok: false, error: upload.error || "Falha no upload" };
  }

  const res = await apiFetch(`/api/clients/${payload.clienteId}/certidoes`, {
    method: "POST",
    body: JSON.stringify({
      tipoCertidaoId: payload.tipoCertidaoId,
      numero: payload.codigo || null,
      dataEmissao: new Date().toISOString().slice(0, 10),
      dataValidade: payload.dataValidade || null,
      arquivoUrl: upload.fullUrl || upload.url,
      arquivoNome: upload.originalName || payload.arquivo.name,
      arquivoTamanho: upload.size ? `${upload.size} bytes` : null,
    }),
  });
  const data = await res.json();
  if (!data.ok) return { ok: false, error: data.error || "Erro ao salvar documento" };
  return { ok: true, message: data.message };
}
