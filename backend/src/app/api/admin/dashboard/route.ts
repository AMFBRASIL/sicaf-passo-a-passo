import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Dashboard executa dezenas de consultas ao MySQL remoto — precisa de mais tempo na Vercel. */
export const maxDuration = 60;

type AdminDashboardService = {
  getAdminDashboard: () => Promise<Record<string, unknown>>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);

    const svc = await getSicafAgentModule<AdminDashboardService>("services/admin-dashboard.service");
    const result = await svc.getAdminDashboard();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
