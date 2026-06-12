import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { AppError } from "@/lib/http/errors";
import { licitacoesService } from "@/modules/licitacoes/licitacoes.service";
import type { RadarRuleInput } from "@/modules/licitacoes/licitacoes.radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authStatus(message: string) {
  return message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
    ? 401
    : 500;
}

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { rules } = await licitacoesService.listRadarRules(usuarioId);
    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar regras do radar";
    const status = error instanceof AppError ? error.statusCode : authStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const body = (await request.json()) as RadarRuleInput;
    const result = await licitacoesService.createRadarRule(usuarioId, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar regra do radar";
    const status = error instanceof AppError ? error.statusCode : authStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
