import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type StorageService = {
  getStorageInfo: () => Promise<Record<string, unknown>>;
};

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const storage = await getSicafAgentModule<StorageService>("services/storage.service");
    return NextResponse.json({ ok: true, storage: await storage.getStorageInfo() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao obter informações do storage";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
