import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoletimService = {
  runBoletimLicitacoesTeste: (options: {
    identificador: string;
    simular?: boolean;
  }) => Promise<Record<string, unknown>>;
};

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request);
    const body = (await request.json().catch(() => ({}))) as {
      identificador?: string;
      simular?: boolean;
    };

    const identificador = String(body.identificador || "").trim();
    if (!identificador) {
      return NextResponse.json({ ok: false, error: "Informe o e-mail ou CNPJ do cliente." }, { status: 400 });
    }

    const svc = await getSicafAgentModule<BoletimService>("services/licitacoes-boletim.service");
    const result = await svc.runBoletimLicitacoesTeste({
      identificador,
      simular: body.simular !== false,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao executar teste";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
