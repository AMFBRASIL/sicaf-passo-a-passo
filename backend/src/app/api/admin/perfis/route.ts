import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminProfilesService = {
  listProfiles: () => Promise<{ ok: boolean; error?: string }>;
  createProfile: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; id?: number }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const svc = await getSicafAgentModule<AdminProfilesService>("services/admin-profiles.service");
    const result = await svc.listProfiles();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar perfis";
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
    await requireStaffAccess(request);
    const body = await request.json();
    const svc = await getSicafAgentModule<AdminProfilesService>("services/admin-profiles.service");
    const result = await svc.createProfile({
      nome: body.nome,
      descricao: body.descricao,
      tipo: body.tipo,
    });
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar perfil";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
