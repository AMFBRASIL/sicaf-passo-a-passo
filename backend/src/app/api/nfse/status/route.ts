import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NfseService = {
  getStatusConfig: () => Promise<Record<string, unknown>>;
};

/** Status do módulo NFS-e (ambiente, swagger, cert sistema). */
export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const svc = await getSicafAgentModule<NfseService>("services/nfse.service");
    return NextResponse.json(await svc.getStatusConfig());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar status NFS-e";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
