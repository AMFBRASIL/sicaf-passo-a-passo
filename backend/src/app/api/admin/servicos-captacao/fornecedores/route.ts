import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CaptacaoService = {
  atualizarBaseFornecedores: () => Promise<Record<string, unknown> & { ok: boolean }>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request);
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    return NextResponse.json(await svc.atualizarBaseFornecedores());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar fornecedores";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
