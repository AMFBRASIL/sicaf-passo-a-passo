import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type SicafTaxaService = {
  confirmarPagamento: (
    taxaId: number,
    usuarioId?: number,
  ) => Promise<{ ok: boolean; error?: string; message?: string; novaValidade?: string }>;
};

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const data = await request.json();
    const taxaId = parseInt(String(data.taxaId), 10);
    if (!Number.isFinite(taxaId) || taxaId <= 0) {
      return NextResponse.json({ ok: false, error: "taxaId é obrigatório" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<SicafTaxaService>("services/sicaf-taxa.service");
    const result = await svc.confirmarPagamento(taxaId, usuarioId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao confirmar pagamento";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
