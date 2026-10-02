import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Result = { ok: boolean; error?: string } & Record<string, unknown>;

type AssessoriaService = { getResumo: (clienteId: number) => Promise<Result> };

type ModulosService = {
  getTodos: (clienteId: number) => Promise<Result>;
  definirCortesia: (opts: {
    clienteId: number;
    modulo: string;
    ate: string | null;
    usuarioId: number;
  }) => Promise<Result>;
};

type LicitacoesEService = {
  getPainel: (clienteId: number) => Promise<Result>;
  atualizar: (opts: { clienteId: number; id: number; campos: unknown }) => Promise<Result>;
  responderApoio: (opts: {
    clienteId: number;
    id: number;
    observacao?: string;
    resolvido?: boolean;
    usuarioId: number;
  }) => Promise<Result>;
};

type ServicoEmailService = {
  reenviar: (opts: { clienteId: number; servico: string }) => Promise<Result>;
  preview: (opts: { clienteId: number; servico: string; renovacao?: boolean }) => Promise<Result>;
};

type Ctx = { params: Promise<{ id: string }> };

async function clienteIdDe(ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function erroResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Visão consolidada dos serviços do cliente: CAUFESP, BLL, módulos e acompanhamentos Licitações-e. */
export async function GET(request: Request, ctx: Ctx) {
  try {
    await requireStaffAccess(request);
    const clienteId = await clienteIdDe(ctx);
    if (!clienteId) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });

    const url = new URL(request.url);
    const previewServico = url.searchParams.get("preview");
    if (previewServico) {
      const emails = await getSicafAgentModule<ServicoEmailService>(
        "services/servico-ativado-email.service",
      );
      const result = await emails.preview({
        clienteId,
        servico: previewServico,
        renovacao: url.searchParams.get("renovacao") === "1",
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const [caufesp, bll, modulos, licitacoesE] = await Promise.all([
      getSicafAgentModule<AssessoriaService>("services/caufesp.service").then((s) =>
        s.getResumo(clienteId),
      ),
      getSicafAgentModule<AssessoriaService>("services/bll.service").then((s) =>
        s.getResumo(clienteId),
      ),
      getSicafAgentModule<ModulosService>("services/modulos-assinatura.service").then((s) =>
        s.getTodos(clienteId),
      ),
      getSicafAgentModule<LicitacoesEService>("services/licitacoes-e.service").then((s) =>
        s.getPainel(clienteId),
      ),
    ]);

    return NextResponse.json({
      ok: true,
      caufesp,
      bll,
      modulos: modulos.ok ? modulos.modulos : [],
      licitacoesE: licitacoesE.ok
        ? { acessoEtapas: licitacoesE.acessoEtapas, acompanhamentos: licitacoesE.acompanhamentos }
        : { acessoEtapas: [], acompanhamentos: [] },
    });
  } catch (error) {
    return erroResponse(error, "Erro ao carregar serviços do cliente");
  }
}

/** Ações da equipe: cortesia | licitacoes_e_atualizar | licitacoes_e_responder | reenviar_email */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const clienteId = await clienteIdDe(ctx);
    if (!clienteId) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    const body = (await request.json()) as Record<string, unknown>;

    let result: Result;
    switch (body.acao) {
      case "cortesia": {
        const svc = await getSicafAgentModule<ModulosService>("services/modulos-assinatura.service");
        result = await svc.definirCortesia({
          clienteId,
          modulo: String(body.modulo || ""),
          ate: body.ate ? String(body.ate) : null,
          usuarioId,
        });
        break;
      }
      case "licitacoes_e_atualizar": {
        const svc = await getSicafAgentModule<LicitacoesEService>("services/licitacoes-e.service");
        result = await svc.atualizar({ clienteId, id: Number(body.id) || 0, campos: body.campos });
        break;
      }
      case "licitacoes_e_responder": {
        const svc = await getSicafAgentModule<LicitacoesEService>("services/licitacoes-e.service");
        result = await svc.responderApoio({
          clienteId,
          id: Number(body.id) || 0,
          observacao: body.observacao ? String(body.observacao) : undefined,
          resolvido: Boolean(body.resolvido),
          usuarioId,
        });
        break;
      }
      case "reenviar_email": {
        const svc = await getSicafAgentModule<ServicoEmailService>(
          "services/servico-ativado-email.service",
        );
        result = await svc.reenviar({ clienteId, servico: String(body.servico || "") });
        break;
      }
      default:
        return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return erroResponse(error, "Erro ao atualizar serviço do cliente");
  }
}
