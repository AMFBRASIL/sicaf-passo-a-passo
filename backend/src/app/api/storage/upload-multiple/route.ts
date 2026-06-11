import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MulterLikeFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  path: null;
};

type StorageService = {
  adaptWebRequest: (request: Request) => { protocol: string; get: (name: string) => string } | null;
  fileFromBuffer: (input: {
    buffer: Buffer;
    originalName: string;
    mimetype: string;
  }) => MulterLikeFile;
  uploadFiles: (
    files: MulterLikeFile[],
    req: { protocol: string; get: (name: string) => string } | null,
    folder: string,
  ) => Promise<Record<string, unknown>[]>;
};

export async function POST(request: Request) {
  try {
    await requireLegacyUserId(request);
    const formData = await request.formData();
    const entries = formData.getAll("files");

    if (!entries.length) {
      return NextResponse.json({ ok: false, error: 'Nenhum arquivo enviado (campo "files")' }, { status: 400 });
    }

    const url = new URL(request.url);
    const folder = url.searchParams.get("folder") || "general";

    const storage = await getSicafAgentModule<StorageService>("services/storage.service");
    const reqLike = storage.adaptWebRequest(request);

    const files: MulterLikeFile[] = [];
    for (const entry of entries) {
      if (!(entry instanceof Blob)) continue;
      const originalName = entry instanceof File && entry.name ? entry.name : "arquivo";
      const buffer = Buffer.from(await entry.arrayBuffer());
      files.push(
        storage.fileFromBuffer({
          buffer,
          originalName,
          mimetype: entry.type || "application/octet-stream",
        }),
      );
    }

    if (!files.length) {
      return NextResponse.json({ ok: false, error: "Nenhum arquivo válido enviado" }, { status: 400 });
    }

    const results = await storage.uploadFiles(files, reqLike, folder);
    return NextResponse.json({ ok: true, files: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no upload múltiplo";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 400;
    console.error("[Storage:upload-multiple]", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
