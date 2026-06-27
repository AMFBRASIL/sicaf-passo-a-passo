import { SESSION_MAX_AGE_SEC } from "@/lib/auth-token";

const TOKEN_KEY = "cadbrasil_token";
const COOKIE_NAME = "cadbrasil_token";

export function persistAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${SESSION_MAX_AGE_SEC}; SameSite=Lax`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  }
}

function readTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function readAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  const fromStorage = localStorage.getItem(TOKEN_KEY);
  if (fromStorage) return fromStorage;

  const fromCookie = readTokenFromCookie();
  if (fromCookie) {
    localStorage.setItem(TOKEN_KEY, fromCookie);
    return fromCookie;
  }

  return null;
}
