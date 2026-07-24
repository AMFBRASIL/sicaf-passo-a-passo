import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutomacoesService = {
  toggleFluxo: (
    id: string,
    ativo?: boolean,
  ) => Promise<{ ok: boolean; fluxo?: unknown; error?: string; message?: string }>;
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as {
      ativo?: boolean;
      nome?: string;
      gatilhoTipo?: string;
      acoes?: unknown[];
    };

    const svc = await getSicafAgentModule<AutomacoesService>("services/automacoes.service");

    // Toggle rápido (só ativo) ou update completo
    if (body.nome || body.gatilhoTipo || body.acoes) {
      const result = await svc.salvarFluxo({ ...body, id });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const result = await svc.toggleFluxo(id, body.ativo);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar fluxo";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
