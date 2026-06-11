import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type PagamentosService = {
  gerarPixManutencao: (opts: {
    boletoId: number;
    clienteId: number;
    geradoPor?: number;
  }) => Promise<{ ok: boolean; error?: string; [key: string]: unknown }>;
};

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const data = await request.json();

    const boletoId = parseInt(String(data.boletoId), 10);
    const clienteId = parseInt(String(data.clienteId), 10);
    if (!Number.isFinite(boletoId) || boletoId <= 0 || !Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "boletoId e clienteId são obrigatórios" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<PagamentosService>("services/pagamentos.service");
    const result = await svc.gerarPixManutencao({
      boletoId,
      clienteId,
      geradoPor: usuarioId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar PIX";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
