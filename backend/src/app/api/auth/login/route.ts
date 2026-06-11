import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http/api-handler";
import { loginSchema, normalizeLoginInput } from "@/modules/auth/auth.schemas";
import type { NextRequest } from "next/server";
import { authService } from "@/modules/auth/auth.service";

/** Compatível com o frontend legado: { ok, token, user, error } */
export async function POST(request: Request) {
  try {
    const raw = await parseJsonBody(request as NextRequest, loginSchema);
    const body = normalizeLoginInput(raw);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent");
    const result = await authService.loginLegacy(body, { ip, userAgent });

    if (!result.ok) {
      return NextResponse.json(result, { status: 401 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
