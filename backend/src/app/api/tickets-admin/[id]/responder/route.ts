import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketsService = {
  responderTicketAdmin: (
    ticketId: string,
    usuarioId: number,
    dados: Record<string, unknown>,
  ) => Promise<{ ok: boolean; status?: string; error?: string }>;
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { id } = await context.params;
    const body = await request.json();
    const nomeUsuario = body.nomeUsuario || (await getUsuarioNome(usuarioId));
    const svc = await getSicafAgentModule<TicketsService>("services/tickets.service");
    const result = await svc.responderTicketAdmin(decodeURIComponent(id), usuarioId, {
      ...body,
      nomeUsuario,
    });
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao responder ticket";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
