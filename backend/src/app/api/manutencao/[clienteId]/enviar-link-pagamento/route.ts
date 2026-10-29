import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManutencaoService = {
  enviarLinkPagamentoPortal: (opts: {
    clienteId: number;
    usuarioId: number;
    jwtTipo?: string;
    emailDestino?: string;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ clienteId: string }> },
) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const { clienteId: clienteIdParam } = await context.params;
    const clienteId = parseInt(clienteIdParam, 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "clienteId inválido" }, { status: 400 });
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
    const result = await svc.enviarLinkPagamentoPortal({
      clienteId,
      usuarioId,
      jwtTipo: tipo,
      emailDestino,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar link de pagamento";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
