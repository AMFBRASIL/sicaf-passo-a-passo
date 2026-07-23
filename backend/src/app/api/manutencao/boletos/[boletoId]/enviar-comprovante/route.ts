import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type ManutencaoService = {
  enviarComprovanteManutencao: (opts: {
    boletoId: number;
    usuarioId: number;
    jwtTipo?: string;
    emailDestino?: string;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(
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

    let emailDestino: string | undefined;
    try {
      const body = await request.json();
      if (body?.emailDestino != null || body?.email != null) {
        emailDestino = String(body.emailDestino ?? body.email).trim() || undefined;
      }
    } catch {
      /* body opcional */
    }

    const svc = await getSicafAgentModule<ManutencaoService>("services/manutencao.service");
    const result = await svc.enviarComprovanteManutencao({
      boletoId: id,
      usuarioId,
      jwtTipo: tipo,
      emailDestino,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar comprovante";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
