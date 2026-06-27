import { persistAuthToken, readAuthToken } from "@/lib/auth-cookie";
import { isPublicPortalPath } from "@/lib/require-portal-auth";
import { isTokenExpired } from "@/lib/auth-token";

type AuthStateSync = {
  onClear: () => void;
};

let stateSync: AuthStateSync | null = null;
let redirecting = false;

export function registerAuthStateSync(sync: AuthStateSync) {
  stateSync = sync;
  return () => {
    if (stateSync === sync) stateSync = null;
  };
}

export function invalidateAuthSession() {
  persistAuthToken(null);
  stateSync?.onClear();
}

function normalizeApiPath(input: string): string {
  if (input.startsWith("http")) {
    try {
      return new URL(input).pathname;
    } catch {
      return input;
    }
  }
  return input.split("?")[0] || input;
}

function isPublicAuthApi(path: string): boolean {
  return (
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/forgot-password") ||
    path.startsWith("/api/auth/reset-password")
  );
}

export function redirectToAuth(fromPath?: string) {
  if (typeof window === "undefined") return;

  const current = fromPath || window.location.pathname;
  if (isPublicPortalPath(current) || current === "/login") return;
  if (redirecting) return;

  redirecting = true;
  const url = new URL("/auth", window.location.origin);
  if (current && current !== "/" && !isPublicPortalPath(current)) {
    url.searchParams.set("from", current);
  }

  const target = `${url.pathname}${url.search}`;
  window.location.replace(target);
  window.setTimeout(() => {
    if (window.location.pathname !== "/auth" && !window.location.pathname.startsWith("/auth/")) {
      window.location.href = target;
    }
    redirecting = false;
  }, 1500);
}

/** Sessão inválida ou expirada — limpa estado e força login. */
export function handleSessionExpired(fromPath?: string) {
  if (typeof window === "undefined") return;
  invalidateAuthSession();
  redirectToAuth(fromPath || window.location.pathname);
}

export function handleApiUnauthorized(apiInput: string) {
  const path = normalizeApiPath(apiInput);
  if (isPublicAuthApi(path)) return;
  handleSessionExpired();
}

/** Retorna true se o token ainda é válido; caso contrário encerra sessão e redireciona. */
export function ensureAuthTokenValid(fromPath?: string): boolean {
  const token = readAuthToken();
  if (!token || isTokenExpired(token)) {
    handleSessionExpired(fromPath);
    return false;
  }
  return true;
}
