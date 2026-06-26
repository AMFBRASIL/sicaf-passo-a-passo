import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClientsService = {
  cancelClientCnpj: (
    clienteId: number,
    opts: { usuarioId?: number; motivo?: string },
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

function parseClienteId(id: string): number | null {
  const clienteId = parseInt(id, 10);
  if (!Number.isFinite(clienteId) || clienteId <= 0) return null;
  return clienteId;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { id } = await context.params;
    const clienteId = parseClienteId(id);
    if (!clienteId) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const motivo = String(body.motivo || body.mensagem || "").trim();

    const svc = await getSicafAgentModule<AdminClientsService>("services/admin-clients.service");
    const result = await svc.cancelClientCnpj(clienteId, { usuarioId, motivo });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar CNPJ";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
