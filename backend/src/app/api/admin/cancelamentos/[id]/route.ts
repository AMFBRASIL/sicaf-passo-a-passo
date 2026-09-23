import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CancelamentoService = {
  getSolicitacao: (id: number | string) => Promise<{ ok: boolean; error?: string }>;
  updateStatus: (
    id: number | string,
    status: string,
    opts: { usuarioId?: number; observacoes?: string },
  ) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const svc = await getSicafAgentModule<CancelamentoService>(
      "services/solicitacoes-cancelamento.service",
    );
    const result = await svc.getSolicitacao(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar solicitação";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { id } = await context.params;
    const body = await request.json();
    const status = String(body.status || "").trim();
    if (!status) {
      return NextResponse.json({ ok: false, error: "Status obrigatório" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<CancelamentoService>(
      "services/solicitacoes-cancelamento.service",
    );
    const result = await svc.updateStatus(id, status, {
      usuarioId,
      observacoes: body.observacoes,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar status";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
