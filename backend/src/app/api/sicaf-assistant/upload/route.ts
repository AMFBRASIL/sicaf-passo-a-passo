import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "Arquivo não enviado" }, { status: 400 });
    }

    const fileName =
      file instanceof File && file.name ? file.name : "documento.pdf";
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadPipeline = await getSicafAgentModule<{
      processPdfUpload: (
        buf: Buffer,
        name: string,
      ) => Promise<{
        ok: boolean;
        error?: string;
        status?: number;
        fileName?: string;
        textLength?: number;
        prompt?: string;
        dbResult?: unknown;
      }>;
    }>("upload-pipeline");

    const result = await uploadPipeline.processPdfUpload(buffer, fileName);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status || 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      fileName: result.fileName,
      textLength: result.textLength,
      prompt: result.prompt,
      dbResult: result.dbResult,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Erro interno";
    console.error("[SicafAssistant:upload]", errMsg);
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
