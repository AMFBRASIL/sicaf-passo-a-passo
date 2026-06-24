import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CobrancaTaxaService = {
  listClientesCobrancaPendentes: (opts: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);

    const { searchParams } = new URL(request.url);
    const opts = {
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "15",
      q: searchParams.get("q") || "",
      cobrado: searchParams.get("cobrado") || "todos",
      status: searchParams.get("status") || "todos",
      diasMin: searchParams.get("diasMin") || "",
      semEmail: searchParams.get("semEmail") || "todos",
      severidade: searchParams.get("severidade") || "todos",
      clienteId: searchParams.get("clienteId") || "",
    };

    const svc = await getSicafAgentModule<CobrancaTaxaService>("services/cobranca-taxa.service");
    const result = await svc.listClientesCobrancaPendentes(opts);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar cobranças pendentes";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
