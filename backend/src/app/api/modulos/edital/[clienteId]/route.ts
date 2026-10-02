import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { autorizarClienteModulo } from "@/lib/auth/modulo-acesso";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AiReaderService = {
  analisarEdital: (
    usuarioId: number,
    filePath: string,
    fileName: string,
    fileSize: number,
    opts?: { semCredito?: boolean },
  ) => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>;
};

type ModulosAssinaturaService = {
  temAcesso: (clienteId: number, modulo: "pncp") => Promise<boolean>;
};

type Ctx = { params: Promise<{ clienteId: string }> };

/**
 * Leitura de edital por IA no contexto de uma empresa. Com o PNCP Inteligente ativo
 * a leitura está incluída na mensalidade; sem ele, consome 1 crédito de IA do usuário.
 */
export async function POST(request: Request, ctx: Ctx) {
  let tempPath: string | null = null;
  try {
    const auth = await autorizarClienteModulo(request, (await ctx.params).clienteId);
    if ("erro" in auth) return auth.erro;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "Arquivo não enviado" }, { status: 400 });
    }

    const modulos = await getSicafAgentModule<ModulosAssinaturaService>(
      "services/modulos-assinatura.service",
    );
    const incluido = await modulos.temAcesso(auth.clienteId, "pncp");

    const fileName = file instanceof File && file.name ? file.name : "edital.pdf";
    const buffer = Buffer.from(await file.arrayBuffer());
    tempPath = path.join(os.tmpdir(), `edital-${Date.now()}-${fileName.replace(/[^\w.-]/g, "_")}`);
    fs.writeFileSync(tempPath, buffer);

    const svc = await getSicafAgentModule<AiReaderService>("services/ai-reader.service");
    const result = await svc.analisarEdital(auth.usuarioId, tempPath, fileName, buffer.length, {
      semCredito: incluido,
    });
    return NextResponse.json(
      { ...result, incluidoNoModulo: incluido },
      { status: result.ok ? 200 : 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao analisar edital";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        /* arquivo temporário */
      }
    }
  }
}
