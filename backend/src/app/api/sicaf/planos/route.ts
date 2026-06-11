import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type PlanosService = {
  listPlanosSicafCadastro: () => Promise<{
    ok: boolean;
    error?: string;
    planos?: unknown[];
  }>;
};

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const svc = await getSicafAgentModule<PlanosService>("services/planos.service");
    const result = await svc.listPlanosSicafCadastro();
    if (!result.ok) {
      return NextResponse.json(result, { status: result.error?.includes("não encontrada") ? 503 : 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar planos";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
