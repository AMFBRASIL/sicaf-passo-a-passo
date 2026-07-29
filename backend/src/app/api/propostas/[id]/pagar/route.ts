import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type PropostasService = {
  gerarPagamentoProposta: (payload: {
    propostaId: number;
    usuarioId: number;
    jwtTipo?: string;
    formaPagamento: string;
    dataVencimento?: string;
  }) => Promise<{ ok: boolean; error?: string; pagamento?: unknown; proposta?: unknown }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const { id } = await context.params;
    const propostaId = parseInt(String(id), 10);
    if (!Number.isFinite(propostaId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const body = await request.json();
    const formaPagamento = String(body.formaPagamento || "").toLowerCase();
    if (!["pix", "boleto"].includes(formaPagamento)) {
      return NextResponse.json(
        { ok: false, error: "formaPagamento deve ser pix ou boleto" },
        { status: 400 },
      );
    }
    const svc = await getSicafAgentModule<PropostasService>(
      "services/propostas-comerciais.service",
    );
    const result = await svc.gerarPagamentoProposta({
      propostaId,
      usuarioId,
      jwtTipo: tipo,
      formaPagamento,
      dataVencimento: body.dataVencimento,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar pagamento";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
