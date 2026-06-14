import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applyCorsHeaders, getCorsEnv } from "@/lib/http/cors";

export function middleware(request: NextRequest) {
  const env = getCorsEnv();
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS" && request.nextUrl.pathname.startsWith("/api/")) {
    const response = new NextResponse(null, { status: 204 });
    applyCorsHeaders(response, origin, env);
    if (origin && response.headers.get("Access-Control-Allow-Origin")) {
      response.headers.set("Access-Control-Max-Age", "86400");
    }
    return response;
  }

  const response = NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    applyCorsHeaders(response, origin, env);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
