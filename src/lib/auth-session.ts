import { persistAuthToken, readAuthToken } from "@/lib/auth-cookie";

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
  if (redirecting) return;

  const current = fromPath || window.location.pathname;
  if (current === "/auth" || current.startsWith("/auth/") || current === "/login") return;

  redirecting = true;
  const url = new URL("/auth", window.location.origin);
  if (current && current !== "/" && !current.startsWith("/auth")) {
    url.searchParams.set("from", current);
  }
  window.location.replace(`${url.pathname}${url.search}`);
}

export function handleApiUnauthorized(apiInput: string) {
  const path = normalizeApiPath(apiInput);
  if (isPublicAuthApi(path)) return;
  if (!readAuthToken()) return;

  invalidateAuthSession();
  redirectToAuth(window.location.pathname);
}
