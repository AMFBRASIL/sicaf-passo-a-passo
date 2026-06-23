import { apiFetch } from "@/lib/api-fetch";

export const EMAIL_SECRET_MASK = "__UNCHANGED__";

export type EmailSettings = {
  smtp_metodo: string;
  smtp_provider: string;
  smtp_host: string;
  smtp_porta: string;
  smtp_usuario: string;
  smtp_senha: string;
  smtp_tls: string;
  smtp_api_key: string;
  smtp_secret_key: string;
  smtp_email_remetente: string;
  smtp_nome_remetente: string;
};

export type EmailTemplateAdmin = {
  id: number;
  codigo: string | null;
  nome: string;
  assunto: string;
  corpoHtml: string;
  variaveisDisponiveis: unknown;
  ativo: boolean;
};

export type EmailSettingsStatus = {
  configured: boolean;
  apiKeySource: "database" | "env" | "database_invalid" | "none" | "n/a";
  metodo: string;
  provider: string;
  fromEmail: string;
};

const EMPTY_EMAIL: EmailSettings = {
  smtp_metodo: "api",
  smtp_provider: "mailgun",
  smtp_host: "",
  smtp_porta: "587",
  smtp_usuario: "",
  smtp_senha: "",
  smtp_tls: "true",
  smtp_api_key: "",
  smtp_secret_key: "",
  smtp_email_remetente: "",
  smtp_nome_remetente: "CadBrasil",
};

function mergeEmailSettings(partial: Partial<EmailSettings>): EmailSettings {
  const out = { ...EMPTY_EMAIL };
  for (const key of Object.keys(EMPTY_EMAIL) as (keyof EmailSettings)[]) {
    const value = partial[key];
    if (value != null && String(value).trim() !== "") {
      out[key] = value;
    }
  }
  return out;
}

export async function fetchEmailSettings(): Promise<{
  settings: EmailSettings;
  templateCount: number;
  status: EmailSettingsStatus;
}> {
  const res = await apiFetch("/api/admin/settings/email");
  const data = (await res.json()) as {
    ok: boolean;
    settings?: Partial<EmailSettings>;
    templateCount?: number;
    status?: EmailSettingsStatus;
    error?: string;
  };
  if (!data.ok) throw new Error(data.error || "Erro ao carregar configurações de e-mail");
  return {
    settings: mergeEmailSettings(data.settings || {}),
    templateCount: data.templateCount ?? 0,
    status: data.status || {
      configured: false,
      apiKeySource: "none",
      metodo: "api",
      provider: "mailgun",
      fromEmail: "",
    },
  };
}

