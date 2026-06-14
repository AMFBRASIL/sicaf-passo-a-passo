import type { NextResponse } from "next/server";
import type { Env } from "@/lib/config/env";

export const corsMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
export const corsHeaders = "Content-Type, Authorization, X-Request-Id, X-Api-Key";

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, "");
}

function parseOriginList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

export function getAllowedOrigins(env: Env): string[] {
  const origins = new Set<string>([normalizeOrigin(env.FRONTEND_URL)]);
  for (const origin of parseOriginList(env.CORS_ALLOWED_ORIGINS)) {
    origins.add(origin);
  }
  return [...origins];
}

function isLocalDevOrigin(origin: string): boolean {
  return (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("https://localhost:") ||
    origin.startsWith("https://127.0.0.1:")
  );
}

export function isOriginAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return env.NODE_ENV === "development";

  const normalized = normalizeOrigin(origin);

  if (env.NODE_ENV === "development" && isLocalDevOrigin(normalized)) {
    return true;
  }

  if (getAllowedOrigins(env).includes(normalized)) {
    return true;
  }

  // Previews Vercel do mesmo frontend (ex.: cadbrasil-fornecedor-front-xxx.vercel.app)
  if (
    process.env.CORS_ALLOW_VERCEL_PREVIEWS === "true" &&
    /^https:\/\/cadbrasil-fornecedor-front(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

export function applyCorsHeaders(
  response: NextResponse,
  origin: string | null,
  env: Env,
): void {
  if (!isOriginAllowed(origin, env)) return;

  response.headers.set("Access-Control-Allow-Origin", origin ?? env.FRONTEND_URL);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", corsMethods);
  response.headers.set("Access-Control-Allow-Headers", corsHeaders);
}
