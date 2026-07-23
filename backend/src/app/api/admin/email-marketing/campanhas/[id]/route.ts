import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Envios grandes (centenas de e-mails) podem levar vários minutos. */
export const maxDuration = 800;

type EmailMktService = {
  sendCampanha: (
    id: number,
    opts?: {
      usuarioId?: number;
      limit?: number;
      onProgress?: (event: Record<string, unknown>) => void;
    },
  ) => Promise<Record<string, unknown>>;
  pauseCampanha: (id: number) => Promise<Record<string, unknown>>;
  duplicateCampanha: (id: number, usuarioId: number) => Promise<Record<string, unknown>>;
  cancelCampanha: (id: number) => Promise<Record<string, unknown>>;
  deleteCampanha: (id: number) => Promise<Record<string, unknown>>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { id } = await context.params;
    const campanhaId = parseInt(id, 10);
    if (!campanhaId) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      stream?: boolean;
    };
    const action = String(body.action || "send");
    const svc = await getSicafAgentModule<EmailMktService>(
      "services/admin-email-marketing.service",
    );

    if (action === "duplicate") {
      const result = await svc.duplicateCampanha(campanhaId, usuarioId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    if (action === "cancel") {
      const result = await svc.cancelCampanha(campanhaId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    if (action === "pause") {
      const result = await svc.pauseCampanha(campanhaId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const wantStream = action === "send-stream" || body.stream === true;
    if (!wantStream) {
      const result = await svc.sendCampanha(campanhaId, { usuarioId });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const write = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        try {
          await svc.sendCampanha(campanhaId, {
            usuarioId,
            onProgress: write,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro no envio";
          write({ type: "error", ok: false, error: message });
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na campanha";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(_request);
    const { id } = await context.params;
    const campanhaId = parseInt(id, 10);
    if (!campanhaId) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<EmailMktService>(
      "services/admin-email-marketing.service",
    );
    const result = await svc.deleteCampanha(campanhaId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir campanha";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
