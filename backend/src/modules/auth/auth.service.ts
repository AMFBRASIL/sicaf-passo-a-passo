import { signAccessToken, type TokenPayload } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { parseUserAgent } from "@/lib/auth/user-agent";
import { unauthorized } from "@/lib/http/errors";
import { auditService } from "@/services/audit/audit.service";
import { authRepository, type UsuarioRow } from "@/modules/auth/auth.repository";
import type { LoginInput } from "@/modules/auth/auth.schemas";

export type AuthUser = {
  id: number;
  nome: string;
  email: string;
  telefone?: string | null;
  avatar_iniciais?: string | null;
  departamento?: string | null;
  boas_vindas_visto_em?: string | null;
  tipo_usuario?: string | null;
  perfil: { id: number; nome: string; tipo: string } | null;
  permissoes: string[];
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type LegacyLoginResult =
  | { ok: true; token: string; user: AuthUser }
  | { ok: false; error: string };

/** JWT só aceita admin | colaborador | cliente — perfis internos mapeiam para admin/colaborador. */
function resolveJwtTipo(
  tipoUsuario: string | null | undefined,
  perfilTipo: string | null,
): TokenPayload["tipo"] {
  const tu = String(tipoUsuario || "").toLowerCase();
  if (tu === "admin" || tu === "colaborador") return tu;

  const pt = String(perfilTipo || "").toLowerCase();
  if (pt === "colaborador") return "colaborador";
  if (["admin", "gestor", "analista", "visualizador"].includes(pt)) return "admin";

  return "cliente";
}

export class AuthService {
  private async buildUser(usuario: UsuarioRow): Promise<AuthUser> {
    const [perfil, permissoes] = await Promise.all([
      authRepository.findPerfilById(usuario.perfil_id),
      authRepository.listPermissoesByPerfil(usuario.perfil_id),
    ]);

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone ?? null,
      avatar_iniciais: usuario.avatar_iniciais ?? null,
      departamento: usuario.departamento ?? null,
      boas_vindas_visto_em: usuario.boas_vindas_visto_em ?? null,
      tipo_usuario: usuario.tipo_usuario ?? null,
      perfil: perfil
        ? { id: perfil.id, nome: perfil.nome, tipo: perfil.tipo }
        : null,
      permissoes,
    };
  }

  async login(
    input: LoginInput,
    meta: { ip?: string | null; userAgent?: string | null },
  ): Promise<AuthSession> {
    const result = await this.loginLegacy(input, meta);
    if (!result.ok) {
      throw unauthorized(result.error);
    }
    return { token: result.token, user: result.user };
  }

  /** Formato compatível com o sistema antigo: { ok, token?, user?, error? } */
  async loginLegacy(
    input: LoginInput,
    meta: { ip?: string | null; userAgent?: string | null },
  ): Promise<LegacyLoginResult> {
    const usuario = await authRepository.findByEmail(input.email);
    const uaInfo = parseUserAgent(meta.userAgent);

    if (!usuario) {
      return { ok: false, error: "E-mail ou senha incorretos" };
    }

    if (usuario.status !== "Ativo") {
      await authRepository.insertLoginLog(usuario.id, false, {
        ...meta,
        ...uaInfo,
        motivoFalha: "Conta inativa ou bloqueada",
      });
      return { ok: false, error: "Conta desativada. Entre em contato com o suporte." };
    }

    const senhaOk = await verifyPassword(input.senha, usuario.senha_hash);
    if (!senhaOk) {
      await authRepository.insertLoginLog(usuario.id, false, {
        ...meta,
        ...uaInfo,
        motivoFalha: "Senha incorreta",
      });
      return { ok: false, error: "E-mail ou senha incorretos" };
    }

    const perfil = await authRepository.findPerfilById(usuario.perfil_id);
    const tokenTipo = resolveJwtTipo(usuario.tipo_usuario, perfil?.tipo ?? null);

    const token = await signAccessToken({
      sub: String(usuario.id),
      email: usuario.email,
      tipo: tokenTipo,
      perfilId: usuario.perfil_id,
    });

    await authRepository.updateLastLogin(usuario.id, meta.ip ?? null);
    await authRepository.insertLoginLog(usuario.id, true, { ...meta, ...uaInfo });

    await auditService.log({
      usuarioId: usuario.id,
      acao: "LOGIN",
      entidade: "usuarios",
      entidadeId: usuario.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    const user = await this.buildUser(usuario);
    return { ok: true, token, user };
  }

  async me(userId: number): Promise<AuthUser> {
    const row = await authRepository.findById(userId);
    if (!row || row.status !== "Ativo") {
      throw unauthorized("Usuário não encontrado");
    }
    return this.buildUser(row);
  }

  async meLegacy(userId: number): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
    try {
      const user = await this.me(userId);
      return { ok: true, user };
    } catch {
      return { ok: false, error: "Sessão inválida" };
    }
  }
}

export const authService = new AuthService();
