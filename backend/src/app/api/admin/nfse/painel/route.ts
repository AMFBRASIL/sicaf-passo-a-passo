import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NfseFiscalService = {
  listarPainelAdmin: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
  cancelarFiscalEmissao: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
  obterArquivoEmissao: (opts: Record<string, unknown>) => Promise<{
    ok: boolean;
    error?: string;
    url?: string;
    buffer?: Buffer;
    filename?: string;
    contentType?: string;
  }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const url = new URL(request.url);
    const svc = await getSicafAgentModule<NfseFiscalService>("services/nfse-fiscal.service");

    const emissaoId = parseInt(url.searchParams.get("emissaoId") || "", 10);
    const tipo = url.searchParams.get("tipo");
    if (Number.isFinite(emissaoId) && emissaoId > 0 && (tipo === "pdf" || tipo === "xml")) {
      const result = await svc.obterArquivoEmissao({
        emissaoId,
        clienteId: url.searchParams.get("clienteId")
          ? parseInt(url.searchParams.get("clienteId") || "", 10)
          : undefined,
        tipo,
      });
      if (!result.ok) return NextResponse.json(result, { status: 404 });
      if (result.url) return NextResponse.redirect(result.url);
      if (result.buffer) {
        const disposition = url.searchParams.get("inline") === "1" ? "inline" : "attachment";
        return new NextResponse(new Uint8Array(result.buffer), {
          headers: {
            "Content-Type": result.contentType || "application/octet-stream",
            "Content-Disposition": `${disposition}; filename="${result.filename || "nfse.bin"}"`,
          },
        });
      }
      return NextResponse.json({ ok: false, error: "Arquivo indisponível" }, { status: 404 });
    }

    const result = await svc.listarPainelAdmin({
      page: parseInt(url.searchParams.get("page") || "1", 10),
      pageSize: parseInt(url.searchParams.get("pageSize") || "20", 10),
      status: url.searchParams.get("status") || "todos",
      q: url.searchParams.get("q") || "",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar painel fiscal";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireStaffAccess(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const svc = await getSicafAgentModule<NfseFiscalService>("services/nfse-fiscal.service");

    if (String(body.acao || "").toLowerCase() !== "cancelar") {
      return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
    }

    const emissaoId = Number(body.emissaoId);
    const clienteId = Number(body.clienteId);
    if (!emissaoId || !clienteId) {
      return NextResponse.json(
        { ok: false, error: "emissaoId e clienteId são obrigatórios" },
        { status: 400 },
      );
    }

    const result = await svc.cancelarFiscalEmissao({
      emissaoId,
      clienteId,
      usuarioId: auth.usuarioId,
      motivo: body.motivo || body.xMotivo,
      cMotivo: body.cMotivo || "1",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar NFS-e";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
