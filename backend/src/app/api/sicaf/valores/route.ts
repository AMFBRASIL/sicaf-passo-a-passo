import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type PrecosService = {
  getPrecosComerciais: () => Promise<{
    valorCadastroSicaf: number;
    valorCadastroSicafImediato: number;
    valorManutencaoMensal: number;
    valorManutencaoAnual: number;
  }>;
};

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const { getPrecosComerciais } = await getSicafAgentModule<PrecosService>(
      "services/precos-comerciais.service",
    );
    const valores = await getPrecosComerciais();

    return NextResponse.json({
      ok: true,
      valores,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar valores";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
