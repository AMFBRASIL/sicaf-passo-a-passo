import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuporteRemotoService = {
  entrarComoAtendente: (usuarioId: number, codigo: string) => Promise<{ ok: boolean; error?: string }>;
};

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = (await request.json().catch(() => ({}))) as { codigo?: string };
    const svc = await getSicafAgentModule<SuporteRemotoService>("services/suporte-remoto.service");
    const result = await svc.entrarComoAtendente(usuarioId, body.codigo || "");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao entrar no atendimento";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
