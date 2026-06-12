import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { AppError } from "@/lib/http/errors";
import { licitacoesService } from "@/modules/licitacoes/licitacoes.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authStatus(message: string) {
  return message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
    ? 401
    : 500;
}

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    let autoMiraOnly = false;
    try {
      const body = (await request.json()) as { autoMiraOnly?: boolean };
      autoMiraOnly = !!body.autoMiraOnly;
    } catch {
      autoMiraOnly = false;
    }
    const result = await licitacoesService.runRadar(usuarioId, { autoMiraOnly });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/licitacoes/radar/run]", error);
    const message = error instanceof Error ? error.message : "Erro ao executar radar";
    const status = error instanceof AppError ? error.statusCode : authStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