export async function saveEmailSettings(settings: EmailSettings): Promise<string> {
  const res = await apiFetch("/api/admin/settings/email", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
  const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
  if (!data.ok) throw new Error(data.error || "Erro ao salvar configurações");
  return data.message || "Configurações salvas";
}

export function emailSettingsForApi(settings: EmailSettings): Partial<EmailSettings> {
  const out: Partial<EmailSettings> = { ...settings };
  for (const key of ["smtp_senha", "smtp_api_key", "smtp_secret_key"] as const) {
    if (!out[key] || out[key] === EMAIL_SECRET_MASK) delete out[key];
  }
  return out;
}

export async function testEmailSettings(to: string, settings?: EmailSettings): Promise<string> {
  const payload: { to: string; settings?: Partial<EmailSettings> } = { to };
  if (settings) payload.settings = emailSettingsForApi(settings);

  const res = await apiFetch("/api/admin/settings/email/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
  if (!data.ok) throw new Error(data.error || "Falha no teste de e-mail");
  return data.message || "E-mail de teste enviado";
}

export async function fetchEmailTemplatesAdmin(): Promise<EmailTemplateAdmin[]> {
  const res = await apiFetch("/api/admin/settings/email/templates");
  const data = (await res.json()) as {
    ok: boolean;
    templates?: EmailTemplateAdmin[];
    error?: string;
  };
  if (!data.ok) throw new Error(data.error || "Erro ao listar templates");
  return data.templates ?? [];
}

export type IaSettings = {
  ia_provedor: string;
  ia_modelo: string;
  ia_api_key: string;
  ia_max_tokens: string;
  ia_temperatura: string;
  ia_prompt_sistema: string;
  ia_limite_requisicoes_dia: string;
  ia_limite_por_cliente: string;
  ia_bloquear_orcamento: string;
  ia_orcamento_mensal_max: string;
};

export type IaSettingsStatus = {
  configured: boolean;
  apiKeySource: "database" | "env" | "none";
  provider: string;
  model: string;
};

const EMPTY_IA: IaSettings = {
  ia_provedor: "openai",
  ia_modelo: "gpt-4o",
  ia_api_key: "",
  ia_max_tokens: "4096",
  ia_temperatura: "0.4",
  ia_prompt_sistema: "",
  ia_limite_requisicoes_dia: "200",
  ia_limite_por_cliente: "true",
  ia_bloquear_orcamento: "false",
  ia_orcamento_mensal_max: "500",
};

export async function fetchIaSettings(): Promise<{
  settings: IaSettings;
  status: IaSettingsStatus;
}> {
  const res = await apiFetch("/api/admin/settings/ia");
  const data = (await res.json()) as {
    ok: boolean;
    settings?: Partial<IaSettings>;
    status?: IaSettingsStatus;
    error?: string;
  };
  if (!data.ok) throw new Error(data.error || "Erro ao carregar configurações de IA");
  return {
    settings: { ...EMPTY_IA, ...(data.settings || {}) },
    status: data.status || {
      configured: false,
      apiKeySource: "none",
      provider: "openai",
      model: "gpt-4o",
    },
  };
}

export async function saveIaSettings(settings: IaSettings): Promise<string> {
  const res = await apiFetch("/api/admin/settings/ia", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
  const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
  if (!data.ok) throw new Error(data.error || "Erro ao salvar configurações de IA");
  return data.message || "Configurações de IA salvas";
}

export async function testIaSettings(): Promise<{ message: string; resposta?: string; model?: string }> {
  const res = await apiFetch("/api/admin/settings/ia/test", { method: "POST" });
  const data = (await res.json()) as {
    ok: boolean;
    message?: string;
    resposta?: string;
    model?: string;
    error?: string;
  };
  if (!data.ok) throw new Error(data.error || "Falha no teste de IA");
  return {
    message: data.message || "IA respondeu com sucesso",
    resposta: data.resposta,
    model: data.model,
  };
}

export type StorageSettings = {
  storage_provedor: string;
  storage_local_path: string;
  storage_local_base_url: string;
  storage_s3_bucket: string;
  storage_s3_region: string;
  storage_s3_access_key_id: string;
  storage_s3_secret_access_key: string;
  storage_s3_endpoint: string;
  storage_s3_use_path_style: string;
  storage_cdn_url: string;
  storage_max_file_size_mb: string;
  storage_allowed_extensions: string;
  storage_retencao_meses: string;
  storage_versoes_por_arquivo: string;
  storage_versionamento_ativo: string;
  storage_mover_frio: string;
  storage_frio_dias: string;
  storage_excluir_apos_retencao: string;
  storage_quota_gb: string;
};

export type StorageSettingsStatus = {
  configured: boolean;
  configSource: "database" | "env" | string;
  provider: string;
  usage?: {
    usedGb: number;
    quotaGb: number;
    percentUsed: number;
    objects?: number;
  };
};

const EMPTY_STORAGE: StorageSettings = {
  storage_provedor: "lovable_cloud",
  storage_local_path: "uploads",
  storage_local_base_url: "/uploads",
  storage_s3_bucket: "",
  storage_s3_region: "us-east-1",
  storage_s3_access_key_id: "",
  storage_s3_secret_access_key: "",
  storage_s3_endpoint: "",
  storage_s3_use_path_style: "false",
  storage_cdn_url: "",
  storage_max_file_size_mb: "10",
  storage_allowed_extensions: "jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv,zip,rar,xml",
  storage_retencao_meses: "60",
  storage_versoes_por_arquivo: "5",
  storage_versionamento_ativo: "true",
  storage_mover_frio: "false",
  storage_frio_dias: "180",
  storage_excluir_apos_retencao: "false",
  storage_quota_gb: "500",
};

export async function fetchStorageSettings(): Promise<{
  settings: StorageSettings;
  status: StorageSettingsStatus;
}> {
  const res = await apiFetch("/api/admin/settings/storage");
  const data = (await res.json()) as {
    ok: boolean;
    settings?: Partial<StorageSettings>;
    status?: StorageSettingsStatus;
    error?: string;
  };
  if (!data.ok) throw new Error(data.error || "Erro ao carregar configurações de armazenamento");
  return {
    settings: { ...EMPTY_STORAGE, ...(data.settings || {}) },
    status: data.status || {
      configured: false,
      configSource: "env",
      provider: "lovable_cloud",
    },
  };
}

export async function saveStorageSettings(settings: StorageSettings): Promise<string> {
  const res = await apiFetch("/api/admin/settings/storage", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
  const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
  if (!data.ok) throw new Error(data.error || "Erro ao salvar armazenamento");
  return data.message || "Configurações de armazenamento salvas";
}

export async function testStorageSettings(): Promise<string> {
  const res = await apiFetch("/api/admin/settings/storage/test", { method: "POST" });
  let data: { ok: boolean; message?: string; error?: string };
  try {
    data = (await res.json()) as { ok: boolean; message?: string; error?: string };
  } catch {
    throw new Error(res.status === 401 ? "Sessão expirada — faça login novamente" : `Falha no teste (HTTP ${res.status})`);
  }
  if (!data.ok) throw new Error(data.error || data.message || "Falha no teste de armazenamento");
  return data.message || "Conexão OK";
}

export async function updateEmailTemplateAdmin(
  id: number,
  payload: Partial<Pick<EmailTemplateAdmin, "nome" | "assunto" | "corpoHtml" | "ativo">>,
): Promise<string> {
  const res = await apiFetch(`/api/admin/settings/email/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
  if (!data.ok) throw new Error(data.error || "Erro ao atualizar template");
  return data.message || "Template atualizado";
}

export type SicafSettings = {
  niveisObrigatorios: boolean[];
  avisoAntecedenciaDias: number;
  lembreteReenvioDias: number;
  centralAlertaCertidoesDias: number;
  ticketAutomatico: boolean;
  notificarEmailWhatsapp: boolean;
  bloquearRelatorioVencido: boolean;
};

export type SicafSettingsStatus = {
  niveisAtivos: number;
  centralAlertaDias: number;
  avisoAntecedenciaDias: number;
};

export async function fetchSicafSettings(): Promise<{
  settings: SicafSettings;
  status: SicafSettingsStatus;
}> {
  const res = await apiFetch("/api/admin/settings/sicaf");
  const data = (await res.json()) as {
    ok: boolean;
    settings?: SicafSettings;
    status?: SicafSettingsStatus;
    error?: string;
  };
  if (!data.ok || !data.settings) throw new Error(data.error || "Erro ao carregar configurações SICAF");
  return {
    settings: data.settings,
    status: data.status || {
      niveisAtivos: data.settings.niveisObrigatorios.filter(Boolean).length,
      centralAlertaDias: data.settings.centralAlertaCertidoesDias,
      avisoAntecedenciaDias: data.settings.avisoAntecedenciaDias,
    },
  };
}

export async function saveSicafSettings(settings: SicafSettings): Promise<string> {
  const res = await apiFetch("/api/admin/settings/sicaf", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
  const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
  if (!data.ok) throw new Error(data.error || "Erro ao salvar configurações SICAF");
  return data.message || "Configurações SICAF salvas";
}
