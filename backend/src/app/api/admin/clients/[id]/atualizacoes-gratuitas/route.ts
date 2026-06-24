import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AtualizacoesSicafService = {
  getAdminAtualizacoesGratuitas: (clienteId: number) => Promise<Record<string, unknown>>;
  ajustarDisponiveisGratuitas: (
    clienteId: number,
    usuarioId: number,
    disponiveis: number,
    motivo?: string,
  ) => Promise<Record<string, unknown>>;
};

function parseClienteId(id: string): number | null {
  const clienteId = parseInt(id, 10);
  if (!Number.isFinite(clienteId) || clienteId <= 0) return null;
  return clienteId;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const clienteId = parseClienteId(id);
    if (!clienteId) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<AtualizacoesSicafService>(
      "services/atualizacoes-sicaf.service",
    );
    const result = await svc.getAdminAtualizacoesGratuitas(clienteId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar cota";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { id } = await context.params;
    const clienteId = parseClienteId(id);
    if (!clienteId) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const disponiveis = parseInt(String(body.disponiveis ?? ""), 10);
    const motivo = String(body.motivo || "").trim();

    const svc = await getSicafAgentModule<AtualizacoesSicafService>(
      "services/atualizacoes-sicaf.service",
    );
    const result = await svc.ajustarDisponiveisGratuitas(
      clienteId,
      usuarioId,
      disponiveis,
      motivo || undefined,
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao ajustar cota";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
