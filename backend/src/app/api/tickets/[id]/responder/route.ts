import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type TicketsService = {
  responderTicket: (ticketId: string, usuarioId: number, dados: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { id } = await context.params;
    const body = await request.json();
    const svc = await getSicafAgentModule<TicketsService>("services/tickets.service");
    const result = await svc.responderTicket(decodeURIComponent(id), usuarioId, {
      ...body,
      nomeUsuario: body.nomeUsuario || "Cliente",
    });
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao responder ticket";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
