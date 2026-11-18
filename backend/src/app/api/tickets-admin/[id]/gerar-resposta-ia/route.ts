import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketsService = {
  gerarRascunhoRespostaIa: (
    ticketId: string,
    opts?: { instrucao?: string },
  ) => Promise<{
    ok: boolean;
    rascunho?: string;
    modelo?: string;
    error?: string;
  }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { instrucao?: string };
    const svc = await getSicafAgentModule<TicketsService>("services/tickets.service");
    const result = await svc.gerarRascunhoRespostaIa(decodeURIComponent(id), {
      instrucao: body.instrucao,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar resposta com IA";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
