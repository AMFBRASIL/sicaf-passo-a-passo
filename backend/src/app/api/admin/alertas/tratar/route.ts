import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminAlertasService = {
  tratarAlerta: (usuarioId: number, dados: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();
    const svc = await getSicafAgentModule<AdminAlertasService>("services/admin-alertas.service");
    const result = await svc.tratarAlerta(usuarioId, body);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao tratar alerta";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
