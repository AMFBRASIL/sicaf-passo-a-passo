import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Resultado = Promise<Record<string, unknown> & { ok?: boolean }>;

type CaptacaoService = {
  detalhe: (opts: Record<string, unknown>) => Resultado;
  preview: (opts: Record<string, unknown>) => Resultado;
  enviarTeste: (opts: Record<string, unknown>) => Resultado;
  criarCampanha: (opts: Record<string, unknown>) => Resultado;
  registrarContato: (opts: Record<string, unknown>) => Resultado;
  criarRotina: (opts: Record<string, unknown>) => Resultado;
};

function statusFromError(message: string) {
  if (message.includes("Token") || message.includes("Sessão")) return 401;
  if (message.includes("restrito")) return 403;
  if (message.includes("não encontrado")) return 404;
  return 500;
}

export async function GET(request: Request, context: { params: Promise<{ servico: string }> }) {
  try {
    await requireStaffAccess(request);
    const { servico } = await context.params;
    const url = new URL(request.url);
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    const result = await svc.detalhe({
      servico,
      uf: url.searchParams.get("uf") || "",
      cooldownDias: url.searchParams.get("cooldown") || "0",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar serviço";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}

export async function POST(request: Request, context: { params: Promise<{ servico: string }> }) {
  try {
    const { usuarioId } = await requireStaffAccess(request);
    const { servico } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown> & {
      action?: string;
    };
    const svc = await getSicafAgentModule<CaptacaoService>("services/servicos-captacao.service");
    const dados = { ...body, servico, usuarioId };

    let result: Awaited<Resultado>;
    if (body.action === "preview") result = await svc.preview(dados);
    else if (body.action === "teste") result = await svc.enviarTeste(dados);
    else if (body.action === "campanha") result = await svc.criarCampanha(dados);
    else if (body.action === "contato") result = await svc.registrarContato(dados);
    else if (body.action === "rotina") result = await svc.criarRotina(dados);
    else return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na ação";
    return NextResponse.json({ ok: false, error: message }, { status: statusFromError(message) });
  }
}
