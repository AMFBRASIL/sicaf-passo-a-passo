import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClienteNotasService = {
  listNotasCliente: (clienteId: number) => Promise<{ ok: boolean; notas?: unknown[]; error?: string }>;
  criarNotaCliente: (opts: {
    clienteId: number;
    texto: string;
    usuarioId: number;
  }) => Promise<{ ok: boolean; nota?: unknown; message?: string; error?: string }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireLegacyUserId(request);
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<ClienteNotasService>("services/cliente-notas.service");
    const result = await svc.listNotasCliente(clienteId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar notas";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const body = await request.json();
    const texto = String(body.texto || "").trim();
    if (!texto) {
      return NextResponse.json({ ok: false, error: "Texto da nota é obrigatório" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<ClienteNotasService>("services/cliente-notas.service");
    const result = await svc.criarNotaCliente({ clienteId, texto, usuarioId });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar nota";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
