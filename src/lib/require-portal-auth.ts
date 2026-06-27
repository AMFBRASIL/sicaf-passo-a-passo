import { redirect } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api-config";
import { readAuthToken } from "@/lib/auth-cookie";
import { handleSessionExpired, invalidateAuthSession } from "@/lib/auth-session";
import { isTokenExpired } from "@/lib/auth-token";

const PUBLIC_PREFIXES = ["/auth", "/pay", "/sicaf-assistant", "/sicaf-assistant-chat"] as const;

const PUBLIC_EXACT = new Set(["/login", "/esqueci-senha"]);

/** Rotas que não exigem sessão do portal (fornecedor). */
export function isPublicPortalPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Admin tem guard próprio em /admin. */
export function isPortalRouteProtected(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;
  return !isPublicPortalPath(pathname);
}

/** Valida sessão antes de carregar rotas do portal (fornecedor). */
export async function requirePortalAuth(fromPath?: string) {
  if (typeof window === "undefined") return;

  const token = readAuthToken();
  if (!token || isTokenExpired(token)) {
    handleSessionExpired(fromPath);
    throw redirect({ to: "/auth" });
  }

  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; user?: unknown };

    if (!res.ok || !data.ok || !data.user) {
      invalidateAuthSession();
      handleSessionExpired(fromPath);
      throw redirect({
        to: "/auth",
        search: fromPath && fromPath !== "/" ? { from: fromPath } : undefined,
      });
    }
  } catch (err) {
    if (err && typeof err === "object" && "href" in err) throw err;
    invalidateAuthSession();
    handleSessionExpired(fromPath);
    throw redirect({
      to: "/auth",
      search: fromPath && fromPath !== "/" ? { from: fromPath } : undefined,
    });
  }
}
