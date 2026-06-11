import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContratosService = {
  getContratoAdmin: (clienteId: number) => Promise<{ ok: boolean; contrato?: unknown; error?: string }>;
  salvarContratoAdmin: (opts: Record<string, unknown>) => Promise<{
    ok: boolean;
    contrato?: unknown;
    message?: string;
    error?: string;
  }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireLegacyUserId(request);
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<ContratosService>("services/contratos-digitais.service");
    const result = await svc.getContratoAdmin(clienteId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar contrato";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireLegacyUserId(request);
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const body = await request.json();
    const svc = await getSicafAgentModule<ContratosService>("services/contratos-digitais.service");
    const result = await svc.salvarContratoAdmin({
      clienteId,
      contratoId: body.contratoId,
      plano: body.plano,
      dataInicio: body.dataInicio,
      dataVencimento: body.dataVencimento,
      status: body.status,
      assinadoPor: body.assinadoPor,
      assinadoEm: body.assinadoEm,
      valorMensal: body.valorMensal,
      vigenciaMeses: body.vigenciaMeses,
      emailSignatario: body.emailSignatario,
      observacoes: body.observacoes,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar contrato";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
