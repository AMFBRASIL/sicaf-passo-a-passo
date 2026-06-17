import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientsService = {
  createClient: (
    data: Record<string, unknown>,
    usuarioId: number,
  ) => Promise<{ ok: boolean; error?: string; clienteId?: number; sicafId?: number; message?: string }>;
};

export async function POST(request: Request) {
  try {
    const usuarioId = await requireLegacyUserId(request);
    const body = await request.json();

    const svc = await getSicafAgentModule<ClientsService>("services/clients.service");
    const result = await svc.createClient(
      {
        documento: body.documento || body.cnpj,
        razaoSocial: body.razaoSocial || body.razao,
        nomeFantasia: body.nomeFantasia || body.fantasia,
        inscricaoEstadual: body.inscricaoEstadual || body.ie,
        inscricaoMunicipal: body.inscricaoMunicipal,
        email: body.email,
        telefone: body.telefone,
        celular: body.celular || body.whatsapp,
        cidade: body.cidade,
        estado: body.estado || body.uf,
        cep: body.cep,
        endereco: body.endereco,
        numero: body.numero,
        complemento: body.complemento,
        bairro: body.bairro,
        porte: body.porte,
        ramoAtividade: body.ramoAtividade || body.segmento,
        responsavelNome: body.responsavelNome || body.responsavel,
        responsavelCpf: body.responsavelCpf,
        responsavelEmail: body.responsavelEmail || body.email,
        responsavelTelefone: body.responsavelTelefone || body.telefone,
        observacoes: body.observacoes,
      },
      usuarioId,
    );

    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cadastrar empresa";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
