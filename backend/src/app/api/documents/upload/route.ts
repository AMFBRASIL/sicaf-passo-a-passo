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
  ) => Promise<{ fullUrl?: string; url?: string; originalName?: string }>;
};

type DocumentsService = {
  createDocument: (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; documentId?: number }>;
};

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const clienteId = formData.get("clienteId") ? parseInt(String(formData.get("clienteId")), 10) : null;
    const nome = String(formData.get("nome") || (file instanceof File ? file.name : "documento"));
    const pasta = String(formData.get("pasta") || "Geral");
    const nivelSicaf = formData.get("nivelSicaf") ? String(formData.get("nivelSicaf")) : null;
    const dataValidade = formData.get("dataValidade") ? String(formData.get("dataValidade")) : null;

    const originalName = file instanceof File && file.name ? file.name : "documento";
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = originalName.split(".").pop()?.toLowerCase() || "";
    let tipoArquivo = "Outro";
    if (ext === "pdf") tipoArquivo = "PDF";
    else if (["xlsx", "xls", "csv"].includes(ext)) tipoArquivo = "Excel";
    else if (["doc", "docx"].includes(ext)) tipoArquivo = "Word";
    else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) tipoArquivo = "Imagem";

    const sizeBytes = buffer.length;
    const tamanho =
      sizeBytes < 1024
        ? `${sizeBytes} B`
        : sizeBytes < 1024 * 1024
          ? `${(sizeBytes / 1024).toFixed(0)} KB`
          : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

    const folder = clienteId ? `clientes/${clienteId}/documentos` : "documents";
    const storage = await getSicafAgentModule<StorageService>("services/storage.service");
    const reqLike = storage.adaptWebRequest(request);
    const multerLike = storage.fileFromBuffer({
      buffer,
      originalName,
      mimetype: file.type || "application/octet-stream",
    });
    const fileResult = await storage.uploadFile(multerLike, reqLike, folder);

    const docs = await getSicafAgentModule<DocumentsService>("services/documents.service");
    const docResult = await docs.createDocument({
      clienteId,
      nome,
      pasta,
      tipoArquivo,
      tamanho,
      nivelSicaf,
      dataValidade,
      arquivoUrl: fileResult.fullUrl || fileResult.url,
      uploadedBy: usuarioId,
    });

    return NextResponse.json({ ...docResult, arquivo: fileResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no upload";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
