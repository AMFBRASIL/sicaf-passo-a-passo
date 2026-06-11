/**
 * Validação pós-ETL via Node.js (dual-connection).
 * Compara contagens v1 vs v2 — esperado diff = 0.
 */
import type { RowDataPacket } from "mysql2/promise";
import { createConnection, getCredentialsFromEnv } from "./sql-runner";

type CountPair = {
  tabela: string;
  v1Table?: string;
  note?: string;
};

const COUNT_1_1: CountPair[] = [
  { tabela: "usuarios" },
  { tabela: "perfis_acesso" },
  { tabela: "permissoes_pagina" },
  { tabela: "menus" },
  { tabela: "login_logs" },
  { tabela: "clientes" },
  { tabela: "cliente_contatos" },
  { tabela: "usuario_clientes" },
  { tabela: "clientes_certificados_digitais", v1Table: "clientes_certificado_digital" },
  { tabela: "contratos_digitais" },
  { tabela: "sicaf_cadastros" },
  { tabela: "sicaf_niveis" },
  { tabela: "sicaf_renovacoes" },
  { tabela: "sicaf_analises" },
  { tabela: "tipo_certidoes" },
  { tabela: "certidoes" },
  { tabela: "manutencoes" },
  { tabela: "manutencao_boletos" },
  { tabela: "manutencao_renovacoes" },
  { tabela: "manutencao_uso_log" },
  { tabela: "taxas_sicaf" },
  { tabela: "pagamentos", v1Table: "pagamentos_gerencianet" },
  { tabela: "nfse_servicos" },
  { tabela: "pastas_documentos" },
  { tabela: "documentos" },
  { tabela: "orgaos" },
  { tabela: "uasgs" },
  { tabela: "fornecedores" },
  { tabela: "licitacoes" },
  { tabela: "itens_licitacao" },
  { tabela: "fornecedores_licitacao" },
  { tabela: "contratos" },
  { tabela: "atas_registro_preco" },
  { tabela: "coleta_logs" },
  { tabela: "concorrentes" },
  { tabela: "resultados_licitacao" },
  { tabela: "licitacoes_mira" },
  { tabela: "licitacoes_radar_regras" },
  { tabela: "licitacoes_resumo_ia" },
  { tabela: "propostas" },
  { tabela: "workflow_aprovacao" },
  { tabela: "analises_edital" },
  { tabela: "leituras_edital_ia" },
  { tabela: "compras_pacotes_ia" },
  { tabela: "usuario_creditos_ia" },
  { tabela: "processos_execucoes" },
  { tabela: "tickets" },
  { tabela: "ticket_mensagens" },
  { tabela: "ticket_anexos" },
  { tabela: "alertas" },
  { tabela: "tracking_sessoes" },
  { tabela: "tracking_eventos" },
  { tabela: "google_ads_conversoes" },
];

const UNIFIED: CountPair[] = [
  {
    tabela: "auditoria_log",
    note: "audit_log + historico_acoes → auditoria_log",
  },
  {
    tabela: "notificacoes",
    v1Table: "notificacoes_certidoes",
    note: "notificacoes_certidoes → notificacoes",
  },
  {
    tabela: "notificacoes_preferencias",
    v1Table: "configuracoes_notificacao",
    note: "configuracoes_notificacao → notificacoes_preferencias",
  },
];

async function countTable(
  conn: Awaited<ReturnType<typeof createConnection>>,
  table: string,
): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS c FROM \`${table}\``);
  return Number(rows[0]?.c ?? 0);
}

async function main() {
  const { legacy, write, v2SchemaName } = getCredentialsFromEnv();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" CADBRASIL — Validação pós-ETL (Node.js)");
  console.log(` ${legacy.database} vs ${v2SchemaName}`);
  console.log("═══════════════════════════════════════════════════════\n");

  const legacyConn = await createConnection(legacy, { database: legacy.database });
  const writeConn = await createConnection(write, { database: v2SchemaName });

  const results: { tabela: string; v1: number; v2: number; diff: number; note?: string }[] = [];
  let failures = 0;

  try {
    console.log("=== CONTAGEM 1:1 ===\n");

    for (const item of COUNT_1_1) {
      const v1Name = item.v1Table ?? item.tabela;
      const [v1, v2] = await Promise.all([
        countTable(legacyConn, v1Name),
        countTable(writeConn, item.tabela),
      ]);
      const diff = v2 - v1;
      results.push({ tabela: item.tabela, v1, v2, diff, note: item.note });
      if (diff !== 0) failures++;
    }

    console.log("=== TABELAS UNIFICADAS / RENOMEADAS ===\n");

    for (const item of UNIFIED) {
      let v1: number;
      if (item.tabela === "auditoria_log") {
        const [audit, hist] = await Promise.all([
          countTable(legacyConn, "audit_log"),
          countTable(legacyConn, "historico_acoes"),
        ]);
        v1 = audit + hist;
      } else {
        v1 = await countTable(legacyConn, item.v1Table ?? item.tabela);
      }
      const v2 = await countTable(writeConn, item.tabela);
      const diff = v2 - v1;
      results.push({ tabela: item.tabela, v1, v2, diff, note: item.note });
      if (diff !== 0) failures++;
    }

    console.table(results);

    const integrity = await writeConn.query<RowDataPacket[]>(`
      SELECT 'clientes_sem_usuario' AS check_name, COUNT(*) AS problemas
        FROM clientes c
        LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE u.id IS NULL
      UNION ALL
      SELECT 'sicaf_sem_cliente', COUNT(*)
        FROM sicaf_cadastros s
        LEFT JOIN clientes c ON c.id = s.cliente_id
       WHERE c.id IS NULL
      UNION ALL
      SELECT 'certidoes_sem_cliente', COUNT(*)
        FROM certidoes ce
        LEFT JOIN clientes c ON c.id = ce.cliente_id
       WHERE c.id IS NULL
    `);

    console.log("\n=== INTEGRIDADE REFERENCIAL ===\n");
    console.table(integrity[0]);

    const integrityFailures = (integrity[0] as RowDataPacket[]).filter(
      (r) => Number(r.problemas) > 0,
    );
    failures += integrityFailures.length;

    if (failures > 0) {
      console.error(`\n❌ Validação falhou: ${failures} divergência(s).`);
      process.exit(1);
    }

    console.log("\n✅ Validação concluída — todas as contagens batem (diff = 0).");
  } finally {
    await legacyConn.end();
    await writeConn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
