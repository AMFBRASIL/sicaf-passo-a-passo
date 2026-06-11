import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type SicafTaxaService = {
  gerarTaxa: (opts: {
    clienteId: number;
    ano: number;
    formaPagamento: string;
    dataVencimento?: string | null;
    allowCustomDueDate?: boolean;
    geradoPor?: number;
    planoCodigo?: string;
  }) => Promise<{ ok: boolean; error?: string; dados?: unknown }>;
};

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const data = await request.json();
    const svc = await getSicafAgentModule<SicafTaxaService>("services/sicaf-taxa.service");

    const result = await svc.gerarTaxa({
      clienteId: data.clienteId,
      ano: data.ano || new Date().getFullYear(),
      formaPagamento: data.formaPagamento,
      dataVencimento: data.dataVencimento || null,
      allowCustomDueDate: false,
      geradoPor: usuarioId,
      planoCodigo: data.planoCodigo || null,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar taxa";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
