import { redirect } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api-config";
import { readAuthToken } from "@/lib/auth-cookie";
import { invalidateAuthSession } from "@/lib/auth-session";

/** Valida sessão antes de carregar rotas do portal (fornecedor). */
export async function requirePortalAuth() {
  if (typeof window === "undefined") return;

  const token = readAuthToken();
  if (!token) {
    throw redirect({ to: "/auth" });
  }

  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; user?: unknown };

    if (!res.ok || !data.ok || !data.user) {
      invalidateAuthSession();
      throw redirect({ to: "/auth" });
    }
  } catch (err) {
    if (err && typeof err === "object" && "href" in err) throw err;
    invalidateAuthSession();
    throw redirect({ to: "/auth" });
  }
}
