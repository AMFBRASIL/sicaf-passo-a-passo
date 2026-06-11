import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { licitacoesRepository } from "@/modules/licitacoes/licitacoes.repository";
import { licitacoesService } from "@/modules/licitacoes/licitacoes.service";

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const url = new URL(request.url);
    const filters = licitacoesRepository.parseListFiltersFromUrl(usuarioId, url.searchParams);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const result = await licitacoesService.list(filters, page);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar licitações";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
