import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminDocumentosService = {
  getPainelDocumentos: (clienteId: number) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<AdminDocumentosService>("services/admin-documentos.service");
    const result = await svc.getPainelDocumentos(clienteId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar documentos";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
