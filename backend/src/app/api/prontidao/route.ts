import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type ProntidaoService = {
  getPortfolioProntidao: (usuarioId: number, search?: string) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const svc = await getSicafAgentModule<ProntidaoService>("services/prontidao.service");
    const result = await svc.getPortfolioProntidao(usuarioId, search);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar prontidão";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
