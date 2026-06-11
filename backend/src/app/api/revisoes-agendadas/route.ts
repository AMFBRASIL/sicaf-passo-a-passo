import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RevisoesService = {
  listarRevisoesAgendadas: (usuarioId: number) => Promise<{
    ok: boolean;
    agendamentos?: unknown[];
    error?: string;
  }>;
  criarRevisaoAgendada: (payload: {
    usuarioId: number;
    clienteId: number;
    meses: number;
    jwtTipo?: string;
  }) => Promise<{ ok: boolean; agendamento?: unknown; error?: string }>;
};

export async function GET(request: Request) {
  try {
    const { usuarioId } = await requireLegacyAuth(request);
    const svc = await getSicafAgentModule<RevisoesService>("services/revisoes-agendadas.service");
    const result = await svc.listarRevisoesAgendadas(usuarioId);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar revisões";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const body = await request.json();
    const clienteId = parseInt(String(body.clienteId), 10);
    const meses = parseInt(String(body.meses), 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "clienteId é obrigatório" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<RevisoesService>("services/revisoes-agendadas.service");
    const result = await svc.criarRevisaoAgendada({
      usuarioId,
      clienteId,
      meses,
      jwtTipo: tipo,
    });
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao agendar revisão";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
