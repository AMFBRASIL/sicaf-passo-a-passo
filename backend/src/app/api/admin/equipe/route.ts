import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminEquipeService = {
  listEquipe: () => Promise<{ ok: boolean; error?: string }>;
  createMembro: (data: Record<string, unknown>) => Promise<{
    ok: boolean;
    error?: string;
    id?: number;
    message?: string;
    senhaTemporaria?: string;
  }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const svc = await getSicafAgentModule<AdminEquipeService>("services/admin-equipe.service");
    const result = await svc.listEquipe();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar equipe";
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
    const svc = await getSicafAgentModule<AdminEquipeService>("services/admin-equipe.service");
    const result = await svc.createMembro({
      nome: body.nome,
      email: body.email,
      telefone: body.telefone,
      cargo: body.cargo ?? body.departamento,
      perfilId: body.perfilId ?? body.perfil_id,
      senha: body.senha,
      ativo: body.ativo,
    });
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar colaborador";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
