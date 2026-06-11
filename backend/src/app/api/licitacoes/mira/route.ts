import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { licitacoesService } from "@/modules/licitacoes/licitacoes.service";

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const result = await licitacoesService.getMiraIds(usuarioId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar mira";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
