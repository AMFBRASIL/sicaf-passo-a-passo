import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminFunilService = {
  getAdminFunil: (opts: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const url = new URL(request.url);
    const svc = await getSicafAgentModule<AdminFunilService>("services/admin-funil.service");
    const result = await svc.getAdminFunil({
      days: parseInt(url.searchParams.get("days") || "90", 10),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar funil";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
