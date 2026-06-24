import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettingsService = {
  getTemplates: () => Promise<{ ok: boolean; templates?: unknown[]; error?: string }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const svc = await getSicafAgentModule<SettingsService>("services/settings.service");
    const result = await svc.getTemplates();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar templates";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
