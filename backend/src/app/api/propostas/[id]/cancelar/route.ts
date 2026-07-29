import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type PropostasService = {
  cancelarProposta: (payload: {
    propostaId: number;
    usuarioId: number;
    jwtTipo?: string;
    motivo?: string;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const { id } = await context.params;
    const propostaId = parseInt(String(id), 10);
    if (!Number.isFinite(propostaId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    let body: { motivo?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const svc = await getSicafAgentModule<PropostasService>(
      "services/propostas-comerciais.service",
    );
    const result = await svc.cancelarProposta({
      propostaId,
      usuarioId,
      jwtTipo: tipo,
      motivo: body.motivo,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar proposta";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
