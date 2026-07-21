import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailMktService = {
  saveTemplate: (usuarioId: number, dados: Record<string, unknown>) => Promise<Record<string, unknown>>;
  deleteTemplate: (id: number) => Promise<Record<string, unknown>>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();
    const svc = await getSicafAgentModule<EmailMktService>(
      "services/admin-email-marketing.service",
    );
    const result = await svc.saveTemplate(usuarioId, body);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar template";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireStaffAccess(request);
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get("id") || "", 10);
    if (!id) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    const svc = await getSicafAgentModule<EmailMktService>(
      "services/admin-email-marketing.service",
    );
    const result = await svc.deleteTemplate(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir template";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
