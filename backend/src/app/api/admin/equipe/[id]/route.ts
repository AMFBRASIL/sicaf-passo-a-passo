import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminEquipeService = {
  updateMembro: (
    usuarioId: number,
    data: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const usuarioId = parseInt(id, 10);
    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const svc = await getSicafAgentModule<AdminEquipeService>("services/admin-equipe.service");
    const result = await svc.updateMembro(usuarioId, {
      nome: body.nome,
      email: body.email,
      telefone: body.telefone,
      cargo: body.cargo ?? body.departamento,
      perfilId: body.perfilId ?? body.perfil_id,
      ativo: body.ativo,
      senha: body.senha,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar colaborador";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
