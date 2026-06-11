import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type PagamentosService = {
  autorizarPagamentoManutencao: (
    boletoId: number,
    clienteIdEsperado: number | null,
    usuarioId: number | null,
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ boletoId: string }> },
) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { boletoId } = await context.params;
    const id = parseInt(boletoId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "ID do boleto inválido" }, { status: 400 });
    }

    let clienteId: number | null = null;
    try {
      const body = await request.json();
      if (body.clienteId != null) {
        const parsed = parseInt(String(body.clienteId), 10);
        if (Number.isFinite(parsed) && parsed > 0) clienteId = parsed;
      }
    } catch {
      /* body opcional */
    }

    const svc = await getSicafAgentModule<PagamentosService>("services/pagamentos.service");
    const result = await svc.autorizarPagamentoManutencao(id, clienteId, usuarioId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao autorizar pagamento";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
