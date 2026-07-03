import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
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

type AdminCrmService = {
  adicionarAnexo: (
    cardId: string,
    fileInfo: Record<string, unknown>,
    usuarioId: number,
    tipo?: string,
  ) => Promise<{ ok: boolean; error?: string; anexo?: unknown }>;
  removerAnexo: (anexoId: number, usuarioId: number) => Promise<{ ok: boolean; error?: string; url?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { id } = await context.params;
    const cardId = decodeURIComponent(id);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: 'Nenhum arquivo enviado (campo "file")' }, { status: 400 });
    }

    const tipo = String(formData.get("tipo") || "outro");
    const originalName = file instanceof File && file.name ? file.name : "arquivo";
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimetype = file.type || "application/octet-stream";

    const storage = await getSicafAgentModule<StorageService>("services/storage.service");
    const reqLike = storage.adaptWebRequest(request);
    const multerLike = storage.fileFromBuffer({ buffer, originalName, mimetype });
    const folder = `crm/${cardId.replace(/[^\w-]/g, "_")}`;
    const fileResult = await storage.uploadFile(multerLike, reqLike, folder);

    const crm = await getSicafAgentModule<AdminCrmService>("services/admin-crm.service");
    const result = await crm.adicionarAnexo(
      cardId,
      {
        ...fileResult,
        originalName: fileResult.originalName || originalName,
        size: buffer.length,
        mimetype,
      },
      usuarioId,
      tipo,
    );

    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao anexar arquivo";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const url = new URL(request.url);
    const anexoId = parseInt(url.searchParams.get("anexoId") || "", 10);
    if (!Number.isFinite(anexoId)) {
      return NextResponse.json({ ok: false, error: "anexoId inválido" }, { status: 400 });
    }

    await context.params;
    const crm = await getSicafAgentModule<AdminCrmService>("services/admin-crm.service");
    const result = await crm.removerAnexo(anexoId, usuarioId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao remover anexo";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
