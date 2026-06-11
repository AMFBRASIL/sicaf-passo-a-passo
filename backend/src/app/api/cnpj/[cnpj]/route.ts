import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const { cnpj } = await params;
  const lookup = await getSicafAgentModule<{
    consultCnpjWs: (c: string) => Promise<{ success: boolean; error?: string; data?: unknown }>;
  }>("clients/cnpj-ws");

  const result = await lookup.consultCnpjWs(cnpj);

  if (!result.success) {
    const status = (result.error || "").includes("14 dígitos")
      ? 400
      : (result.error || "").includes("não encontrado")
        ? 404
        : (result.error || "").includes("Token")
          ? 401
          : 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
