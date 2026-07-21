import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailMktService = {
  getDashboard: (opts?: Record<string, string>) => Promise<Record<string, unknown>>;
  createCampanha: (usuarioId: number, dados: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const url = new URL(request.url);
    const svc = await getSicafAgentModule<EmailMktService>(
      "services/admin-email-marketing.service",
    );
    const result = await svc.getDashboard({
      search: url.searchParams.get("search") || "",
      categoria: url.searchParams.get("categoria") || "todos",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar email marketing";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();
    const svc = await getSicafAgentModule<EmailMktService>(
      "services/admin-email-marketing.service",
    );
    const result = await svc.createCampanha(usuarioId, body);
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar campanha";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
