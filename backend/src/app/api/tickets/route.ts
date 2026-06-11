import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type TicketsService = {
  listarTickets: (usuarioId: number, opts: { status?: string; search?: string }) => Promise<{ ok: boolean; error?: string }>;
  criarTicket: (usuarioId: number, dados: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

async function getUsuarioNome(usuarioId: number): Promise<string> {
  const dbMod = await getSicafAgentModule<{ getDb: () => { (table: string): { where: (k: string, v: number) => { first: () => Promise<{ nome?: string } | undefined> } } } }>(
    "database/connection",
  );
  const db = dbMod.getDb();
  if (!db) return "Cliente";
  const user = await db("usuarios").where("id", usuarioId).first();
  return user?.nome || "Cliente";
}

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const url = new URL(request.url);
    const svc = await getSicafAgentModule<TicketsService>("services/tickets.service");
    const result = await svc.listarTickets(usuarioId, {
      status: url.searchParams.get("status") || "todos",
      search: url.searchParams.get("search") || "",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar tickets";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const body = await request.json();
    const nomeUsuario = await getUsuarioNome(usuarioId);
    const svc = await getSicafAgentModule<TicketsService>("services/tickets.service");
    const result = await svc.criarTicket(usuarioId, { ...body, nomeUsuario });
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar ticket";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
