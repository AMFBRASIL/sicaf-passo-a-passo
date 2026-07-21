import { apiFetch } from "@/lib/api-fetch";
import type { CrmAnexo } from "@/components/admin/crm-anexos";
import type { CrmCardData } from "@/components/admin/crm-cliente-detalhe-modal";
import type { CrmCliente, CrmStage } from "@/components/admin/crm-cliente-wizard-modal";

export type { CrmConsultor } from "@/components/admin/crm-cliente-wizard-modal";

export type NovoCrmCardPayload = {
  clienteId: number;
  stage: CrmStage;
  consultorId: string;
  prioridade: string;
  canal: string;
  valor: string;
  boleto: string;
  proximaAcao: string;
  dataAcao: string;
  notas: string;
  tags: string[];
  progressoDocs?: number;
};

async function parseJson<T>(res: Response): Promise<T & { ok: boolean; error?: string }> {
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok) {
    return { ...data, ok: false, error: data.error || `Erro HTTP ${res.status}` };
  }
  return { ...data, ok: data.ok !== false };
}

export async function fetchCrmConsultores() {
  const res = await apiFetch("/api/admin/crm/cards?resource=consultores");
  return parseJson<{ consultores?: CrmConsultor[] }>(res);
}

export async function searchCrmClientes(search = "") {
  const params = new URLSearchParams({ resource: "clientes" });
  if (search.trim()) params.set("search", search.trim());
  const res = await apiFetch(`/api/admin/crm/cards?${params.toString()}`);
  return parseJson<{ clientes?: CrmCliente[] }>(res);
}

export async function fetchCrmCards(search = "", consultorId = "todos") {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (consultorId && consultorId !== "todos") params.set("consultorId", consultorId);
  const res = await apiFetch(`/api/admin/crm/cards?${params.toString()}`);
  return parseJson<{
    cards?: CrmCardData[];
    kpis?: { emFunil: number; pipeline: number; liberado: number; negociacao: number };
  }>(res);
}

export async function fetchCrmCard(id: string) {
  const res = await apiFetch(`/api/admin/crm/cards/${encodeURIComponent(id)}`);
  return parseJson<{ card?: CrmCardData }>(res);
}

export async function criarCrmCard(payload: NovoCrmCardPayload) {
  const res = await apiFetch("/api/admin/crm/cards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJson<{ card?: CrmCardData }>(res);
}

export async function atualizarCrmCard(id: string, payload: Partial<NovoCrmCardPayload> & { progressoDocs?: number }) {
  const res = await apiFetch(`/api/admin/crm/cards/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return parseJson<{ card?: CrmCardData }>(res);
}

export async function uploadCrmAnexo(
  cardId: string,
  file: File,
  tipo: CrmAnexo["tipo"] = "outro",
) {
  const form = new FormData();
  form.append("file", file);
  form.append("tipo", tipo);
  const res = await apiFetch(`/api/admin/crm/cards/${encodeURIComponent(cardId)}/anexos`, {
    method: "POST",
    body: form,
  });
  return parseJson<{ anexo?: CrmAnexo }>(res);
}

export async function dataUrlToFile(dataUrl: string, nome: string, mime: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], nome, { type: mime || blob.type });
}

export async function sincronizarCrmBoletos() {
  const res = await apiFetch("/api/admin/crm/cards", {
    method: "POST",
    body: JSON.stringify({ action: "sincronizar-boletos" }),
  });
  return parseJson<{
    verificados?: number;
    promovidos?: number;
    pendentes?: number;
    message?: string;
    detalhes?: Array<{
      cardId: string;
      cliente: string;
      documento?: string;
      status: string;
      mensagem: string;
    }>;
  }>(res);
}

export async function syncCrmAnexosPendentes(cardId: string, anexos: CrmAnexo[]) {
  const uploaded: CrmAnexo[] = [];
  for (const a of anexos) {
    if (/^\d+$/.test(a.id) && !a.url.startsWith("data:")) {
      uploaded.push(a);
      continue;
    }
    if (!a.url.startsWith("data:")) continue;
    const file = await dataUrlToFile(a.url, a.nome, a.mime);
    const res = await uploadCrmAnexo(cardId, file, a.tipo);
    if (res.ok && res.anexo) uploaded.push(res.anexo);
  }
  return uploaded;
}
