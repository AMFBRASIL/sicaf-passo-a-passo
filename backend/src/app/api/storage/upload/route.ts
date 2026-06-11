import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StorageService = {
  adaptWebRequest: (request: Request) => { protocol: string; get: (name: string) => string } | null;
  fileFromBuffer: (input: {
    buffer: Buffer;
    originalName: string;
    mimetype: string;
  }) => {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
    path: null;
  };
  uploadFile: (
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
      path: null;
    },
    req: { protocol: string; get: (name: string) => string } | null,
    folder: string,
  ) => Promise<Record<string, unknown>>;
};

export async function POST(request: Request) {
  try {
    await requireLegacyUserId(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: 'Nenhum arquivo enviado (campo "file")' }, { status: 400 });
    }

    const url = new URL(request.url);
    const folder =
      url.searchParams.get("folder") ||
      (typeof formData.get("folder") === "string" ? String(formData.get("folder")) : null) ||
      "general";

    const originalName = file instanceof File && file.name ? file.name : "arquivo";
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimetype = file.type || "application/octet-stream";

    const storage = await getSicafAgentModule<StorageService>("services/storage.service");
    const reqLike = storage.adaptWebRequest(request);
    const multerLike = storage.fileFromBuffer({ buffer, originalName, mimetype });
    const result = await storage.uploadFile(multerLike, reqLike, folder);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no upload";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 400;
    console.error("[Storage:upload]", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
