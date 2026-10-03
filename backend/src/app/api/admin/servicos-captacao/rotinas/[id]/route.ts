import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type CaptacaoService = {
  alterarRotina: (opts: { id: string; acao: string }) => Promise<Record<string, unknown> & { ok: boolean }>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { acao?: string };
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    const result = await svc.alterarRotina({ id, acao: String(body.acao || "") });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na rotina";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
