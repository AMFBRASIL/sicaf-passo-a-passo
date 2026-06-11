import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketsService = {
  listarTicketsAdmin: (opts: {
    search?: string;
    status?: string;
    clienteId?: number;
  }) => Promise<{ ok: boolean; tickets?: unknown[]; counts?: unknown; error?: string }>;
  criarTicketAdmin: (
    usuarioId: number,
    dados: Record<string, unknown>,
  ) => Promise<{ ok: boolean; codigo?: string; id?: number; error?: string; message?: string }>;
};

async function getUsuarioNome(usuarioId: number): Promise<string> {
  const dbMod = await getSicafAgentModule<{
    getDb: () => {
      (table: string): { where: (k: string, v: number) => { first: () => Promise<{ nome?: string } | undefined> } };
    };
  }>("database/connection");
  const db = dbMod.getDb();
  if (!db) return "Suporte";
  const user = await db("usuarios").where("id", usuarioId).first();
  return user?.nome || "Suporte";
}

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
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
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();
    const nomeUsuario = await getUsuarioNome(usuarioId);
    const svc = await getSicafAgentModule<TicketsService>("services/tickets.service");
    const result = await svc.criarTicketAdmin(usuarioId, { ...body, nomeUsuario });
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar ticket";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
