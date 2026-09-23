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

type CancelamentoService = {
  responderSolicitacao: (
    id: number | string,
    opts: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { id } = await context.params;

    const contentType = request.headers.get("content-type") || "";
    let mensagem = "";
    let assunto = "";
    let status = "";
    let emailDestino = "";
    let interno = false;
    let enviarEmail = true;
    let observacoesInternas = "";
    const anexosUpload: {
      nomeOriginal: string;
      mimeType: string | null;
      tamanho: number;
      url: string;
    }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      mensagem = String(formData.get("mensagem") || "");
      assunto = String(formData.get("assunto") || "");
      status = String(formData.get("status") || "");
      emailDestino = String(formData.get("emailDestino") || "");
      interno = String(formData.get("interno") || "") === "1" || String(formData.get("interno") || "") === "true";
      enviarEmail = String(formData.get("enviarEmail") || "1") !== "0" && String(formData.get("enviarEmail") || "") !== "false";
      observacoesInternas = String(formData.get("observacoesInternas") || "");

      const storage = await getSicafAgentModule<StorageService>("services/storage.service");
      const reqLike = storage.adaptWebRequest(request);
      const files = formData.getAll("files").filter((f) => f instanceof Blob) as Blob[];

      for (const file of files) {
        const originalName = file instanceof File && file.name ? file.name : "anexo";
        const buffer = Buffer.from(await file.arrayBuffer());
        const mimetype = file.type || "application/octet-stream";
        const multerLike = storage.fileFromBuffer({ buffer, originalName, mimetype });
        const uploaded = await storage.uploadFile(multerLike, reqLike, "cancelamentos");
        const url = String(uploaded.url || uploaded.publicUrl || uploaded.path || "");
        if (!url) continue;
        anexosUpload.push({
          nomeOriginal: String(uploaded.originalName || originalName),
          mimeType: mimetype,
          tamanho: buffer.length,
          url,
        });
      }
    } else {
      const body = await request.json();
      mensagem = String(body.mensagem || "");
      assunto = String(body.assunto || "");
      status = String(body.status || "");
      emailDestino = String(body.emailDestino || "");
      interno = body.interno === true || body.interno === 1 || body.interno === "1";
      enviarEmail = body.enviarEmail !== false;
      observacoesInternas = String(body.observacoesInternas || "");
    }

    const svc = await getSicafAgentModule<CancelamentoService>(
      "services/solicitacoes-cancelamento.service",
    );
    const result = await svc.responderSolicitacao(id, {
      mensagem,
      assunto,
      status: status || undefined,
      emailDestino: emailDestino || undefined,
      interno,
      enviarEmail,
      observacoesInternas: observacoesInternas || undefined,
      usuarioId,
      anexosUpload,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao responder solicitação";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
