import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OnboardingService = {
  getOnboardingDiagnostico: (protocolo: string) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ protocolo: string }> },
) {
  try {
    const { protocolo } = await context.params;
    const svc = await getSicafAgentModule<OnboardingService>("services/onboarding.service");
    const result = await svc.getOnboardingDiagnostico(decodeURIComponent(protocolo || ""));
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar protocolo";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
