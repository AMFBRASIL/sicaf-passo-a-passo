import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type SicafTaxaService = {
  gerarTaxa: (opts: {
    clienteId: number;
    ano: number;
    formaPagamento: string;
    dataVencimento?: string | null;
    allowCustomDueDate?: boolean;
    geradoPor?: number;
    planoCodigo?: string;
  }) => Promise<{ ok: boolean; error?: string; dados?: unknown }>;
};

type ClientAccessModule = {
  checkUsuarioIsStaff: (usuarioId: number, jwtTipo?: string) => Promise<boolean>;
};

export async function POST(request: Request) {
  try {
    const auth = await requireLegacyAuth(request);
    const data = await request.json();
    const access = await getSicafAgentModule<ClientAccessModule>("services/client-access.service");
    const isStaff = await access.checkUsuarioIsStaff(auth.usuarioId, auth.tipo);

    const svc = await getSicafAgentModule<SicafTaxaService>("services/sicaf-taxa.service");

    const result = await svc.gerarTaxa({
      clienteId: data.clienteId,
      ano: data.ano || new Date().getFullYear(),
      formaPagamento: data.formaPagamento,
      dataVencimento: data.dataVencimento || null,
      allowCustomDueDate: isStaff && !!data.allowCustomDueDate,
      geradoPor: auth.usuarioId,
      planoCodigo: data.planoCodigo || null,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar taxa";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
