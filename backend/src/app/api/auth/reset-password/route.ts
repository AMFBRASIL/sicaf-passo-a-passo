import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http/api-handler";
import { resetPasswordSchema } from "@/modules/auth/auth.schemas";
import type { NextRequest } from "next/server";
import { authService } from "@/modules/auth/auth.service";

/** Redefine a senha usando token recebido por e-mail. */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request as NextRequest, resetPasswordSchema);
    const result = await authService.resetPasswordWithToken(body);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
