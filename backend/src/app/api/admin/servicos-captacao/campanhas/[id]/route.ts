import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resultado = Promise<Record<string, unknown> & { ok: boolean; error?: string }>;

type CaptacaoService = {
  alterarCampanha: (opts: { id: string; acao: string }) => Resultado;
  logCampanha: (opts: { id: string }) => Resultado;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    const result = await svc.logCampanha({ id });
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar log";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { acao?: string };
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    const result = await svc.alterarCampanha({ id, acao: String(body.acao || "") });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na campanha";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
