import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type CertidoesService = {
  getChecklistDocumentos: (clienteId: number, usuarioId: number) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ clienteId: string }> },
) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { clienteId } = await context.params;
    const id = parseInt(clienteId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<CertidoesService>("services/certidoes.service");
    const result = await svc.getChecklistDocumentos(id, usuarioId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar checklist";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
