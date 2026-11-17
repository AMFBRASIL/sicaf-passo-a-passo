import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NfseService = {
  getStatusConfig: () => Promise<Record<string, unknown>>;
  listarEmissoes: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
  emitir: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
  consultarPorChave: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const url = new URL(request.url);
    const clienteIdRaw = url.searchParams.get("clienteId");
    const clienteId = clienteIdRaw ? parseInt(clienteIdRaw, 10) : undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const svc = await getSicafAgentModule<NfseService>("services/nfse.service");
    if (url.searchParams.get("statusOnly") === "1") {
      return NextResponse.json(await svc.getStatusConfig());
    }

    const result = await svc.listarEmissoes({
      clienteId: Number.isFinite(clienteId) ? clienteId : undefined,
      limit,
      status: url.searchParams.get("status") || undefined,
    });
    const statusCfg = await svc.getStatusConfig();
    return NextResponse.json({ ...statusCfg, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar NFS-e";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

/** Emite NFS-e com certificado do sistema (CadBrasil) ou do cliente. */
export async function POST(request: Request) {
  try {
    const auth = await requireStaffAccess(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const svc = await getSicafAgentModule<NfseService>("services/nfse.service");

    if (body.acao === "consultar" || body.chaveAcesso) {
      const result = await svc.consultarPorChave({
        chaveAcesso: body.chaveAcesso,
        clienteId: body.clienteId,
        useSystemCert: body.useSystemCert !== false,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const result = await svc.emitir({
      ...body,
      usuarioId: auth.usuarioId,
      useSystemCert: body.useSystemCert !== false,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao emitir NFS-e";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
