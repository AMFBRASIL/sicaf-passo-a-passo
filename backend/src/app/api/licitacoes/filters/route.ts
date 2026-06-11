import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { licitacoesService } from "@/modules/licitacoes/licitacoes.service";

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const filters = await licitacoesService.getFilterOptions();
    return NextResponse.json({ ok: true, filters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar filtros";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
