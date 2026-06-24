import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";
import { authService } from "@/modules/auth/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientAccessModule = {
  checkUsuarioIsStaff: (usuarioId: number, jwtTipo?: string) => Promise<boolean>;
};

/** Confirma no banco se o usuário pode acessar /admin (usuarios.perfil_id → perfis_acesso.tipo). */
export async function GET(request: Request) {
  try {
    const { usuarioId } = await requireLegacyAuth(request);
    const access = await getSicafAgentModule<ClientAccessModule>("services/client-access.service");
    const isStaff = await access.checkUsuarioIsStaff(usuarioId);

    const me = await authService.meLegacy(usuarioId);
    const perfilTipo = me.ok ? me.user.perfil?.tipo ?? null : null;
    const perfilId = me.ok ? me.user.perfil?.id ?? null : null;

    return NextResponse.json({
      ok: true,
      isStaff,
      perfilId,
      perfilTipo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sessão inválida";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 403;
    return NextResponse.json({ ok: false, isStaff: false, error: message }, { status });
  }
}
