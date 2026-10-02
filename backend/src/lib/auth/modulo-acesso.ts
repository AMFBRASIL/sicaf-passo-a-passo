import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export type ModuloPago = "licitacoes_e" | "pncp";

export const MODULOS_PAGOS: readonly ModuloPago[] = ["licitacoes_e", "pncp"];

type ClientAccessService = {
  assertClienteAcessivelById: (
    clienteId: number,
    usuarioId: number,
    jwtTipo?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  checkUsuarioIsStaff: (usuarioId: number, jwtTipo?: string) => Promise<boolean>;
};

type ModulosAssinaturaService = {
  temAcesso: (clienteId: number, modulo: ModuloPago) => Promise<boolean>;
};

export type ClienteAutorizado = {
  clienteId: number;
  usuarioId: number;
  tipo?: string;
  staff: boolean;
};

/**
 * Valida sessão + acesso à empresa. Com `modulo`, exige assinatura ativa
 * (equipe CADBRASIL tem acesso liberado). Sem assinatura → 402.
 */
export async function autorizarClienteModulo(
  request: Request,
  clienteIdRaw: string | null | undefined,
  modulo?: ModuloPago,
): Promise<{ erro: NextResponse } | ClienteAutorizado> {
  const { usuarioId, tipo } = await requireLegacyAuth(request);
  const clienteId = parseInt(String(clienteIdRaw ?? ""), 10);
  if (!Number.isFinite(clienteId) || clienteId <= 0) {
    return { erro: NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 }) };
  }

  const access = await getSicafAgentModule<ClientAccessService>("services/client-access.service");
  const acesso = await access.assertClienteAcessivelById(clienteId, usuarioId, tipo);
  if (!acesso.ok) return { erro: NextResponse.json(acesso, { status: 404 }) };

  const staff = await access.checkUsuarioIsStaff(usuarioId, tipo);
  if (modulo && !staff) {
    const svc = await getSicafAgentModule<ModulosAssinaturaService>(
      "services/modulos-assinatura.service",
    );
    if (!(await svc.temAcesso(clienteId, modulo))) {
      return {
        erro: NextResponse.json(
          {
            ok: false,
            bloqueado: true,
            modulo,
            error: "Módulo não contratado. Pague a mensalidade para liberar o acesso.",
          },
          { status: 402 },
        ),
      };
    }
  }

  return { clienteId, usuarioId, tipo, staff };
}
