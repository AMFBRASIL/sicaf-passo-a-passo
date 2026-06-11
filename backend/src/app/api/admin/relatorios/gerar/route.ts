import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GerarPayload = {
  tipo?: string;
  periodo?: string;
  dataIni?: string;
  dataFim?: string;
  formato?: string;
  colunas?: string[];
  filtros?: Record<string, unknown>;
  agendado?: boolean;
  frequencia?: string;
  emails?: string[];
};

type AdminRelatoriosService = {
  gerarRelatorio: (opts: GerarPayload) => Promise<{
    ok: boolean;
    error?: string;
    filename?: string;
    formato?: string;
    total?: number;
    periodo?: { since: string; until: string };
    headers?: string[];
    rows?: (string | number)[][];
    tipo?: string;
  }>;
  registrarExportacao: (
    usuarioId: number,
    payload: {
      tipo: string;
      filename: string;
      formato: string;
      total: number;
      periodo?: { since: string; until: string };
    },
  ) => Promise<void>;
  salvarAgendamento: (
    usuarioId: number,
    opts: GerarPayload & { nome?: string },
  ) => Promise<{ ok: boolean; error?: string; id?: number }>;
};

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = (await request.json()) as GerarPayload;
    const svc = await getSicafAgentModule<AdminRelatoriosService>(
      "services/admin-relatorios.service",
    );

    const result = await svc.gerarRelatorio(body);
    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }

    if (body.agendado) {
      const ag = await svc.salvarAgendamento(usuarioId, {
        ...body,
        nome: `Agendamento ${body.tipo}`,
        emails: body.emails
          ? String(body.emails)
              .split(",")
              .map((e) => e.trim())
              .filter(Boolean)
          : [],
      });
      if (!ag.ok) {
        return NextResponse.json({ ...result, agendamentoErro: ag.error }, { status: 200 });
      }
    }

    await svc.registrarExportacao(usuarioId, {
      tipo: result.tipo || String(body.tipo),
      filename: result.filename || "relatorio.csv",
      formato: result.formato || String(body.formato || "csv"),
      total: result.total || 0,
      periodo: result.periodo,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar relatório";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
