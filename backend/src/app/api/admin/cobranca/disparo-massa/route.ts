import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CobrancaDisparoService = {
  executarDisparoMassa: (opts: Record<string, unknown>) => Promise<{
    ok: boolean;
    error?: string;
    message?: string;
  }>;
  MODELOS_MENSAGEM: Record<string, string>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const svc = await getSicafAgentModule<CobrancaDisparoService>("services/cobranca-disparo.service");
    return NextResponse.json({ ok: true, modelos: svc.MODELOS_MENSAGEM });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();

    const publicoAlvo = String(body.publicoAlvo || body.publico_alvo || "todos");
    const canais = Array.isArray(body.canais) ? body.canais : body.canal ? [body.canal] : ["email"];
    const modelo = body.modelo ? String(body.modelo) : undefined;
    const mensagem = body.mensagem ? String(body.mensagem) : undefined;
    const agendar = body.agendar === true || body.agendar === 1 || body.agendar === "true";

    const svc = await getSicafAgentModule<CobrancaDisparoService>("services/cobranca-disparo.service");
    const result = await svc.executarDisparoMassa({
      publicoAlvo,
      canais,
      modelo,
      mensagem,
      agendar,
      usuarioId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao executar disparo";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
