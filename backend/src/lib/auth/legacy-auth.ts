import { extractBearerToken, verifyAccessToken, type TokenPayload } from "@/lib/auth/jwt";
import { forbidden } from "@/lib/http/errors";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export type LegacyAuthContext = {
  usuarioId: number;
  tipo: TokenPayload["tipo"];
};

export async function requireLegacyAuth(request: Request): Promise<LegacyAuthContext> {
  const token = extractBearerToken(request.headers.get("authorization"));
  const payload = await verifyAccessToken(token);
  return {
    usuarioId: Number(payload.sub),
    tipo: payload.tipo,
  };
}

export async function requireLegacyUserId(request: Request): Promise<number> {
  const { usuarioId } = await requireLegacyAuth(request);
  return usuarioId;
}

type ClientAccessModule = {
  checkUsuarioIsStaff: (usuarioId: number, jwtTipo?: string) => Promise<boolean>;
};

/** Equipe interna: JWT tipo admin/colaborador OU perfil/tipo_usuario no banco (legado). */
export async function requireStaffAccess(request: Request): Promise<LegacyAuthContext> {
  const ctx = await requireLegacyAuth(request);
  const access = await getSicafAgentModule<ClientAccessModule>("services/client-access.service");
  const isStaff = await access.checkUsuarioIsStaff(ctx.usuarioId, ctx.tipo);
  if (!isStaff) {
    throw forbidden("Acesso restrito a administradores");
  }
  return ctx;
}
