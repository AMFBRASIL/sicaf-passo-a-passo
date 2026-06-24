import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettingsService = {
  getIaSettings: () => Promise<{
    ok: boolean;
    settings?: Record<string, string>;
    status?: { configured: boolean; apiKeySource: string; provider: string; model: string };
    error?: string;
  }>;
  updateIaSettings: (updates: Record<string, string>) => Promise<{
    ok: boolean;
    updated?: number;
    message?: string;
    error?: string;
  }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const svc = await getSicafAgentModule<SettingsService>("services/settings.service");
    const result = await svc.getIaSettings();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar configurações de IA";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await requireStaffAccess(request);
    const body = await request.json();
    const svc = await getSicafAgentModule<SettingsService>("services/settings.service");
    const result = await svc.updateIaSettings(body.settings || body);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar configurações de IA";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
