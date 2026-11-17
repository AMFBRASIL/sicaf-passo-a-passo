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
  consultarPorChave: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
  consultarDps: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

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

    const opts = {
      clienteId: id,
      useSystemCert: body.useSystemCert === true,
      senhaCertificado: body.senhaCertificado,
    };

    if (body.chaveAcesso || body.chave) {
      const result = await svc.consultarPorChave({
        ...opts,
        chaveAcesso: body.chaveAcesso || body.chave,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (body.idDps || body.id) {
      const result = await svc.consultarDps({
        ...opts,
        idDps: body.idDps || body.id,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    return NextResponse.json(
      { ok: false, error: "Informe chaveAcesso ou idDps para consulta." },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar NFS-e";
    const statusCode =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status: statusCode });
  }
}
