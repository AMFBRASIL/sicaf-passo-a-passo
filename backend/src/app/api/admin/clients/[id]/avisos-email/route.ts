import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailAvisosService = {
  previewAviso: (opts: {
    templateDbId: number;
    clienteId: number;
    mensagemAdicional?: string;
    assuntoCustom?: string;
  }) => Promise<{ ok: boolean; preview?: unknown; error?: string }>;
  enviarAvisoCliente: (opts: {
    clienteId: number;
    templateDbId: number;
    to: string;
    cc?: string;
    mensagemAdicional?: string;
    assuntoCustom?: string;
    usuarioId: number;
  }) => Promise<{ ok: boolean; message?: string; simulado?: boolean; error?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const action = String(body.action || "enviar");

    const svc = await getSicafAgentModule<EmailAvisosService>("services/email-avisos.service");

    const templateDbId = parseInt(String(body.templateDbId ?? body.templateId ?? ""), 10);

    if (action === "preview") {
      if (!Number.isFinite(templateDbId) || templateDbId <= 0) {
        return NextResponse.json({ ok: false, error: "Template obrigatório" }, { status: 400 });
      }
      const result = await svc.previewAviso({
        templateDbId,
        clienteId,
        mensagemAdicional: body.mensagemAdicional,
        assuntoCustom: body.assuntoCustom,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const to = String(body.to || "").trim();
    if (!Number.isFinite(templateDbId) || templateDbId <= 0) {
      return NextResponse.json({ ok: false, error: "Template obrigatório" }, { status: 400 });
    }
    if (!to) {
      return NextResponse.json({ ok: false, error: "E-mail do destinatário obrigatório" }, { status: 400 });
    }

    const result = await svc.enviarAvisoCliente({
      clienteId,
      templateDbId,
      to,
      cc: body.cc,
      mensagemAdicional: body.mensagemAdicional,
      assuntoCustom: body.assuntoCustom,
      usuarioId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar aviso";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
