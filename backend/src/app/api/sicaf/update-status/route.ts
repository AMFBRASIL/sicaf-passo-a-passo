import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SicafUpdateStatusService = {
  updateSicafStatusManual: (opts: {
    sicafId: number;
    status: string;
    usuarioId: number;
    mensagem?: string;
    dataInicio?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const body = await request.json();
    const sicafId = parseInt(String(body.sicafId ?? ""), 10);
    const status = String(body.status || "").trim();
    const mensagem = body.mensagem ? String(body.mensagem).trim() : undefined;
    const dataInicio = body.dataInicio ? String(body.dataInicio).trim() : undefined;

    if (!Number.isFinite(sicafId) || sicafId <= 0) {
      return NextResponse.json({ ok: false, error: "sicafId é obrigatório" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<SicafUpdateStatusService>(
      "services/sicaf-update-status.service",
    );
    const result = await svc.updateSicafStatusManual({
      sicafId,
      status,
      usuarioId,
      mensagem,
      dataInicio,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao alterar status";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
