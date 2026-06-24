import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketsService = {
  enviarNotificacaoEmailRespostaTicketAdmin: (
    ticketId: string,
    mensagemId: number,
    usuarioId: number,
  ) => Promise<{ ok: boolean; error?: string; emailNotificacao?: Record<string, unknown> }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { id } = await context.params;
    const body = (await request.json()) as { mensagemId?: number | string };
    const mensagemId = parseInt(String(body.mensagemId ?? ""), 10);
    if (!Number.isFinite(mensagemId) || mensagemId <= 0) {
      return NextResponse.json({ ok: false, error: "mensagemId inválido" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<TicketsService>("services/tickets.service");
    const result = await svc.enviarNotificacaoEmailRespostaTicketAdmin(
      decodeURIComponent(id),
      mensagemId,
      usuarioId,
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao notificar cliente por e-mail";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
