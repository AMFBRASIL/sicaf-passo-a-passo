import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DescontoService = {
  getDescontoTaxa: (taxaId: number, clienteId?: number) => Promise<{ ok: boolean; error?: string }>;
  aplicarDescontoTaxa: (opts: {
    taxaId: number;
    clienteId?: number;
    tipo: string;
    valor?: number;
    motivo?: string;
    usuarioId?: number;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  return 500;
}

function parseId(raw: unknown) {
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const { searchParams } = new URL(request.url);
    const taxaId = parseId(searchParams.get("taxaId"));
    const clienteId = parseId(searchParams.get("clienteId")) ?? undefined;
    if (!taxaId) {
      return NextResponse.json({ ok: false, error: "taxaId é obrigatório" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<DescontoService>("services/sicaf-desconto.service");
    const result = await svc.getDescontoTaxa(taxaId, clienteId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar desconto";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();
    const taxaId = parseId(body.taxaId);
    const clienteId = parseId(body.clienteId) ?? undefined;
    if (!taxaId) {
      return NextResponse.json({ ok: false, error: "taxaId é obrigatório" }, { status: 400 });
    }
    const svc = await getSicafAgentModule<DescontoService>("services/sicaf-desconto.service");
    const result = await svc.aplicarDescontoTaxa({
      taxaId,
      clienteId,
      tipo: String(body.tipo || ""),
      valor: body.valor != null ? Number(body.valor) : undefined,
      motivo: body.motivo != null ? String(body.motivo) : undefined,
      usuarioId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao aplicar desconto";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
