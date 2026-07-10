import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CobrancaTaxaService = {
  verifyPublicPayAccess: (
    code: string,
    cnpj: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { cnpj?: string };
    const cnpj = String(body.cnpj || "").trim();
    if (!cnpj) {
      return NextResponse.json({ ok: false, error: "Informe o CNPJ da empresa." }, { status: 400 });
    }

    const svc = await getSicafAgentModule<CobrancaTaxaService>("services/cobranca-taxa.service");
    const result = await svc.verifyPublicPayAccess(code, cnpj);
    return NextResponse.json(result, { status: result.ok ? 200 : 401 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao validar acesso";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
