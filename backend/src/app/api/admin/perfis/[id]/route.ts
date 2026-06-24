import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminProfilesService = {
  updateProfile: (
    perfilId: number,
    data: { nome?: string; descricao?: string },
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
  deleteProfile: (perfilId: number) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const perfilId = parseInt(id, 10);
    if (!Number.isFinite(perfilId) || perfilId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const svc = await getSicafAgentModule<AdminProfilesService>("services/admin-profiles.service");
    const result = await svc.updateProfile(perfilId, {
      nome: body.nome,
      descricao: body.descricao,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar perfil";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffAccess(request);
    const { id } = await context.params;
    const perfilId = parseInt(id, 10);
    if (!Number.isFinite(perfilId) || perfilId <= 0) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const svc = await getSicafAgentModule<AdminProfilesService>("services/admin-profiles.service");
    const result = await svc.deleteProfile(perfilId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir perfil";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
