import { NextResponse } from "next/server";
import { extractBearerToken, verifyAccessToken } from "@/lib/auth/jwt";
import { authService } from "@/modules/auth/auth.service";

/** Compatível com o frontend legado: { ok, user } */
export async function GET(request: Request) {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    const payload = await verifyAccessToken(token);
    const result = await authService.meLegacy(Number(payload.sub));

    if (!result.ok) {
      return NextResponse.json(result, { status: 401 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    const payload = await verifyAccessToken(token);
    const body = await request.json();

    const result = await authService.updateProfileLegacy(Number(payload.sub), {
      nome: body.nome,
      email: body.email,
      telefone: body.telefone,
      departamento: body.departamento ?? body.cargo,
      senhaAtual: body.senhaAtual ?? body.senha_atual,
      novaSenha: body.novaSenha ?? body.nova_senha,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
  }
}
