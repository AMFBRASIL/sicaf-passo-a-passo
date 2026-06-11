import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RevisoesService = {
  removerRevisaoAgendada: (payload: {
    usuarioId: number;
    id: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireLegacyAuth(request);
    const { id } = await context.params;
    const svc = await getSicafAgentModule<RevisoesService>("services/revisoes-agendadas.service");
    const result = await svc.removerRevisaoAgendada({ usuarioId, id });
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao remover revisão";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
