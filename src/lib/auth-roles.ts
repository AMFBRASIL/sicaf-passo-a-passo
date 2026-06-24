import type { AuthUser } from "@/contexts/AuthContext";

const STAFF_PERFIL_TIPOS = new Set([
  "admin",
  "colaborador",
  "gestor",
  "analista",
  "visualizador",
]);

/** Tipos de perfis_acesso que podem acessar o painel /admin. */
export function isStaffPerfilTipo(tipo?: string | null): boolean {
  return STAFF_PERFIL_TIPOS.has(String(tipo || "").toLowerCase());
}

/**
 * Checagem rápida no cliente — NÃO usar sozinha para liberar /admin.
 * Fonte da verdade: usuarios.perfil_id → perfis_acesso.tipo (validado no servidor).
 */
export function isStaffUser(user?: AuthUser | null): boolean {
  if (!user) return false;

  const perfilTipo = String(user.perfil?.tipo ?? "").toLowerCase();
  if (!perfilTipo) return false;
  if (perfilTipo === "cliente") return false;

  return isStaffPerfilTipo(perfilTipo);
}

/** @deprecated Use isStaffPerfilTipo */
export function isStaffTipo(tipo?: string | null): boolean {
  return isStaffPerfilTipo(tipo);
}
