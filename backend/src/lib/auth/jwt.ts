import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getEnv } from "@/lib/config/env";
import { unauthorized } from "@/lib/http/errors";

export type TokenPayload = JWTPayload & {
  sub: string;
  email: string;
  tipo: "admin" | "colaborador" | "cliente";
  perfilId: number;
};

function getSecretKey() {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signAccessToken(payload: Omit<TokenPayload, "iat" | "exp">): Promise<string> {
  const env = getEnv();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub || !payload.email) {
      throw unauthorized("Token inválido");
    }
    return payload as TokenPayload;
  } catch {
    throw unauthorized("Token inválido ou expirado");
  }
}

export function extractBearerToken(authorization: string | null): string {
  if (!authorization?.startsWith("Bearer ")) {
    throw unauthorized("Token de autenticação ausente");
  }
  const token = authorization.slice(7).trim();
  if (!token) throw unauthorized("Token de autenticação ausente");
  return token;
}
