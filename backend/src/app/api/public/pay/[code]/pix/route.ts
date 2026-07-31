import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CobrancaTaxaService = {
  gerarPixPublicPay: (
    code: string,
    documento: string,
    guiaId?: string | null,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      cnpj?: string;
      cpf?: string;
      documento?: string;
      guiaId?: string;
    };
    const documento = String(body.documento || body.cpf || body.cnpj || "").trim();
    if (!documento) {
      return NextResponse.json(
        { ok: false, error: "Informe o CPF ou CNPJ cadastrado." },
        { status: 400 },
      );
    }

    const svc = await getSicafAgentModule<CobrancaTaxaService>("services/cobranca-taxa.service");
    const result = await svc.gerarPixPublicPay(code, documento, body.guiaId || null);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar PIX";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
