import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CobrancaTaxaService = {
  enviarCobrancaTaxa: (opts: {
    clienteId: number;
    taxaId?: number;
    pagamentoId?: number;
    usuarioId: number;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();

    const clienteId = parseInt(String(body.clienteId ?? body.cliente_id ?? ""), 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "clienteId inválido" }, { status: 400 });
    }

    const taxaId = body.taxaId != null ? parseInt(String(body.taxaId), 10) : undefined;
    const pagamentoId = body.pagamentoId != null ? parseInt(String(body.pagamentoId), 10) : undefined;

    const svc = await getSicafAgentModule<CobrancaTaxaService>("services/cobranca-taxa.service");
    const result = await svc.enviarCobrancaTaxa({
      clienteId,
      taxaId: Number.isFinite(taxaId) && taxaId! > 0 ? taxaId : undefined,
      pagamentoId: Number.isFinite(pagamentoId) && pagamentoId! > 0 ? pagamentoId : undefined,
      usuarioId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar cobrança";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
