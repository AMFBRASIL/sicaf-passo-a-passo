import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClientsService = {
  getGrupoForAdmin: (opts: {
    grupoId?: string;
    clienteId?: number;
  }) => Promise<{ ok: boolean; grupo?: unknown; error?: string }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const url = new URL(request.url);
    const grupoId = url.searchParams.get("grupoId") || undefined;
    const clienteIdRaw = url.searchParams.get("clienteId");
    const clienteId = clienteIdRaw ? parseInt(clienteIdRaw, 10) : undefined;

    if (!grupoId && !Number.isFinite(clienteId)) {
      return NextResponse.json(
        { ok: false, error: "Informe grupoId ou clienteId" },
        { status: 400 },
      );
    }

    const svc = await getSicafAgentModule<AdminClientsService>("services/admin-clients.service");
    const result = await svc.getGrupoForAdmin({
      grupoId,
      clienteId: Number.isFinite(clienteId) ? clienteId : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar grupo";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
