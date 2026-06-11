import { NextResponse } from "next/server";
import { requireLegacyAuth } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type ClientAccessService = {
  isUsuarioStaff: (db: unknown, usuarioId: number, jwtTipo?: string) => Promise<boolean>;
};

type PagamentosService = {
  gerarBoletoManutencao: (opts: {
    boletoId: number;
    clienteId: number;
    dataVencimento?: string;
    allowCustomDueDate?: boolean;
    geradoPor?: number;
  }) => Promise<{ ok: boolean; error?: string; [key: string]: unknown }>;
};

export async function POST(request: Request) {
  try {
    const { usuarioId, tipo } = await requireLegacyAuth(request);
    const data = await request.json();

    const boletoId = parseInt(String(data.boletoId), 10);
    const clienteId = parseInt(String(data.clienteId), 10);
    if (!Number.isFinite(boletoId) || boletoId <= 0 || !Number.isFinite(clienteId) || clienteId <= 0) {
      return NextResponse.json({ ok: false, error: "boletoId e clienteId são obrigatórios" }, { status: 400 });
    }

    const access = await getSicafAgentModule<ClientAccessService>("services/client-access.service");
    const dbMod = await getSicafAgentModule<{ getDb: () => unknown }>("database/connection");
    const db = dbMod.getDb();
    const allowCustomDueDate = db ? await access.isUsuarioStaff(db, usuarioId, tipo) : false;

    const svc = await getSicafAgentModule<PagamentosService>("services/pagamentos.service");
    const result = await svc.gerarBoletoManutencao({
      boletoId,
      clienteId,
      dataVencimento: allowCustomDueDate ? data.dataVencimento || undefined : undefined,
      allowCustomDueDate,
      geradoPor: usuarioId,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar boleto";
    const status = message.includes("Token") || message.includes("Sessão") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
