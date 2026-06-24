import { apiFetch } from "@/lib/api-fetch";

export type StaffAccessResponse = {
  ok: boolean;
  isStaff: boolean;
  perfilId?: number | null;
  perfilTipo?: string | null;
  error?: string;
};

/** Valida no servidor se o usuário pode acessar o painel /admin. */
export async function fetchStaffAccess(): Promise<StaffAccessResponse> {
  const res = await apiFetch("/api/auth/staff-access");
  return (await res.json()) as StaffAccessResponse;
}
