import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PagamentosService = {
  cancelarBoletoGerencianet: (
    pagamentoId: number,
    opts?: { clienteId?: number; usuarioId?: number; motivo?: string },
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();
    const pagamentoId = parseInt(String(body.pagamentoId ?? ""), 10);
    const clienteId = body.clienteId != null ? parseInt(String(body.clienteId), 10) : undefined;
    const motivo = body.motivo ? String(body.motivo).trim() : undefined;

    if (!Number.isFinite(pagamentoId) || pagamentoId <= 0) {
      return NextResponse.json({ ok: false, error: "pagamentoId é obrigatório" }, { status: 400 });
    }
    if (clienteId != null && (!Number.isFinite(clienteId) || clienteId <= 0)) {
      return NextResponse.json({ ok: false, error: "clienteId inválido" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<PagamentosService>("services/pagamentos.service");
    const result = await svc.cancelarBoletoGerencianet(pagamentoId, {
      clienteId,
      usuarioId,
      motivo,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar boleto";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
