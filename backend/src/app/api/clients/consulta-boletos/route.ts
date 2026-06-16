import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

async function validateApiKey(request: Request): Promise<boolean> {
  const config = await getSicafAgentModule<{ api?: { cnpjConsultaApiKey?: string } }>("config/index");
  const required = String(config.api?.cnpjConsultaApiKey || "").trim();
  if (!required) return true;
  const received = String(request.headers.get("x-api-key") || "").trim();
  return received === required;
}

type ClientsService = {
  consultPendingBoletosByCnpj: (cnpj: string) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request) {
  if (!(await validateApiKey(request))) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado. API Key inválida." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const cnpj = url.searchParams.get("cnpj") || "";
  const svc = await getSicafAgentModule<ClientsService>("services/clients.service");
  const result = await svc.consultPendingBoletosByCnpj(cnpj);

  if (!result.ok) {
    const status = (result.error || "").includes("inválido") ? 400 : 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
