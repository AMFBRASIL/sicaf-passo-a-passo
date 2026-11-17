import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "licitacoes.page_view",
  "licitacoes.detalhe",
  "sicaf.page_view",
  "assistente.page_view",
  "documentos.page_view",
  "pagamentos.page_view",
  "relatorio.page_view",
]);

type RelatorioService = {
  registrarEvento: (
    usuarioId: number,
    opts: {
      evento: string;
      entidade?: string;
      entidadeId?: number;
      path?: string;
      ip?: string | null;
      meta?: unknown;
    },
  ) => Promise<{ ok: boolean; error?: string }>;
  extractIp: (request: Request) => string | null;
};

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      /* empty */
    }

    const evento = String(body.evento || "").trim();
    if (!ALLOWED.has(evento)) {
      return NextResponse.json({ ok: false, error: "Evento não permitido" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<RelatorioService>("services/cliente-relatorio.service");
    const result = await svc.registrarEvento(usuarioId, {
      evento,
      entidade: body.entidade != null ? String(body.entidade) : undefined,
      entidadeId: body.entidadeId != null ? Number(body.entidadeId) : undefined,
      path: body.path != null ? String(body.path) : undefined,
      ip: svc.extractIp(request),
      meta: body.meta,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao registrar evento";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
