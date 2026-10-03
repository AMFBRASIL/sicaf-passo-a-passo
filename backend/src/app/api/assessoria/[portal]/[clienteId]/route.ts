import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type Result = { ok: boolean; error?: string } & Record<string, unknown>;

type AssessoriaService = {
  getPainel: (clienteId: number) => Promise<Result>;
  gerarCobranca: (opts: {
    clienteId: number;
    formaPagamento: string;
    geradoPor?: number;
  }) => Promise<Result>;
  definirAtividade: (opts: { clienteId: number; atividade: string }) => Promise<Result>;
  salvarDocumento: (opts: {
    clienteId: number;
    codigo: string;
    arquivoUrl: string;
    arquivoNome?: string | null;
    dataValidade?: string | null;
    usuarioId?: number;
  }) => Promise<Result>;
  removerDocumento: (opts: { clienteId: number; codigo: string }) => Promise<Result>;
  salvarTermoAssinado: (opts: {
    clienteId: number;
    arquivoUrl: string;
    arquivoNome?: string | null;
  }) => Promise<Result>;
  enviarParaAnalise: (opts: {
    clienteId: number;
    observacao?: string;
    usuarioId?: number;
  }) => Promise<Result>;
  atualizarProcessoAdmin: (opts: Record<string, unknown>) => Promise<Result>;
};

type ClientAccessService = {
  assertClienteAcessivelById: (
    clienteId: number,
    usuarioId: number,
    jwtTipo?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  checkUsuarioIsStaff: (usuarioId: number, jwtTipo?: string) => Promise<boolean>;
};

const MODULOS: Record<string, string> = {
  caufesp: "services/caufesp.service",
  bll: "services/bll.service",
};

type Ctx = { params: Promise<{ portal: string; clienteId: string }> };

async function autorizar(request: Request, ctx: Ctx) {
  const { usuarioId, tipo } = await requireLegacyAuth(request);
  const params = await ctx.params;
  const modulo = MODULOS[params.portal];
  if (!modulo) {
    return { erro: NextResponse.json({ ok: false, error: "Portal inválido" }, { status: 404 }) };
  }
  const id = parseInt(params.clienteId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { erro: NextResponse.json({ ok: false, error: "Cliente inválido" }, { status: 400 }) };
  }
  const access = await getSicafAgentModule<ClientAccessService>("services/client-access.service");
  const acesso = await access.assertClienteAcessivelById(id, usuarioId, tipo);
  if (!acesso.ok) return { erro: NextResponse.json(acesso, { status: 404 }) };
  const svc = await getSicafAgentModule<AssessoriaService>(modulo);
  return { clienteId: id, usuarioId, tipo, access, svc };
}

function erroResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const auth = await autorizar(request, ctx);
    if ("erro" in auth) return auth.erro;
    const result = await auth.svc.getPainel(auth.clienteId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return erroResponse(error, "Erro ao carregar processo");
  }
}

/** Ações do cliente: cobranca | atividade | documento | remover_documento | enviar_analise | termo_assinado */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await autorizar(request, ctx);
    if ("erro" in auth) return auth.erro;
    const body = (await request.json()) as Record<string, unknown>;
    const s = auth.svc;
    const clienteId = auth.clienteId;

    let result: Result;
    switch (body.acao) {
      case "cobranca":
        result = await s.gerarCobranca({
          clienteId,
          formaPagamento: String(body.formaPagamento || ""),
          geradoPor: auth.usuarioId,
        });
        break;
      case "atividade":
        result = await s.definirAtividade({ clienteId, atividade: String(body.atividade || "") });
        break;
      case "documento":
        result = await s.salvarDocumento({
          clienteId,
          codigo: String(body.codigo || ""),
          arquivoUrl: String(body.arquivoUrl || ""),
          arquivoNome: body.arquivoNome ? String(body.arquivoNome) : null,
          dataValidade: body.dataValidade ? String(body.dataValidade) : null,
          usuarioId: auth.usuarioId,
        });
        break;
      case "remover_documento":
        result = await s.removerDocumento({ clienteId, codigo: String(body.codigo || "") });
        break;
      case "termo_assinado":
        result = await s.salvarTermoAssinado({
          clienteId,
          arquivoUrl: String(body.arquivoUrl || ""),
          arquivoNome: body.arquivoNome ? String(body.arquivoNome) : null,
        });
        break;
      case "enviar_analise":
        result = await s.enviarParaAnalise({
          clienteId,
          observacao: body.observacao ? String(body.observacao) : undefined,
          usuarioId: auth.usuarioId,
        });
        break;
      default:
        return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return erroResponse(error, "Erro no processo");
  }
}

/** Equipe CADBRASIL: status, protocolo, validade do cadastro, avaliação de documentos e termo do portal. */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const auth = await autorizar(request, ctx);
    if ("erro" in auth) return auth.erro;
    const isStaff = await auth.access.checkUsuarioIsStaff(auth.usuarioId, auth.tipo);
    if (!isStaff) {
      return NextResponse.json(
        { ok: false, error: "Apenas a equipe CADBRASIL pode atualizar o processo." },
        { status: 403 },
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const result = await auth.svc.atualizarProcessoAdmin({
      clienteId: auth.clienteId,
      status: body.status,
      observacaoCadbrasil: body.observacaoCadbrasil,
      protocoloPortal: body.protocoloPortal,
      cadastroValidade: body.cadastroValidade,
      documentos: body.documentos,
      termoModelo: body.termoModelo,
      termoAvaliacao: body.termoAvaliacao,
      usuarioId: auth.usuarioId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return erroResponse(error, "Erro ao atualizar processo");
  }
}
