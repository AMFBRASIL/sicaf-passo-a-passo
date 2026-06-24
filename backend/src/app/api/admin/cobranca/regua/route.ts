import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReguaService = {
  getReguaCobranca: () => Promise<{ ok: boolean; error?: string }>;
  saveReguaCobranca: (opts: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

type DisparoService = {
  processarReguaCobranca: (opts: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const svc = await getSicafAgentModule<ReguaService>("services/cobranca-regua.service");
    const result = await svc.getReguaCobranca();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar régua";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();

    const svc = await getSicafAgentModule<ReguaService>("services/cobranca-regua.service");
    const result = await svc.saveReguaCobranca({
      automacaoAtiva: body.automacaoAtiva ?? body.automacao_ativa,
      etapas: body.etapas,
      usuarioId,
    });

    if (result.ok && (body.automacaoAtiva || body.automacao_ativa)) {
      const disparoSvc = await getSicafAgentModule<DisparoService>("services/cobranca-disparo.service");
      await disparoSvc.processarReguaCobranca({ usuarioId }).catch(() => null);
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar régua";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
