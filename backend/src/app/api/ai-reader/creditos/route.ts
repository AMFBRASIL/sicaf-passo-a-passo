import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type AiReaderService = {
  getCreditosUsuario: (usuarioId: number) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const svc = await getSicafAgentModule<AiReaderService>("services/ai-reader.service");
    const result = await svc.getCreditosUsuario(usuarioId);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar créditos";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
