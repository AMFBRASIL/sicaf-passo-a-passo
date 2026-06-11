import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type SicafAnalisesService = {
  listAnalisesForUsuario: (
    usuarioId: number,
  ) => Promise<{ ok: boolean; error?: string; analises?: unknown[] }>;
};

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const svc = await getSicafAgentModule<SicafAnalisesService>("services/sicaf-analises.service");
    const result = await svc.listAnalisesForUsuario(usuarioId);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    console.error("[sicaf/analises] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro ao listar análises";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
