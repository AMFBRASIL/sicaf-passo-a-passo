import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailMktService = {
  sendCampanha: (id: number, opts?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  duplicateCampanha: (id: number, usuarioId: number) => Promise<Record<string, unknown>>;
  cancelCampanha: (id: number) => Promise<Record<string, unknown>>;
  deleteCampanha: (id: number) => Promise<Record<string, unknown>>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { id } = await context.params;
    const campanhaId = parseInt(id, 10);
    if (!campanhaId) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const action = String(body.action || "send");
    const svc = await getSicafAgentModule<EmailMktService>(
      "services/admin-email-marketing.service",
    );

    let result: Record<string, unknown>;
    if (action === "duplicate") {
      result = await svc.duplicateCampanha(campanhaId, usuarioId);
    } else if (action === "cancel") {
      result = await svc.cancelCampanha(campanhaId);
    } else {
      result = await svc.sendCampanha(campanhaId, { usuarioId });
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na campanha";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(_request);
    const { id } = await context.params;
    const campanhaId = parseInt(id, 10);
    if (!campanhaId) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<EmailMktService>(
      "services/admin-email-marketing.service",
    );
    const result = await svc.deleteCampanha(campanhaId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir campanha";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
