import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type DbRow = Record<string, unknown> & {
  id: number;
  status: string;
  tipo: string;
  provider_txid?: string;
  provider_charge_id?: string;
  origem?: string;
  origem_id?: number;
  data_pagamento?: unknown;
};

type DbConnection = {
  getDb: () => {
    (table: string): {
      whereNull: (col: string) => {
        where: (col: string, val: unknown) => {
          first: () => Promise<DbRow | undefined>;
          update: (data: Record<string, unknown>) => Promise<void>;
        };
      };
      where: (col: string, val: unknown) => {
        first: () => Promise<DbRow | undefined>;
        update: (data: Record<string, unknown>) => Promise<void>;
      };
    };
    fn: { now: () => unknown };
  } | null;
};

type GerencianetService = {
  consultarPix: (txid: string) => Promise<{ status?: string; pix?: { endToEndId?: string; horario?: string }[] }>;
  consultarCobranca: (chargeId: number) => Promise<{ data?: { status?: string }; status?: string }>;
};

type SicafTaxaService = {
  confirmarPagamento: (taxaId: number, usuarioId?: number) => Promise<{ ok: boolean; error?: string }>;
};

function pagamentosAtivos(db: NonNullable<ReturnType<DbConnection["getDb"]>>) {
  return db("pagamentos").whereNull("deleted_at");
}

export async function POST(request: Request) {
  try {
    await requireLegacyUserId(request);
    const { pagamentoId, txid, chargeId } = await request.json();

    const { getDb } = await getSicafAgentModule<DbConnection>("database/connection");
    const db = getDb();
    if (!db) {
      return NextResponse.json({ ok: false, error: "Banco de dados não disponível" }, { status: 500 });
    }

    let pgto: DbRow | undefined;
    if (pagamentoId) {
      pgto = await pagamentosAtivos(db).where("id", pagamentoId).first();
    } else if (txid) {
      pgto = await pagamentosAtivos(db).where("provider_txid", txid).first();
    } else if (chargeId) {
      pgto = await pagamentosAtivos(db).where("provider_charge_id", String(chargeId)).first();
    }

    if (!pgto) {
      return NextResponse.json({ ok: false, error: "Pagamento não encontrado" }, { status: 404 });
    }

    if (pgto.status === "pago") {
      return NextResponse.json({
        ok: true,
        status: "pago",
        message: "Pagamento já confirmado",
        dataPagamento: pgto.data_pagamento,
      });
    }

    const gn = await getSicafAgentModule<GerencianetService>("services/gerencianet.service");
    let gnData: Awaited<ReturnType<GerencianetService["consultarPix"]>> | Awaited<
      ReturnType<GerencianetService["consultarCobranca"]>
    >;
    let gnStatus = "";
    let newStatus = pgto.status;

    if (pgto.tipo === "pix" && pgto.provider_txid) {
      try {
        gnData = await gn.consultarPix(String(pgto.provider_txid));
        gnStatus = gnData?.status || "";
        if (gnStatus === "CONCLUIDA") newStatus = "pago";
        else if (gnStatus.startsWith("REMOVIDA")) newStatus = "cancelado";
        else newStatus = "aguardando";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao consultar gateway";
        console.error("[CheckStatus] Erro ao consultar PIX:", msg);
        return NextResponse.json({
          ok: true,
          status: pgto.status,
          gnStatus: "erro",
          message: "Erro ao consultar gateway",
        });
      }
    } else if (pgto.tipo === "boleto" && pgto.provider_charge_id) {
      try {
        gnData = await gn.consultarCobranca(Number(pgto.provider_charge_id));
        const bStatus = String(
          (gnData as { data?: { status?: string } })?.data?.status ||
            (gnData as { status?: string })?.status ||
            "",
        ).toLowerCase();
        if (["paid", "settled"].includes(bStatus)) newStatus = "pago";
        else if (["unpaid", "expired"].includes(bStatus)) newStatus = "expirado";
        else if (["canceled", "refunded"].includes(bStatus)) newStatus = "cancelado";
        else newStatus = "aguardando";
        gnStatus = bStatus;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao consultar gateway";
        console.error("[CheckStatus] Erro ao consultar boleto:", msg);
        return NextResponse.json({
          ok: true,
          status: pgto.status,
          gnStatus: "erro",
          message: "Erro ao consultar gateway",
        });
      }
    } else {
      return NextResponse.json({
        ok: true,
        status: pgto.status,
        message: "Sem dados para consultar gateway",
      });
    }

    if (newStatus === "pago" && pgto.status !== "pago") {
      const updateData: Record<string, unknown> = { status: "pago", data_pagamento: db.fn.now() };

      if (pgto.tipo === "pix" && gnData && "pix" in gnData && Array.isArray(gnData.pix) && gnData.pix.length > 0) {
        updateData.provider_e2eid = gnData.pix[0].endToEndId || null;
        if (gnData.pix[0].horario) updateData.data_pagamento = new Date(gnData.pix[0].horario);
      }

      await db("pagamentos").where("id", pgto.id).update(updateData);

      if (pgto.origem === "sicaf" && pgto.origem_id) {
        const sicafTaxa = await getSicafAgentModule<SicafTaxaService>("services/sicaf-taxa.service");
        await sicafTaxa.confirmarPagamento(pgto.origem_id);
      } else if (pgto.origem === "manutencao" && pgto.origem_id) {
        await db("manutencao_boletos").where("id", pgto.origem_id).update({
          status: "Pago",
          data_pagamento: db.fn.now(),
        });
      }

      return NextResponse.json({
        ok: true,
        status: "pago",
        confirmed: true,
        message: "Pagamento confirmado com sucesso!",
        dataPagamento: updateData.data_pagamento,
      });
    }

    if (["expirado", "cancelado"].includes(newStatus) && pgto.status !== newStatus) {
      await db("pagamentos").where("id", pgto.id).update({ status: newStatus });
    }

    return NextResponse.json({
      ok: true,
      status: newStatus,
      gnStatus,
      message: newStatus === "aguardando" ? "Aguardando pagamento" : `Status: ${newStatus}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao verificar pagamento";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
