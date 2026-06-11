import { apiFetch } from "@/lib/api-fetch";

export type StorageUploadResult = {
  ok: boolean;
  url?: string;
  fullUrl?: string;
  filename?: string;
  originalName?: string;
  size?: number;
  mimetype?: string;
  error?: string;
};

export type StorageInfo = {
  provider: string;
  maxFileSizeMb: number;
  allowedExtensions: string[];
  s3Bucket?: string;
  s3Region?: string;
  localPath?: string;
  localBaseUrl?: string;
};

/** Upload de arquivo via StorageService (mesma API do legado). */
export async function uploadStorageFile(
  file: File,
  folder = "general",
): Promise<StorageUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch(`/api/storage/upload?folder=${encodeURIComponent(folder)}`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao enviar arquivo" };
  }
  return data as StorageUploadResult;
}

export async function fetchStorageInfo(): Promise<{
  ok: boolean;
  storage?: StorageInfo;
  error?: string;
}> {
  const res = await apiFetch("/api/storage/info");
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao obter storage" };
  }
  return { ok: true, storage: data.storage as StorageInfo };
}

export async function deleteStorageFile(fileUrl: string): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/storage/delete", {
    method: "POST",
    body: JSON.stringify({ fileUrl }),
  });
  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error || "Erro ao deletar arquivo" };
  }
  return { ok: true };
}
