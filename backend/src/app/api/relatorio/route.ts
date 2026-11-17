import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelatorioService = {
  getRelatorio: (usuarioId: number) => Promise<Record<string, unknown>>;
  registrarEvento: (
    usuarioId: number,
    opts: { evento: string; path?: string; ip?: string | null },
  ) => Promise<{ ok: boolean }>;
  extractIp: (request: Request) => string | null;
};

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const svc = await getSicafAgentModule<RelatorioService>("services/cliente-relatorio.service");
    const result = await svc.getRelatorio(usuarioId);

    if (result?.ok) {
      void svc.registrarEvento(usuarioId, {
        evento: "relatorio.page_view",
        path: "/relatorio",
        ip: svc.extractIp(request),
      });
    }

    return NextResponse.json(result, { status: result?.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar relatório";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
