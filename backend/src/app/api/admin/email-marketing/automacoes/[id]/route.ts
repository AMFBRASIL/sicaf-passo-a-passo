import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailMktService = {
  toggleAutomacao: (id: number, ativo?: boolean) => Promise<Record<string, unknown>>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const autoId = parseInt(id, 10);
    if (!autoId) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as { ativo?: boolean };
    const svc = await getSicafAgentModule<EmailMktService>(
      "services/admin-email-marketing.service",
    );
    const result = await svc.toggleAutomacao(autoId, body.ativo);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar automação";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
