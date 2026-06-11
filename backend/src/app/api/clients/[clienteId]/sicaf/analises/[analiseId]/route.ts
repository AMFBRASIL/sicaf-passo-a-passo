import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type SicafAnalisesService = {
  getAnaliseById: (
    analiseId: number,
    clienteId: number,
    usuarioId: number,
  ) => Promise<{ ok: boolean; error?: string; analise?: unknown }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ clienteId: string; analiseId: string }> },
) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { clienteId, analiseId } = await context.params;
    const cId = parseInt(clienteId, 10);
    const aId = parseInt(analiseId, 10);
    if (!Number.isFinite(cId) || cId <= 0 || !Number.isFinite(aId) || aId <= 0) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<SicafAnalisesService>("services/sicaf-analises.service");
    const result = await svc.getAnaliseById(aId, cId, usuarioId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar análise";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
