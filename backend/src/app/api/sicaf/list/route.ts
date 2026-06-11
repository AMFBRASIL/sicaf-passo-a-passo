import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type SicafListService = {
  listSicaf: (search: string, usuarioId: number) => Promise<{ ok: boolean; error?: string; items?: unknown[]; total?: number; valorTaxa?: number }>;
};

export async function GET(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const svc = await getSicafAgentModule<SicafListService>("services/sicaf-list.service");
    const result = await svc.listSicaf(search, usuarioId);
    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar empresas";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
