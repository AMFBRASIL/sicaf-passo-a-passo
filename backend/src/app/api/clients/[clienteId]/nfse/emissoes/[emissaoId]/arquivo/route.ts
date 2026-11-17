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
  obterArquivoEmissao: (opts: {
    clienteId: number;
    emissaoId: number;
    tipo?: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    url?: string;
    buffer?: Buffer;
    filename?: string;
    contentType?: string;
  }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ clienteId: string; emissaoId: string }> },
) {
  try {
    const auth = await requireLegacyAuth(request);
    const { clienteId, emissaoId } = await context.params;
    const id = parseInt(clienteId, 10);
    const eid = parseInt(emissaoId, 10);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(eid) || eid <= 0) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const access = await getSicafAgentModule<AccessService>("services/client-access.service");
    const allowed = await access.assertClienteAcessivelById(id, auth.usuarioId, auth.tipo);
    if (!allowed.ok) {
      return NextResponse.json({ ok: false, error: allowed.error || "Sem permissão" }, { status: 403 });
    }

    const url = new URL(request.url);
    const tipo = url.searchParams.get("tipo") || "xml";

    const svc = await getSicafAgentModule<NfseFiscalService>("services/nfse-fiscal.service");
    const result = await svc.obterArquivoEmissao({ clienteId: id, emissaoId: eid, tipo });
    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }
    if (result.url) {
      return NextResponse.redirect(result.url);
    }
    if (result.buffer) {
      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          "Content-Type": result.contentType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${result.filename || "nfse.bin"}"`,
        },
      });
    }
    return NextResponse.json({ ok: false, error: "Arquivo indisponível" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao baixar arquivo";
    const statusCode =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status: statusCode });
  }
}
