import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuporteRemotoService = {
  pollSessao: (
    usuarioId: number,
    sessaoId: number,
    opts: Record<string, unknown>,
    role: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  enviarMensagem: (
    usuarioId: number,
    sessaoId: number,
    texto: string,
    role: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  enviarSinal: (
    usuarioId: number,
    sessaoId: number,
    dados: Record<string, unknown>,
    role: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  atualizarStatus: (
    usuarioId: number,
    sessaoId: number,
    dados: Record<string, unknown>,
    role: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

async function getSvc() {
  return getSicafAgentModule<SuporteRemotoService>("services/suporte-remoto.service");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { id } = await context.params;
    const url = new URL(request.url);
    const svc = await getSvc();
    const result = await svc.pollSessao(
      usuarioId,
      Number(id),
      {
        afterMessage: url.searchParams.get("afterMessage") || "0",
        afterSignal: url.searchParams.get("afterSignal") || "0",
      },
      "cliente",
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar atendimento";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const acao = String(body.acao || "").toLowerCase();
    const svc = await getSvc();
    const sessaoId = Number(id);

    if (acao === "mensagem") {
      const result = await svc.enviarMensagem(usuarioId, sessaoId, String(body.texto || ""), "cliente");
      return NextResponse.json(result, { status: result.ok ? 201 : 400 });
    }
    if (acao === "sinal") {
      const result = await svc.enviarSinal(usuarioId, sessaoId, body, "cliente");
      return NextResponse.json(result, { status: result.ok ? 201 : 400 });
    }

    const result = await svc.atualizarStatus(usuarioId, sessaoId, body, "cliente");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no atendimento remoto";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
