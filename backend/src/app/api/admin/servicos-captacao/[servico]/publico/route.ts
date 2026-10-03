import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type CaptacaoService = {
  listarPublico: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
  exportarPublico: (
    opts: Record<string, unknown>,
  ) => Promise<{ ok: boolean; arquivo: string; csv: string; total: number }>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  if (message.includes("não encontrado")) return 404;
  return 500;
}

export async function GET(request: Request, context: { params: Promise<{ servico: string }> }) {
  try {
    await requireStaffAccess(request);
    const { servico } = await context.params;
    const q = new URL(request.url).searchParams;
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    const exportar = q.get("exportar");

    if (exportar) {
      const result = await svc.exportarPublico({
        servico,
        segmento: q.get("segmento") || "",
        uf: q.get("uf") || "",
        cooldownDias: q.get("cooldown") || "0",
        formato: exportar === "google" ? "google" : "padrao",
      });
      return new Response(result.csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${result.arquivo}"`,
          "X-Total-Registros": String(result.total),
        },
      });
    }

    const result = await svc.listarPublico({
      servico,
      segmento: q.get("segmento") || "",
      uf: q.get("uf") || "",
      busca: q.get("busca") || "",
      pagina: q.get("pagina") || "1",
      ocultarContatados: q.get("ocultarContatados") === "1",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar público";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
