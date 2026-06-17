import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http/api-handler";
import { forgotPasswordSchema } from "@/modules/auth/auth.schemas";
import type { NextRequest } from "next/server";
import { authService } from "@/modules/auth/auth.service";

/** Solicita redefinição de senha por e-mail. */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request as NextRequest, forgotPasswordSchema);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await authService.requestPasswordReset(body, { ip });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
