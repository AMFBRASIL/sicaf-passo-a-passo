import type { NextResponse } from "next/server";

export const corsMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
export const corsHeaders = "Content-Type, Authorization, X-Request-Id, X-Api-Key";

/** Leitura leve de env — compatível com Edge Middleware (sem zod). */
export type CorsEnv = {
  nodeEnv: string;
  frontendUrl: string;
  corsAllowedOrigins?: string;
};

export function getCorsEnv(): CorsEnv {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  };
}

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

export function getAllowedOrigins(env: CorsEnv): string[] {
  const origins = new Set<string>([normalizeOrigin(env.frontendUrl)]);
  for (const origin of parseOriginList(env.corsAllowedOrigins)) {
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

export function isOriginAllowed(origin: string | null, env: CorsEnv): boolean {
  if (!origin) return env.nodeEnv === "development";

  const normalized = normalizeOrigin(origin);

  if (env.nodeEnv === "development" && isLocalDevOrigin(normalized)) {
    return true;
  }

  if (getAllowedOrigins(env).includes(normalized)) {
    return true;
  }

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
  env: CorsEnv,
): void {
  if (!isOriginAllowed(origin, env)) return;

  response.headers.set("Access-Control-Allow-Origin", origin ?? env.frontendUrl);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", corsMethods);
  response.headers.set("Access-Control-Allow-Headers", corsHeaders);
}
