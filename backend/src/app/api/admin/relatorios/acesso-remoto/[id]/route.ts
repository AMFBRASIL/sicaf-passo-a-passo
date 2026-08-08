import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuporteRemotoService = {
  getSessaoRelatorio: (sessaoId: number) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const svc = await getSicafAgentModule<SuporteRemotoService>("services/suporte-remoto.service");
    const result = await svc.getSessaoRelatorio(Number(id));
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar atendimento remoto";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
