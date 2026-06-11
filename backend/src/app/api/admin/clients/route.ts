import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClientsService = {
  listClientsForAdmin: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  createClient: (data: Record<string, unknown>, usuarioId: number) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const url = new URL(request.url);
    const svc = await getSicafAgentModule<AdminClientsService>("services/admin-clients.service");
    const result = await svc.listClientsForAdmin({
      search: url.searchParams.get("search") || "",
      status: url.searchParams.get("status") || "all",
      sicaf: url.searchParams.get("sicaf") || "all",
      city: url.searchParams.get("city") || "all",
      page: parseInt(url.searchParams.get("page") || "1", 10),
      limit: parseInt(url.searchParams.get("limit") || "200", 10),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar clientes";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const body = await request.json();
    const svc = await getSicafAgentModule<AdminClientsService>("services/admin-clients.service");
    const result = await svc.createClient(
      {
        documento: body.cnpj || body.documento,
        razaoSocial: body.razao || body.razaoSocial,
        nomeFantasia: body.fantasia || body.nomeFantasia,
        email: body.email,
        telefone: body.telefone,
        celular: body.whatsapp || body.celular,
        cidade: body.cidade,
        estado: body.uf || body.estado,
        cep: body.cep,
        endereco: body.endereco,
        numero: body.numero,
        complemento: body.complemento,
        bairro: body.bairro,
        porte: body.porte,
        ramoAtividade: body.segmento || body.ramoAtividade,
        responsavelNome: body.responsavel,
        responsavelEmail: body.email,
        responsavelTelefone: body.telefone,
        inscricaoEstadual: body.ie,
        observacoes: body.observacoes,
      },
      usuarioId,
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar cliente";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
