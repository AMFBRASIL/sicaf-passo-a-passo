/** Alinhado ao JWT_EXPIRES_IN do backend (padrão 30 dias). */
export const SESSION_MAX_AGE_DAYS = 30;
export const SESSION_MAX_AGE_SEC = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Segundos até expirar (negativo = já expirou). Null se não decodificar. */
export function getTokenExpiresInSec(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  return exp - Math.floor(Date.now() / 1000);
}

export function isTokenExpired(token: string | null | undefined, skewSec = 30): boolean {
  if (!token) return true;
  const left = getTokenExpiresInSec(token);
  if (left === null) return true;
  return left <= skewSec;
}
