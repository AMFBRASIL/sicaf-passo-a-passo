import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/config/env";

const corsMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const corsHeaders = "Content-Type, Authorization, X-Request-Id, X-Api-Key";

export function middleware(request: NextRequest) {
  const env = getEnv();
  const origin = request.headers.get("origin");
  const allowedOrigin = env.FRONTEND_URL;

  if (request.method === "OPTIONS" && request.nextUrl.pathname.startsWith("/api/")) {
    const response = new NextResponse(null, { status: 204 });
    if (origin === allowedOrigin || env.NODE_ENV === "development") {
      response.headers.set("Access-Control-Allow-Origin", origin ?? allowedOrigin);
      response.headers.set("Access-Control-Allow-Methods", corsMethods);
      response.headers.set("Access-Control-Allow-Headers", corsHeaders);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Max-Age", "86400");
    }
    return response;
  }

  const response = NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (origin === allowedOrigin || env.NODE_ENV === "development") {
      response.headers.set("Access-Control-Allow-Origin", origin ?? allowedOrigin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
    response.headers.set("Access-Control-Allow-Methods", corsMethods);
    response.headers.set("Access-Control-Allow-Headers", corsHeaders);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
