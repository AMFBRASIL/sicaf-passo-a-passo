import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CertificadoDigitalService = {
  getCertificadoDownload: (clienteId: number) => Promise<{
    ok: boolean;
    buffer?: Buffer;
    filename?: string;
    error?: string;
  }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<CertificadoDigitalService>(
      "services/certificado-digital.service",
    );
    const dl = await svc.getCertificadoDownload(clienteId);
    if (!dl.ok || !dl.buffer) {
      return NextResponse.json(
        { ok: false, error: dl.error || "Certificado não disponível" },
        { status: 404 },
      );
    }

    const filename = dl.filename || `certificado_cliente_${clienteId}.pfx`;
    return new NextResponse(new Uint8Array(dl.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/x-pkcs12",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(dl.buffer.length),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao baixar certificado";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
