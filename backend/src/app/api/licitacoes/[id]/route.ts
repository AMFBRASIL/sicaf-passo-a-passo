import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { licitacoesService } from "@/modules/licitacoes/licitacoes.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const { id } = await params;
    const licitacaoId = Number(id);
    if (!Number.isFinite(licitacaoId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const detail = await licitacoesService.getDetail(licitacaoId, usuarioId);
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar licitação";
    const status = message.includes("não encontrada")
      ? 404
      : message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
