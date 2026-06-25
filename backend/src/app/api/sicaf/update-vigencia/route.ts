import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SicafUpdateVigenciaService = {
  updateSicafVigencia: (opts: {
    sicafId?: number;
    clienteId?: number;
    novaDataValidade?: string;
    adicionarAnos?: number;
    usuarioId: number;
    mensagem?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const body = await request.json();
    const sicafId = body.sicafId != null ? parseInt(String(body.sicafId), 10) : undefined;
    const clienteId = body.clienteId != null ? parseInt(String(body.clienteId), 10) : undefined;
    const novaDataValidade = body.novaDataValidade
      ? String(body.novaDataValidade).trim()
      : body.dataValidade
        ? String(body.dataValidade).trim()
        : undefined;
    const adicionarAnos =
      body.adicionarAnos != null ? parseInt(String(body.adicionarAnos), 10) : undefined;
    const mensagem = body.mensagem ? String(body.mensagem).trim() : undefined;

    if (
      (!Number.isFinite(sicafId) || !sicafId || sicafId <= 0) &&
      (!Number.isFinite(clienteId) || !clienteId || clienteId <= 0)
    ) {
      return NextResponse.json(
        { ok: false, error: "sicafId ou clienteId é obrigatório" },
        { status: 400 },
      );
    }

    const svc = await getSicafAgentModule<SicafUpdateVigenciaService>(
      "services/sicaf-update-status.service",
    );
    const result = await svc.updateSicafVigencia({
      sicafId: Number.isFinite(sicafId) && sicafId! > 0 ? sicafId : undefined,
      clienteId: Number.isFinite(clienteId) && clienteId! > 0 ? clienteId : undefined,
      novaDataValidade,
      adicionarAnos: Number.isFinite(adicionarAnos) ? adicionarAnos : undefined,
      usuarioId,
      mensagem,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao alterar vigência";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
