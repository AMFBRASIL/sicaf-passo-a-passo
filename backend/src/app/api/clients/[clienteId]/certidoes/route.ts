import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type CertidoesInsertService = {
  insertCertidao: (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

type ClientsService = {
  getCertidoesStatus: (clienteId: number) => Promise<{ ok: boolean; error?: string }>;
};

type ClientAccessService = {
  assertClienteAcessivelById: (
    clienteId: number,
    usuarioId: number,
    jwtTipo?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

async function assertAccess(clienteId: number, usuarioId: number, tipo?: string) {
  const access = await getSicafAgentModule<ClientAccessService>("services/client-access.service");
  return access.assertClienteAcessivelById(clienteId, usuarioId, tipo);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ clienteId: string }> },
) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const { clienteId } = await context.params;
    const id = parseInt(clienteId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 });
    }

    const access = await assertAccess(id, usuarioId, tipo);
    if (!access.ok) {
      return NextResponse.json(access, { status: 404 });
    }

    const svc = await getSicafAgentModule<ClientsService>("services/clients.service");
    const result = await svc.getCertidoesStatus(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar certidões";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ clienteId: string }> },
) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const { clienteId } = await context.params;
    const id = parseInt(clienteId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 });
    }

    const access = await assertAccess(id, usuarioId, tipo);
    if (!access.ok) {
      return NextResponse.json(access, { status: 404 });
    }

    const body = await request.json();
    const svc = await getSicafAgentModule<CertidoesInsertService>("services/certidoes.service");
    const result = await svc.insertCertidao({
      clienteId: id,
      tipoCertidaoId: body.tipoCertidaoId,
      numero: body.numero,
      dataEmissao: body.dataEmissao,
      dataValidade: body.dataValidade,
      arquivoUrl: body.arquivoUrl,
      arquivoNome: body.arquivoNome,
      arquivoTamanho: body.arquivoTamanho,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar certidão";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
