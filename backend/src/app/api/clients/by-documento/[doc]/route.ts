import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ doc: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { doc } = await context.params;
  const docParam = decodeURIComponent(doc || "");
  const docDigits = docParam.replace(/\D/g, "");
  const soft = new URL(request.url).searchParams.get("soft") === "1";

  if (!docDigits) {
    return NextResponse.json(
      { ok: false, error: "Documento inválido. Informe CPF/CNPJ com números." },
      { status: 400 },
    );
  }

  const lookup = await getSicafAgentModule<{
    getClientByDocumento: (d: string) => Promise<{
      ok: boolean;
      error?: string;
      client?: unknown;
    }>;
  }>("clients/cnpj-lookup");

  const result = await lookup.getClientByDocumento(docDigits);

  if (!result.ok) {
    if (soft && result.error === "Cliente não encontrado") {
      return NextResponse.json(result, { status: 200 });
    }
    const status = result.error === "Cliente não encontrado" ? 404 : 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
