import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutomacoesService = {
  listFluxos: () => Promise<{ ok: boolean; fluxos?: unknown[]; error?: string }>;
  salvarFluxo: (fluxo: Record<string, unknown>) => Promise<{
    ok: boolean;
    fluxo?: unknown;
    error?: string;
    message?: string;
  }>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const svc = await getSicafAgentModule<AutomacoesService>("services/automacoes.service");
    const result = await svc.listFluxos();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar fluxos";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const svc = await getSicafAgentModule<AutomacoesService>("services/automacoes.service");
    const result = await svc.salvarFluxo(body);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar fluxo";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
