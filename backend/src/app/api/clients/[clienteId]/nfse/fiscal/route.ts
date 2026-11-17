import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccessService = {
  assertClienteAcessivelById: (
    clienteId: number,
    usuarioId: number,
    jwtTipo?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

type NfseFiscalService = {
  listarFiscalCliente: (clienteId: number) => Promise<Record<string, unknown>>;
  emitirFiscalPagamento: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
  cancelarFiscalEmissao: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ clienteId: string }> },
) {
  try {
    const auth = await requireLegacyAuth(request);
    const { clienteId } = await context.params;
    const id = parseInt(clienteId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 });
    }

    const access = await getSicafAgentModule<AccessService>("services/client-access.service");
    const allowed = await access.assertClienteAcessivelById(id, auth.usuarioId, auth.tipo);
    if (!allowed.ok) {
      return NextResponse.json({ ok: false, error: allowed.error || "Sem permissão" }, { status: 403 });
    }

    const svc = await getSicafAgentModule<NfseFiscalService>("services/nfse-fiscal.service");
    const result = await svc.listarFiscalCliente(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar fiscal";
    const statusCode =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status: statusCode });
  }
}

/** Emite NFS-e CadBrasil para um pagamento pago do cliente. */
export async function POST(
  request: Request,
  context: { params: Promise<{ clienteId: string }> },
) {
  try {
    const auth = await requireLegacyAuth(request);
    const { clienteId } = await context.params;
    const id = parseInt(clienteId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 });
    }

    const access = await getSicafAgentModule<AccessService>("services/client-access.service");
    const allowed = await access.assertClienteAcessivelById(id, auth.usuarioId, auth.tipo);
    if (!allowed.ok) {
      return NextResponse.json({ ok: false, error: allowed.error || "Sem permissão" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const svc = await getSicafAgentModule<NfseFiscalService>("services/nfse-fiscal.service");
    const acao = String(body.acao || "emitir").toLowerCase();

    const result =
      acao === "cancelar"
        ? await svc.cancelarFiscalEmissao({
            ...body,
            clienteId: id,
            usuarioId: auth.usuarioId,
          })
        : await svc.emitirFiscalPagamento({
            ...body,
            clienteId: id,
            usuarioId: auth.usuarioId,
          });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na operação fiscal NFS-e";
    const statusCode =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status: statusCode });
  }
}
