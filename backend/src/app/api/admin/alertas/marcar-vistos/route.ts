import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminAlertasService = {
  marcarTodosVistos: (usuarioId: number) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const svc = await getSicafAgentModule<AdminAlertasService>("services/admin-alertas.service");
    const result = await svc.marcarTodosVistos(usuarioId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao marcar alertas";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
