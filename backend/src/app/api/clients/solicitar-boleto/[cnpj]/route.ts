import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ cnpj: string }> };

async function validateApiKey(request: Request): Promise<boolean> {
  const config = await getSicafAgentModule<{ api?: { cnpjConsultaApiKey?: string } }>("config/index");
  const required = String(config.api?.cnpjConsultaApiKey || "").trim();
  if (!required) return true;
  const received = String(request.headers.get("x-api-key") || "").trim();
  return received === required;
}

type ClientsService = {
  gerarOuObterBoletoSicafByCnpj: (
    cnpj: string,
    options?: { enviarEmail?: boolean },
  ) => Promise<{
    ok: boolean;
    error?: string;
    possuiCadastro?: boolean;
    emailEnviado?: boolean;
    emailPara?: string | null;
    emailErro?: string | null;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  if (!(await validateApiKey(request))) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado. API Key inválida." },
      { status: 401 },
    );
  }

  const { cnpj: cnpjParam } = await context.params;
  const cnpj = decodeURIComponent(cnpjParam || "");
  const svc = await getSicafAgentModule<ClientsService>("services/clients.service");
  const result = await svc.gerarOuObterBoletoSicafByCnpj(cnpj, { enviarEmail: true });

  if (!result.ok) {
    const status = (result.error || "").includes("inválido")
      ? 400
      : result.possuiCadastro === false
        ? 404
        : 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
