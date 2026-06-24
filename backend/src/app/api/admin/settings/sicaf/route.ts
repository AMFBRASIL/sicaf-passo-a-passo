import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SicafSettingsPayload = {
  niveisObrigatorios: boolean[];
  avisoAntecedenciaDias: number;
  lembreteReenvioDias: number;
  centralAlertaCertidoesDias: number;
  ticketAutomatico: boolean;
  notificarEmailWhatsapp: boolean;
  bloquearRelatorioVencido: boolean;
};

type SettingsService = {
  getSicafSettings: () => Promise<{
    ok: boolean;
    settings?: SicafSettingsPayload;
    status?: { niveisAtivos: number; centralAlertaDias: number; avisoAntecedenciaDias: number };
    error?: string;
  }>;
  updateSicafSettings: (updates: SicafSettingsPayload) => Promise<{
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
    const result = await svc.getSicafSettings();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar configurações SICAF";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await requireStaffAccess(request);
    const body = await request.json();
    const svc = await getSicafAgentModule<SettingsService>("services/settings.service");
    const payload = (body.settings ?? body) as SicafSettingsPayload;
    const result = await svc.updateSicafSettings(payload);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar configurações SICAF";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
