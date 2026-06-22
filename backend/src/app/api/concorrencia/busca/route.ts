import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { AppError } from "@/lib/http/errors";
import { concorrenciaService } from "@/modules/concorrencia/concorrencia.service";
import { buildPortalTransparenciaContratosUrl, normalizeCnpjDigits } from "@/modules/concorrencia/concorrencia.utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const url = new URL(request.url);
    const cnpj = url.searchParams.get("cnpj") || "";
    const result = await concorrenciaService.buscarPorCnpj(cnpj);
    const links = {
      portalTransparencia: buildPortalTransparenciaContratosUrl(normalizeCnpjDigits(cnpj)),
      ...(result.links || {}),
    };
    return NextResponse.json({ ok: true, ...result, links });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    const message = error instanceof Error ? error.message : "Erro ao consultar concorrência";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
