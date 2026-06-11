/**
 * Insere/atualiza os 2 planos de cadastro SICAF na tabela planos (já existente).
 *
 * Uso: npm run db:seed-planos-sicaf
 *
 * Preço padrão: valor_cadastro_sicaf em configuracoes_sistema (fallback 985).
 * Preço imediato: valor_cadastro_sicaf_imediato se existir (fallback 1480).
 */
import { createConnection, getCredentialsFromEnv } from "./sql-runner";

async function readConfigValor(
  conn: Awaited<ReturnType<typeof createConnection>>,
  chave: string,
  fallback: number,
): Promise<number> {
  try {
    const [rows] = await conn.query<{ valor: string }[]>(
      "SELECT valor FROM configuracoes_sistema WHERE chave = ? LIMIT 1",
      [chave],
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    const n = row?.valor != null ? parseFloat(String(row.valor)) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

async function main() {
  const { legacy } = getCredentialsFromEnv();
  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — Seed planos SICAF cadastro");
  console.log(` Banco: ${legacy.database} @ ${legacy.host}`);
  console.log("═══════════════════════════════════════════════════════\n");

  const conn = await createConnection(legacy, { database: legacy.database });

  try {
    const [tables] = await conn.query<{ TABLE_NAME: string }[]>(
      "SHOW TABLES LIKE 'planos'",
    );
    if (!Array.isArray(tables) || tables.length === 0) {
      throw new Error("Tabela planos não encontrada neste banco.");
    }
    console.log("✔ Tabela planos encontrada");

    const precoPadrao = await readConfigValor(conn, "valor_cadastro_sicaf", 985);
    const precoImediato = await readConfigValor(conn, "valor_cadastro_sicaf_imediato", 1480);
    console.log(`  Preço padrão: R$ ${precoPadrao.toFixed(2)} (configuracoes_sistema)`);
    console.log(`  Preço imediato: R$ ${precoImediato.toFixed(2)}`);

    const recursosPadrao = JSON.stringify({
      categoria: "sicaf_cadastro",
      prazo: "Liberado em até 24 horas",
      badge: "Mais escolhido",
      icon: "briefcase",
    });
    const recursosImediato = JSON.stringify({
      categoria: "sicaf_cadastro",
      prazo: "Início imediato — prioridade máxima",
      badge: "Mais rápido",
      icon: "zap",
    });

    await conn.query(
      `INSERT INTO planos (codigo, nome, descricao, tipo, preco, recursos, destaque, ativo, ordem)
       VALUES (?, ?, ?, 'sob_demanda', ?, ?, 0, 1, 1)
       ON DUPLICATE KEY UPDATE
         nome = VALUES(nome),
         descricao = VALUES(descricao),
         preco = VALUES(preco),
         recursos = VALUES(recursos),
         ativo = 1,
         ordem = 1,
         updated_at = CURRENT_TIMESTAMP`,
      [
        "sicaf_padrao",
        "Cadastro Padrão",
        "Ideal para quem se planejou e não tem urgência. Equipe CADBRASIL cuida de tudo no próximo dia útil.",
        precoPadrao,
        recursosPadrao,
      ],
    );

    await conn.query(
      `INSERT INTO planos (codigo, nome, descricao, tipo, preco, recursos, destaque, ativo, ordem)
       VALUES (?, ?, ?, 'sob_demanda', ?, ?, 1, 1, 2)
       ON DUPLICATE KEY UPDATE
         nome = VALUES(nome),
         descricao = VALUES(descricao),
         preco = VALUES(preco),
         recursos = VALUES(recursos),
         destaque = 1,
         ativo = 1,
         ordem = 2,
         updated_at = CURRENT_TIMESTAMP`,
      [
        "sicaf_imediato",
        "Liberação Imediata",
        "Sua empresa entra na frente da fila. Nosso time começa agora mesmo a regularização do SICAF.",
        precoImediato,
        recursosImediato,
      ],
    );

    const [planos] = await conn.query<
      { codigo: string; nome: string; preco: string; ativo: number }[]
    >(
      "SELECT codigo, nome, preco, ativo FROM planos WHERE codigo IN ('sicaf_padrao','sicaf_imediato') ORDER BY ordem",
    );

    console.log("\n✔ Planos SICAF cadastro (upsert por codigo):");
    for (const p of planos as { codigo: string; nome: string; preco: string; ativo: number }[]) {
      console.log(`  • ${p.codigo} — ${p.nome} — R$ ${parseFloat(p.preco).toFixed(2)}`);
    }
    console.log("\nConcluído. Demais registros em planos não foram alterados.");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
