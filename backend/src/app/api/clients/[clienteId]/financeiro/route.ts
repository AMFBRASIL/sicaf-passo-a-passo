import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientsService = {
  getClientFinanceiro: (clienteId: number) => Promise<{ ok: boolean; error?: string }>;
};

type ClientAccessService = {
  assertClienteAcessivelById: (
    clienteId: number,
    usuarioId: number,
    jwtTipo?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

async function assertAccess(clienteId: number, usuarioId: number, tipo?: string) {
  const access = await getSicafAgentModule<ClientAccessService>("services/client-access.service");
  return access.assertClienteAcessivelById(clienteId, usuarioId, tipo);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ clienteId: string }> },
) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const { clienteId } = await context.params;
    const id = parseInt(clienteId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 });
    }

    const access = await assertAccess(id, usuarioId, tipo);
    if (!access.ok) {
      return NextResponse.json(access, { status: 404 });
    }

    const svc = await getSicafAgentModule<ClientsService>("services/clients.service");
    const result = await svc.getClientFinanceiro(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar financeiro";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
