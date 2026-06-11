import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettingsService = {
  testStorageSettings: () => Promise<{ ok: boolean; message?: string; error?: string }>;
};

export async function POST(request: Request) {
  try {
    await requireLegacyUserId(request);
    const svc = await getSicafAgentModule<SettingsService>("services/settings.service");
    const result = await svc.testStorageSettings();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao testar armazenamento";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
