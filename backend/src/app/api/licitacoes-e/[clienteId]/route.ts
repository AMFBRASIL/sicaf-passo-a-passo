import { NextResponse } from "next/server";
import { autorizarClienteModulo } from "@/lib/auth/modulo-acesso";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type Result = { ok: boolean; error?: string } & Record<string, unknown>;

type LicitacoesEService = {
  getPainel: (clienteId: number) => Promise<Result>;
  salvarAcesso: (opts: { clienteId: number; etapas: unknown }) => Promise<Result>;
  criar: (opts: { clienteId: number; usuarioId: number; dados: unknown }) => Promise<Result>;
  atualizar: (opts: { clienteId: number; id: number; campos: unknown }) => Promise<Result>;
  salvarAnalise: (opts: {
    clienteId: number;
    id: number;
    editalUrl?: string;
    editalNome?: string;
    analise: unknown;
  }) => Promise<Result>;
  solicitarApoio: (opts: { clienteId: number; id: number; mensagem?: string }) => Promise<Result>;
  remover: (opts: { clienteId: number; id: number }) => Promise<Result>;
};

type Ctx = { params: Promise<{ clienteId: string }> };

async function autorizar(request: Request, ctx: Ctx) {
  const auth = await autorizarClienteModulo(request, (await ctx.params).clienteId, "licitacoes_e");
  if ("erro" in auth) return auth;
  const svc = await getSicafAgentModule<LicitacoesEService>("services/licitacoes-e.service");
  return { clienteId: auth.clienteId, usuarioId: auth.usuarioId, svc };
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
    return erroResponse(error, "Erro ao carregar o Assistente Licitações-e");
  }
}

/** Ações: acesso | criar | atualizar | analise | apoio | remover */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await autorizar(request, ctx);
    if ("erro" in auth) return auth.erro;
    const body = (await request.json()) as Record<string, unknown>;
    const { svc, clienteId } = auth;
    const id = Number(body.id) || 0;

    let result: Result;
    switch (body.acao) {
      case "acesso":
        result = await svc.salvarAcesso({ clienteId, etapas: body.etapas });
        break;
      case "criar":
        result = await svc.criar({ clienteId, usuarioId: auth.usuarioId, dados: body.dados });
        break;
      case "atualizar":
        result = await svc.atualizar({ clienteId, id, campos: body.campos });
        break;
      case "analise":
        result = await svc.salvarAnalise({
          clienteId,
          id,
          editalUrl: body.editalUrl ? String(body.editalUrl) : undefined,
          editalNome: body.editalNome ? String(body.editalNome) : undefined,
          analise: body.analise,
        });
        break;
      case "apoio":
        result = await svc.solicitarApoio({
          clienteId,
          id,
          mensagem: body.mensagem ? String(body.mensagem) : undefined,
        });
        break;
      case "remover":
        result = await svc.remover({ clienteId, id });
        break;
      default:
        return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return erroResponse(error, "Erro no Assistente Licitações-e");
  }
}
