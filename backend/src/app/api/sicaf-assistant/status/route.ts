import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type IaService = {
  getStatus: () => Promise<{
    ok: boolean;
    configured: boolean;
    ready: boolean;
    provider: string;
    model: string;
    apiKeySource: string;
  }>;
};

export async function GET() {
  const iaService = await getSicafAgentModule<IaService>("services/ia.service");
  const status = await iaService.getStatus();

  return NextResponse.json({
    ok: true,
    openai: status.ready,
    configured: status.configured,
    provider: status.provider,
    model: status.model,
    apiKeySource: status.apiKeySource,
  });
}
