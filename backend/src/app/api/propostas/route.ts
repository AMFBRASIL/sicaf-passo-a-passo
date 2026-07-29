import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type PropostasService = {
  listPropostasPendentes: (
    usuarioId: number,
    jwtTipo?: string,
  ) => Promise<{ ok: boolean; error?: string; propostas?: unknown[]; total?: number }>;
};

export async function GET(request: Request) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const svc = await getSicafAgentModule<PropostasService>(
      "services/propostas-comerciais.service",
    );
    const result = await svc.listPropostasPendentes(usuarioId, tipo);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar propostas";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message, propostas: [] }, { status });
  }
}
