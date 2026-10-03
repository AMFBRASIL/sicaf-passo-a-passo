import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type Result = { ok: boolean; error?: string } & Record<string, unknown>;

type NovidadesService = {
  listar: (opts: { usuarioId: number }) => Promise<Result>;
  marcarVisto: (opts: { usuarioId: number; clienteId: number; servico: string }) => Promise<Result>;
};

type ClientAccessService = {
  assertClienteAcessivelById: (
    clienteId: number,
    usuarioId: number,
    jwtTipo?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

function erroResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Alertas dos serviços (CAUFESP, BLL, Licitações-e, PNCP) de todas as empresas do usuário. */
export async function GET(request: Request) {
  try {
    const { usuarioId } = await requireLegacyAuth(request);
    const svc = await getSicafAgentModule<NovidadesService>("services/servicos-novidades.service");
    const result = await svc.listar({ usuarioId });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return erroResponse(error, "Erro ao carregar novidades");
  }
}

/** Marca as novidades de um serviço como vistas ao abrir a página dele. */
export async function POST(request: Request) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const body = (await request.json()) as { clienteId?: unknown; servico?: unknown };
    const clienteId = Number(body.clienteId);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 });
    }
    const access = await getSicafAgentModule<ClientAccessService>("services/client-access.service");
    const acesso = await access.assertClienteAcessivelById(clienteId, usuarioId, tipo);
    if (!acesso.ok) return NextResponse.json(acesso, { status: 404 });

    const svc = await getSicafAgentModule<NovidadesService>("services/servicos-novidades.service");
    const result = await svc.marcarVisto({ usuarioId, clienteId, servico: String(body.servico || "") });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return erroResponse(error, "Erro ao registrar visualização");
  }
}
