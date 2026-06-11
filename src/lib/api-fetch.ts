import { apiUrl } from "@/lib/api-config";
import { readAuthToken } from "@/lib/auth-cookie";

type FetchOptions = RequestInit & {
  auth?: boolean;
  /** Quando true, 404 não é tratado como falha (retorna a Response normalmente). */
  allowNotFound?: boolean;
};

export async function apiFetch(input: string, options: FetchOptions = {}) {
  const { auth = true, allowNotFound = false, headers, ...rest } = options;
  const h = new Headers(headers);

  if (auth) {
    const token = readAuthToken();
    if (token) h.set("Authorization", `Bearer ${token}`);
  }

  if (!h.has("Content-Type") && rest.body && typeof rest.body === "string") {
    h.set("Content-Type", "application/json");
  }

  const url = input.startsWith("http") ? input : apiUrl(input);
  const res = await fetch(url, { ...rest, headers: h });
  if (allowNotFound && res.status === 404) {
    return res;
  }
  return res;
}

/** Verifica cliente por CNPJ sem gerar 404 no console (usa ?soft=1). */
export async function fetchClientByDocumento(doc: string) {
  const digits = doc.replace(/\D/g, "");
  if (!digits) return { ok: false as const, found: false, error: "CNPJ inválido" };

  const res = await apiFetch(
    `/api/clients/by-documento/${encodeURIComponent(digits)}?soft=1`,
    { allowNotFound: true },
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    client?: unknown;
    cliente?: unknown;
  };

  return {
    ok: !!data.ok,
    found: !!data.ok && !!(data.client || data.cliente),
    error: data.error,
    client: data.client || data.cliente,
  };
}
