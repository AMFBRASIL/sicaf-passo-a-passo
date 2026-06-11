import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettingsService = {
  updateTemplate: (
    id: number,
    data: Record<string, unknown>,
  ) => Promise<{ ok: boolean; message?: string; error?: string }>;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireLegacyUserId(request);
    const { id } = await context.params;
    const templateId = parseInt(id, 10);
    if (!Number.isFinite(templateId) || templateId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const body = await request.json();
    const svc = await getSicafAgentModule<SettingsService>("services/settings.service");
    const result = await svc.updateTemplate(templateId, body);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar template";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
