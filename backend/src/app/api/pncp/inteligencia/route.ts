import { NextResponse } from "next/server";
import { autorizarClienteModulo } from "@/lib/auth/modulo-acesso";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PncpInteligenciaService = {
  analisar: (opts: {
    q: string;
    uf?: string;
    meses?: number;
  }) => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>;
};

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const auth = await autorizarClienteModulo(request, sp.get("clienteId"), "pncp");
    if ("erro" in auth) return auth.erro;
    const svc = await getSicafAgentModule<PncpInteligenciaService>(
      "services/pncp-inteligencia.service",
    );
    const result = await svc.analisar({
      q: sp.get("q") || "",
      uf: sp.get("uf") || undefined,
      meses: Number(sp.get("meses") || 12),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na inteligência PNCP";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
