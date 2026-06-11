import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type AnaliseResult = {
  ok: boolean;
  error?: string;
  message?: string;
  analise?: unknown;
  analiseId?: number | null;
  saveWarning?: string | null;
};

type SicafSituacaoManualService = {
  analisarProblemaPdfForCliente: (opts: {
    clienteId: number;
    fileBuffer: Buffer;
    fileName: string;
    usuarioId: number;
  }) => Promise<AnaliseResult>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ clienteId: string }> },
) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { clienteId } = await context.params;
    const id = parseInt(clienteId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 });
    }

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
    const result = await svc.analisarProblemaPdfForCliente({
      clienteId: id,
      fileBuffer: buffer,
      fileName,
      usuarioId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao analisar PDF";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
