import { NextResponse } from "next/server";
import { autorizarClienteModulo } from "@/lib/auth/modulo-acesso";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LicitacoesEService = {
  buscar: (opts: {
    q?: string;
    uf?: string;
    somenteAbertas?: boolean;
    pagina?: number;
  }) => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>;
};

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const auth = await autorizarClienteModulo(request, sp.get("clienteId"), "licitacoes_e");
    if ("erro" in auth) return auth.erro;
    const svc = await getSicafAgentModule<LicitacoesEService>("services/licitacoes-e.service");
    const result = await svc.buscar({
      q: sp.get("q") || undefined,
      uf: sp.get("uf") || undefined,
      somenteAbertas: sp.get("abertas") === "1",
      pagina: Number(sp.get("pagina") || 1),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na busca";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
