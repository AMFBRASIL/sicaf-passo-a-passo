import type { NextRequest } from "next/server";
import { extractBearerToken, verifyAccessToken, type TokenPayload } from "@/lib/auth/jwt";
import { forbidden } from "@/lib/http/errors";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export type AuthContext = {
  user: TokenPayload;
};

export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const token = extractBearerToken(request.headers.get("authorization"));
  const user = await verifyAccessToken(token);
  return { user };
}

type ClientAccessModule = {
  checkUsuarioIsStaff: (usuarioId: number, jwtTipo?: string) => Promise<boolean>;
};

export async function requireAdmin(request: NextRequest): Promise<AuthContext> {
  const ctx = await requireAuth(request);
  const access = await getSicafAgentModule<ClientAccessModule>("services/client-access.service");
  const isStaff = await access.checkUsuarioIsStaff(Number(ctx.user.sub), ctx.user.tipo);
  if (!isStaff) {
    throw forbidden("Acesso restrito a administradores");
  }
  return ctx;
}
