import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettingsService = {
  getEmailSettings: () => Promise<{
    ok: boolean;
    settings?: Record<string, string>;
    templateCount?: number;
    error?: string;
  }>;
  updateEmailSettings: (updates: Record<string, string>) => Promise<{
    ok: boolean;
    updated?: number;
    message?: string;
    error?: string;
  }>;
};

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const svc = await getSicafAgentModule<SettingsService>("services/settings.service");
    const result = await svc.getEmailSettings();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar configurações de e-mail";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await requireLegacyUserId(request);
    const body = await request.json();
    const svc = await getSicafAgentModule<SettingsService>("services/settings.service");
    const result = await svc.updateEmailSettings(body.settings || body);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar configurações de e-mail";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
