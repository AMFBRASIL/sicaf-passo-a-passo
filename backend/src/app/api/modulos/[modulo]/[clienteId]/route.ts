import { NextResponse } from "next/server";
import { autorizarClienteModulo, MODULOS_PAGOS, type ModuloPago } from "@/lib/auth/modulo-acesso";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Result = { ok: boolean; error?: string } & Record<string, unknown>;

type ModulosAssinaturaService = {
  getStatus: (clienteId: number, modulo: ModuloPago) => Promise<Result>;
  getTodos: (clienteId: number) => Promise<Result & { modulos?: Result[] }>;
  gerarCobranca: (opts: {
    clienteId: number;
    modulo: ModuloPago;
    formaPagamento: string;
    geradoPor?: number;
  }) => Promise<Result>;
};

type Ctx = { params: Promise<{ modulo: string; clienteId: string }> };

function erroResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

function moduloValido(modulo: string): modulo is ModuloPago {
  return (MODULOS_PAGOS as readonly string[]).includes(modulo);
}

/** Situação da assinatura + mensalidades (boletos/PIX). `modulo = todos` retorna os dois. */
export async function GET(request: Request, ctx: Ctx) {
  try {
    const { modulo, clienteId } = await ctx.params;
    if (modulo !== "todos" && !moduloValido(modulo)) {
      return NextResponse.json({ ok: false, error: "Módulo inválido" }, { status: 400 });
    }
    const auth = await autorizarClienteModulo(request, clienteId);
    if ("erro" in auth) return auth.erro;

    const svc = await getSicafAgentModule<ModulosAssinaturaService>(
      "services/modulos-assinatura.service",
    );
    if (modulo === "todos") {
      const result = await svc.getTodos(auth.clienteId);
      return NextResponse.json(
        { ...result, acessoEquipe: auth.staff },
        { status: result.ok ? 200 : 400 },
      );
    }
    const result = await svc.getStatus(auth.clienteId, modulo);
    return NextResponse.json(
      { ...result, acessoEquipe: auth.staff },
      { status: result.ok ? 200 : 400 },
    );
  } catch (error) {
    return erroResponse(error, "Erro ao consultar o módulo");
  }
}

/** Gera a mensalidade do módulo: { formaPagamento: "boleto" | "pix" } */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const { modulo, clienteId } = await ctx.params;
    if (!moduloValido(modulo)) {
      return NextResponse.json({ ok: false, error: "Módulo inválido" }, { status: 400 });
    }
    const auth = await autorizarClienteModulo(request, clienteId);
    if ("erro" in auth) return auth.erro;

    const body = (await request.json().catch(() => ({}))) as { formaPagamento?: string };
    const svc = await getSicafAgentModule<ModulosAssinaturaService>(
      "services/modulos-assinatura.service",
    );
    const result = await svc.gerarCobranca({
      clienteId: auth.clienteId,
      modulo,
      formaPagamento: String(body.formaPagamento || ""),
      geradoPor: auth.usuarioId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return erroResponse(error, "Erro ao gerar a mensalidade do módulo");
  }
}
