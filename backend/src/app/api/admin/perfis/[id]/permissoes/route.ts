import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminProfilesService = {
  getPermissions: (perfilId: number) => Promise<{ ok: boolean; error?: string }>;
  updatePermissions: (perfilId: number, updates: Record<string, boolean>) => Promise<{
    ok: boolean;
    error?: string;
    message?: string;
  }>;
};

export async function GET(
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
    const result = await svc.getPermissions(perfilId);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar permissões";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

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
    const permissions = (body.permissions ?? body.permissoes ?? body) as Record<string, boolean>;

    const svc = await getSicafAgentModule<AdminProfilesService>("services/admin-profiles.service");
    const result = await svc.updatePermissions(perfilId, permissions);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar permissões";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
