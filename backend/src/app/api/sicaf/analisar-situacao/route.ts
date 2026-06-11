import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type SicafSituacaoManualService = {
  analisarProblemaPdfForUsuario: (opts: {
    fileBuffer: Buffer;
    fileName: string;
    usuarioId: number;
  }) => Promise<{ ok: boolean; error?: string; [key: string]: unknown }>;
};

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: 'Nenhum PDF enviado. Use o campo "file" no formulário.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file instanceof File ? file.name : "situacao-fornecedor.pdf";

    const svc = await getSicafAgentModule<SicafSituacaoManualService>(
      "services/sicaf-situacao-manual.service",
    );
    const result = await svc.analisarProblemaPdfForUsuario({
      fileBuffer: buffer,
      fileName,
      usuarioId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[analisar-situacao] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro ao analisar PDF";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
