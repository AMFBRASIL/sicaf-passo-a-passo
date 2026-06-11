import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { licitacoesService } from "@/modules/licitacoes/licitacoes.service";

/** KPIs leves por usuário (home / widgets) — sem agregações pesadas em `licitacoes`. */
export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const kpis = await licitacoesService.getHomeKpis(usuarioId);
    return NextResponse.json({ ok: true, kpis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao calcular KPIs";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
