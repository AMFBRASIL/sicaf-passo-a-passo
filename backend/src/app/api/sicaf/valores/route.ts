import { NextResponse } from "next/server";
import { requireLegacyUserId } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";

type DbConnection = {
  getDb: () => {
    (table: string): {
      where: (col: string, val: string) => { first: () => Promise<{ valor: string } | undefined> };
    };
  };
};

export async function GET(request: Request) {
  try {
    await requireLegacyUserId(request);
    const { getDb } = await getSicafAgentModule<DbConnection>("database/connection");
    const db = getDb();
    if (!db) {
      return NextResponse.json({ ok: false, error: "Banco de dados não disponível" }, { status: 500 });
    }

    const [cadastroRow, manutRow] = await Promise.all([
      db("configuracoes_sistema").where("chave", "valor_cadastro_sicaf").first(),
      db("configuracoes_sistema").where("chave", "valor_manutencao_mensal").first(),
    ]);

    return NextResponse.json({
      ok: true,
      valores: {
        valorCadastroSicaf: cadastroRow ? parseFloat(cadastroRow.valor) : 985.0,
        valorManutencaoMensal: manutRow ? parseFloat(manutRow.valor) : 155.0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar valores";
    const status =
      message.includes("Token") || message.includes("Sessão") || message.includes("authorization")
        ? 401
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
