import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClientsService = {
  getClientById: (id: number) => Promise<{ ok: boolean; error?: string }>;
  updateClient: (
    id: number,
    payload: Record<string, unknown>,
    usuarioId: number | null,
  ) => Promise<{ ok: boolean; error?: string }>;
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
    const svc = await getSicafAgentModule<AdminClientsService>("services/admin-clients.service");
    const result = await svc.getClientById(clienteId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar cliente";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(
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
    const svc = await getSicafAgentModule<AdminClientsService>("services/admin-clients.service");
    const result = await svc.updateClient(
      clienteId,
      {
        razao_social: body.razao || body.razao_social,
        documento: body.cnpj || body.documento,
        email: body.email,
        telefone: body.telefone,
        celular: body.whatsapp || body.celular,
        cidade: body.cidade,
        estado: body.uf || body.estado,
        responsavel_nome: body.responsavel,
        responsavel_email: body.email,
        responsavel_telefone: body.telefone,
        observacoes: body.observacoes,
      },
      usuarioId,
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar cliente";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
