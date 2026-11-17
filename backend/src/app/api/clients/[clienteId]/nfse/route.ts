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

type NfseService = {
  listarEmissoes: (opts: {
    clienteId: number;
    limit?: number;
    status?: string;
  }) => Promise<Record<string, unknown>>;
  emitir: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
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

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "30", 10);
    const status = url.searchParams.get("status") || undefined;

    const svc = await getSicafAgentModule<NfseService>("services/nfse.service");
    const result = await svc.listarEmissoes({ clienteId: id, limit, status: status || undefined });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar NFS-e";
    const statusCode =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status: statusCode });
  }
}

/** Emite NFS-e para o cliente (certificado A1 do cliente, ou useSystemCert). */
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
    const svc = await getSicafAgentModule<NfseService>("services/nfse.service");
    const result = await svc.emitir({
      ...body,
      clienteId: id,
      usuarioId: auth.usuarioId,
      useSystemCert: body.useSystemCert === true,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao emitir NFS-e";
    const statusCode =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status: statusCode });
  }
}
