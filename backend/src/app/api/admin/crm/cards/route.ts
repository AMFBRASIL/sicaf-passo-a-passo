import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminCrmService = {
  listCrmCards: (opts: Record<string, string>) => Promise<Record<string, unknown>>;
  createCrmCard: (usuarioId: number, dados: Record<string, unknown>) => Promise<Record<string, unknown>>;
  listConsultores: () => Promise<Record<string, unknown>>;
  searchClientes: (search: string, limit?: number) => Promise<Record<string, unknown>>;
  sincronizarBoletosPagos: (usuarioId: number) => Promise<Record<string, unknown>>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const url = new URL(request.url);
    const svc = await getSicafAgentModule<AdminCrmService>("services/admin-crm.service");

    const resource = url.searchParams.get("resource");
    if (resource === "consultores") {
      const result = await svc.listConsultores();
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    }
    if (resource === "clientes") {
      const result = await svc.searchClientes(
        url.searchParams.get("search") || "",
        parseInt(url.searchParams.get("limit") || "30", 10),
      );
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    }

    const result = await svc.listCrmCards({
      search: url.searchParams.get("search") || "",
      consultorId: url.searchParams.get("consultorId") || "todos",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar CRM";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const body = await request.json();
    const svc = await getSicafAgentModule<AdminCrmService>("services/admin-crm.service");

    if (body?.action === "sincronizar-boletos") {
      const result = await svc.sincronizarBoletosPagos(usuarioId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const result = await svc.createCrmCard(usuarioId, body);
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar card CRM";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
