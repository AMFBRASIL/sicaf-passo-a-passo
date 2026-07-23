import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type ManutencaoService = {
  getBoletoManutencaoDetalhe: (
    boletoId: number,
    usuarioId: number,
    jwtTipo?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ boletoId: string }> },
) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const { boletoId } = await context.params;
    const id = parseInt(boletoId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "ID do boleto inválido" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<ManutencaoService>("services/manutencao.service");
    const result = await svc.getBoletoManutencaoDetalhe(id, usuarioId, tipo);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar boleto";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
