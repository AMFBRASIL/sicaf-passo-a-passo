import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type PagamentosService = {
  atualizarStatus: (
    id: number,
    status: string,
    extras?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(request: Request) {
  try {
    await requireLegacyUserId(request);
    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => parseInt(String(id), 10)).filter((n: number) => Number.isFinite(n) && n > 0)
      : body.pagamentoId
        ? [parseInt(String(body.pagamentoId), 10)]
        : [];
    if (!ids.length) {
      return NextResponse.json({ ok: false, error: "Nenhum pagamento informado" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<PagamentosService>("services/pagamentos.service");
    let validados = 0;
    for (const id of ids) {
      const res = await svc.atualizarStatus(id, "pago", { validadoManual: true });
      if (res.ok) validados += 1;
    }
    return NextResponse.json({
      ok: true,
      validados,
      message: `${validados} pagamento(s) validado(s)`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao validar pagamento";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
