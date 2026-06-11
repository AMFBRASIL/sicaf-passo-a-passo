import { apiFetch } from "@/lib/api-fetch";

export type AvisoTemplateItem = {
  id: number;
  codigo: string | null;
  nome: string;
  assunto: string;
  descricao: string;
  variaveisDisponiveis: string[];
};

export type AvisoPreview = {
  assunto: string;
  html: string;
  vars: Record<string, string>;
};

export async function fetchAvisoTemplates(): Promise<AvisoTemplateItem[]> {
  const res = await apiFetch("/api/admin/email/templates");
  const data = (await res.json()) as { ok: boolean; templates?: AvisoTemplateItem[]; error?: string };
  if (!data.ok) {
    throw new Error(data.error || "Erro ao carregar templates");
  }
  return data.templates ?? [];
}

export async function previewAvisoEmail(
  clienteId: number,
  payload: {
    templateDbId: number;
    mensagemAdicional?: string;
    assuntoCustom?: string;
  },
): Promise<{
  preview: AvisoPreview;
  destinatarioPadrao?: string | null;
  template?: { id: number; nome: string; variaveisDisponiveis: string[] };
}> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/avisos-email`, {
    method: "POST",
    body: JSON.stringify({ action: "preview", ...payload }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    preview?: AvisoPreview;
    destinatarioPadrao?: string | null;
    template?: { id: number; nome: string; variaveisDisponiveis: string[] };
    error?: string;
  };
  if (!data.ok || !data.preview) {
    throw new Error(data.error || "Não foi possível gerar a pré-visualização");
  }
  return {
    preview: data.preview,
    destinatarioPadrao: data.destinatarioPadrao,
    template: data.template,
  };
}

export async function enviarAvisoEmail(
  clienteId: number,
  payload: {
    templateDbId: number;
    to: string;
    cc?: string;
    mensagemAdicional?: string;
    assuntoCustom?: string;
  },
): Promise<{ message: string; simulado?: boolean }> {
  const res = await apiFetch(`/api/admin/clients/${clienteId}/avisos-email`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    ok: boolean;
    message?: string;
    simulado?: boolean;
    error?: string;
  };
  if (!data.ok) {
    throw new Error(data.error || "Falha ao enviar e-mail");
  }
  return { message: data.message || "E-mail enviado", simulado: data.simulado };
}
