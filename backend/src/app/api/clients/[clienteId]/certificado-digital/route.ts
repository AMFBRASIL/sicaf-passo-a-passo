import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CertificadoDigitalService = {
  getCertificadoDigital: (
    clienteId: number,
    options?: { includeSenha?: boolean },
  ) => Promise<{ ok: boolean; certificado?: unknown; error?: string }>;
  saveCertificadoDigital: (
    clienteId: number,
    file: { buffer: Buffer; originalname: string },
    senha: string,
  ) => Promise<{ ok: boolean; error?: string; message?: string; certificado?: unknown }>;
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

    const svc = await getSicafAgentModule<CertificadoDigitalService>(
      "services/certificado-digital.service",
    );
    const result = await svc.getCertificadoDigital(id, { includeSenha: true });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar certificado";
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

    const formData = await request.formData();
    const file = formData.get("file");
    const senha = String(formData.get("senha") || formData.get("password") || "").trim();

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "Envie o arquivo do certificado (.pfx ou .p12)." }, { status: 400 });
    }

    const originalName = file instanceof File && file.name ? file.name : "certificado.pfx";
    const ext = originalName.split(".").pop()?.toLowerCase() || "";
    if (!["pfx", "p12"].includes(ext)) {
      return NextResponse.json({ ok: false, error: "Formato inválido. Use arquivo .pfx ou .p12." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const svc = await getSicafAgentModule<CertificadoDigitalService>(
      "services/certificado-digital.service",
    );
    const result = await svc.saveCertificadoDigital(id, { buffer, originalname: originalName }, senha);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar certificado";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
