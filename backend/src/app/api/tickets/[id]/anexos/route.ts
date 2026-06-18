import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StorageService = {
  adaptWebRequest: (request: Request) => { protocol: string; get: (name: string) => string } | null;
  fileFromBuffer: (input: { buffer: Buffer; originalName: string; mimetype: string }) => {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
    path: null;
  };
  uploadFile: (
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number; path: null },
    req: { protocol: string; get: (name: string) => string } | null,
    folder: string,
  ) => Promise<Record<string, unknown>>;
};

type TicketsService = {
  adicionarAnexo: (
    ticketId: string,
    usuarioId: number,
    fileInfo: Record<string, unknown>,
    mensagemId?: number | null,
  ) => Promise<{ ok: boolean; error?: string; anexo?: unknown }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { id } = await context.params;
    const ticketId = decodeURIComponent(id);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: 'Nenhum arquivo enviado (campo "file")' }, { status: 400 });
    }

    const mensagemIdRaw = formData.get("mensagemId");
    const mensagemId =
      mensagemIdRaw != null && String(mensagemIdRaw).trim() !== ""
        ? parseInt(String(mensagemIdRaw), 10)
        : null;

    const originalName = file instanceof File && file.name ? file.name : "arquivo";
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimetype = file.type || "application/octet-stream";

    const storage = await getSicafAgentModule<StorageService>("services/storage.service");
    const reqLike = storage.adaptWebRequest(request);
    const multerLike = storage.fileFromBuffer({ buffer, originalName, mimetype });
    const folder = `tickets/${ticketId.replace(/[^\w-]/g, "_")}`;
    const fileResult = await storage.uploadFile(multerLike, reqLike, folder);

    const tickets = await getSicafAgentModule<TicketsService>("services/tickets.service");
    const result = await tickets.adicionarAnexo(
      ticketId,
      usuarioId,
      {
        ...fileResult,
        originalName: fileResult.originalName || originalName,
        size: buffer.length,
        mimetype,
      },
      Number.isFinite(mensagemId) ? mensagemId : null,
    );

    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao anexar arquivo";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    console.error("[Tickets:anexos]", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
