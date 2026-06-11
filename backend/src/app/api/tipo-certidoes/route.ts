import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type CertidoesService = {
  getTipoCertidoes: () => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const svc = await getSicafAgentModule<CertidoesService>("services/certidoes.service");
    const result = await svc.getTipoCertidoes();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar tipos";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
