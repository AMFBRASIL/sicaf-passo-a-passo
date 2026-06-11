import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type StorageService = {
  adaptWebRequest: (request: Request) => { protocol: string; get: (name: string) => string } | null;
  deleteFile: (
    fileUrl: string,
    req: { protocol: string; get: (name: string) => string } | null,
  ) => Promise<boolean>;
};

export async function POST(request: Request) {
  try {
    await requireLegacyUserId(request);
    const body = (await request.json()) as { fileUrl?: string };
    const fileUrl = body?.fileUrl;

    if (!fileUrl) {
      return NextResponse.json({ ok: false, error: 'Campo "fileUrl" é obrigatório' }, { status: 400 });
    }

    const storage = await getSicafAgentModule<StorageService>("services/storage.service");
    const reqLike = storage.adaptWebRequest(request);
    const deleted = await storage.deleteFile(fileUrl, reqLike);

    return NextResponse.json({
      ok: deleted,
      message: deleted ? "Arquivo deletado" : "Arquivo não encontrado",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao deletar arquivo";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    console.error("[Storage:delete]", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
