import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { AppError } from "@/lib/http/errors";
import { licitacoesService } from "@/modules/licitacoes/licitacoes.service";
import type { RadarRuleInput } from "@/modules/licitacoes/licitacoes.radar";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authStatus(message: string) {
  return message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
    ? 401
    : 500;
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { id } = await params;
    const ruleId = Number(id);
    if (!Number.isFinite(ruleId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const body = (await request.json()) as Partial<RadarRuleInput>;
    await licitacoesService.updateRadarRule(usuarioId, ruleId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar regra";
    const status = error instanceof AppError ? error.statusCode : authStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const usuarioId = await requireLegacyUserId(_request);
    const { id } = await params;
    const ruleId = Number(id);
    if (!Number.isFinite(ruleId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    await licitacoesService.deleteRadarRule(usuarioId, ruleId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir regra";
    const status = error instanceof AppError ? error.statusCode : authStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
