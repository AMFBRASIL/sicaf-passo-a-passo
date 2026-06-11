import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketsService = {
  listarTicketsAdmin: (opts: {
    search?: string;
    status?: string;
    clienteId?: number;
  }) => Promise<{ ok: boolean; tickets?: unknown[]; error?: string }>;
};

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const url = new URL(request.url);
    const clienteId = parseInt(url.searchParams.get("clienteId") || "", 10);
    const svc = await getSicafAgentModule<TicketsService>("services/tickets.service");
    const result = await svc.listarTicketsAdmin({
      search: url.searchParams.get("search") || "",
      status: url.searchParams.get("status") || "todos",
      clienteId: Number.isFinite(clienteId) && clienteId > 0 ? clienteId : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar tickets";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
