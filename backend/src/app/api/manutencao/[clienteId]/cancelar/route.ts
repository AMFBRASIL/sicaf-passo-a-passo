import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type ManutencaoService = {
  cancelarManutencao: (payload: {
    clienteId: number;
    usuarioId: number;
    motivo?: string;
    jwtTipo?: string;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ clienteId: string }> },
) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const { clienteId } = await context.params;
    const id = parseInt(clienteId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 });
    }

    let motivo: string | undefined;
    try {
      const body = await request.json();
      if (body.motivo != null) motivo = String(body.motivo);
    } catch {
      /* body opcional */
    }

    const svc = await getSicafAgentModule<ManutencaoService>("services/manutencao.service");
    if (typeof svc.cancelarManutencao !== "function") {
      return NextResponse.json(
        { ok: false, error: "Função cancelarManutencao indisponível. Reinicie o backend (npm run dev)." },
        { status: 500 },
      );
    }
    const result = await svc.cancelarManutencao({ clienteId: id, usuarioId, motivo, jwtTipo: tipo });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar manutenção";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
