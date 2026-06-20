import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function validateApiKey(request: Request): Promise<boolean> {
  const config = await getSicafAgentModule<{ api?: { cnpjConsultaApiKey?: string } }>("config/index");
  const required = String(config.api?.cnpjConsultaApiKey || "").trim();
  if (!required) return true;
  const received = String(request.headers.get("x-api-key") || "").trim();
  return received === required;
}

type ClientsService = {
  gerarOuObterBoletoSicafByCnpj: (cnpj: string) => Promise<{
    ok: boolean;
    error?: string;
    possuiCadastro?: boolean;
  }>;
};

function resolveStatus(result: { ok: boolean; error?: string; possuiCadastro?: boolean }): number {
  if (!result.ok) {
    if ((result.error || "").includes("inválido")) return 400;
    if (result.possuiCadastro === false) return 404;
    return 500;
  }
  return 200;
}

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
  const result = await svc.gerarOuObterBoletoSicafByCnpj(cnpj);

  return NextResponse.json(result, { status: resolveStatus(result) });
}

export async function POST(request: Request) {
  if (!(await validateApiKey(request))) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado. API Key inválida." },
      { status: 401 },
    );
  }

  let cnpj = "";
  try {
    const body = (await request.json()) as { cnpj?: string };
    cnpj = String(body?.cnpj || "");
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON inválido" }, { status: 400 });
  }

  const svc = await getSicafAgentModule<ClientsService>("services/clients.service");
  const result = await svc.gerarOuObterBoletoSicafByCnpj(cnpj);

  return NextResponse.json(result, { status: resolveStatus(result) });
}
