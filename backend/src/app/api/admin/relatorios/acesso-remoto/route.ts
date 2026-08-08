import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuporteRemotoService = {
  listarSessoesRelatorio: (opts: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

function resolvePeriod(periodo?: string | null, dataIni?: string | null, dataFim?: string | null) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);
  switch (String(periodo || "30d")) {
    case "hoje":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "mes":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "trimestre": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "ano":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      if (dataIni) start = new Date(`${dataIni}T00:00:00`);
      if (dataFim) end = new Date(`${dataFim}T23:59:59`);
      break;
    case "30d":
    default:
      start.setDate(start.getDate() - 30);
      break;
  }
  return {
    since: start.toISOString().split("T")[0],
    until: end.toISOString().split("T")[0],
  };
}

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const url = new URL(request.url);
    const range = resolvePeriod(
      url.searchParams.get("periodo"),
      url.searchParams.get("dataIni"),
      url.searchParams.get("dataFim"),
    );
    const svc = await getSicafAgentModule<SuporteRemotoService>("services/suporte-remoto.service");
    const result = await svc.listarSessoesRelatorio({
      since: range.since,
      until: range.until,
      somenteConcluidos: url.searchParams.get("stRemoto") !== "todos",
      comTela: url.searchParams.get("comTela") || "",
    });
    return NextResponse.json(
      { ...result, periodo: range },
      { status: result.ok ? 200 : 500 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar acessos remotos";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
