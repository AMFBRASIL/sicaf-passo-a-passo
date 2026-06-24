import { apiFetch } from "@/lib/api-fetch";

export type PerfilAcesso = {
  id: number;
  nome: string;
  descricao: string;
  tipo: string;
  ativo: boolean;
  membros: number;
  permAtivas?: number;
  permTotal?: number;
  cor: string;
};

export type PermissaoPagina = {
  paginaId: string;
  paginaNome: string;
  categoria: string;
  permitido: boolean;
};

export async function fetchPerfisAcesso(): Promise<{
  ok: boolean;
  error?: string;
  perfis?: PerfilAcesso[];
}> {
  const res = await apiFetch("/api/admin/perfis");
  return (await res.json()) as { ok: boolean; error?: string; perfis?: PerfilAcesso[] };
}

export async function fetchPerfilPermissoes(perfilId: number): Promise<{
  ok: boolean;
  error?: string;
  perfilId?: number;
  permissions?: Record<string, boolean>;
  pages?: PermissaoPagina[];
  orderedCategories?: string[];
}> {
  const res = await apiFetch(`/api/admin/perfis/${perfilId}/permissoes`);
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    perfilId?: number;
    permissions?: Record<string, boolean>;
    pages?: PermissaoPagina[];
    orderedCategories?: string[];
  };
}

export async function savePerfilPermissoes(
  perfilId: number,
  permissions: Record<string, boolean>,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await apiFetch(`/api/admin/perfis/${perfilId}/permissoes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
  return (await res.json()) as { ok: boolean; error?: string; message?: string };
}

export async function createPerfilAcesso(payload: {
  nome: string;
  descricao?: string;
  tipo?: string;
}): Promise<{ ok: boolean; error?: string; message?: string; id?: number }> {
  const res = await apiFetch("/api/admin/perfis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as { ok: boolean; error?: string; message?: string; id?: number };
}

export async function updatePerfilAcesso(
  perfilId: number,
  payload: { nome?: string; descricao?: string },
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await apiFetch(`/api/admin/perfis/${perfilId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as { ok: boolean; error?: string; message?: string };
}

export async function deletePerfilAcesso(
  perfilId: number,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await apiFetch(`/api/admin/perfis/${perfilId}`, { method: "DELETE" });
  return (await res.json()) as { ok: boolean; error?: string; message?: string };
}
