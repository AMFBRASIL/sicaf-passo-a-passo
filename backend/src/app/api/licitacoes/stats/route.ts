import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { licitacoesService } from "@/modules/licitacoes/licitacoes.service";

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const url = new URL(request.url);
    const kpisOnly = url.searchParams.get("kpisOnly") === "1";

    if (kpisOnly) {
      const kpis = await licitacoesService.getHomeKpis(usuarioId);
      return NextResponse.json({ ok: true, kpis });
    }

    const { stats, kpis } = await licitacoesService.getStatsForUser(usuarioId);
    return NextResponse.json({ ok: true, stats, kpis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao calcular indicadores";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
