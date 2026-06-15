import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AiReaderService = {
  analisarDocumentoPersonalizado: (
    usuarioId: number,
    filePath: string,
    fileName: string,
    fileSize: number,
    opts: { pergunta?: string; objetivo?: string; modulo?: string },
  ) => Promise<{ ok: boolean; texto?: string; error?: string; meta?: Record<string, unknown> }>;
};

export async function POST(request: Request) {
  let tempPath: string | null = null;
  try {
    const usuarioId = await requireLegacyUserId(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "Arquivo não enviado" }, { status: 400 });
    }

    const fileName = file instanceof File && file.name ? file.name : "documento.pdf";
    const buffer = Buffer.from(await file.arrayBuffer());
    tempPath = path.join(
      os.tmpdir(),
      `doc-ia-${Date.now()}-${fileName.replace(/[^\w.-]/g, "_")}`,
    );
    fs.writeFileSync(tempPath, buffer);

    const pergunta = String(formData.get("pergunta") || formData.get("prompt") || "").trim();
    const objetivo = String(formData.get("objetivo") || "geral").trim();
    const modulo = String(formData.get("modulo") || "assistente").trim();

    const svc = await getSicafAgentModule<AiReaderService>("services/ai-reader.service");
    const result = await svc.analisarDocumentoPersonalizado(
      usuarioId,
      tempPath,
      fileName,
      buffer.length,
      { pergunta, objetivo, modulo },
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao analisar documento";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }
  }
}
