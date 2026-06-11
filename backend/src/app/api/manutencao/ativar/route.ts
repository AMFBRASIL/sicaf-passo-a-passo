import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type ManutencaoService = {
  ativarManutencao: (payload: {
    clienteId: number;
    usuarioId: number;
    diaVencimento: number;
    parcelamento?: string;
    jwtTipo?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(request: Request) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const body = await request.json();
    const clienteId = parseInt(String(body.clienteId), 10);
    const diaVencimento = parseInt(String(body.diaVencimento), 10);
    if (!Number.isFinite(clienteId) || !Number.isFinite(diaVencimento)) {
      return NextResponse.json({ ok: false, error: "clienteId e diaVencimento são obrigatórios" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<ManutencaoService>("services/manutencao.service");
    const result = await svc.ativarManutencao({
      clienteId,
      usuarioId,
      diaVencimento,
      parcelamento: body.parcelamento,
      jwtTipo: tipo,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao ativar manutenção";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
