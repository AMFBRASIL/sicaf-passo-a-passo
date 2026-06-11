/**
 * Configuração compartilhada: truncate + ETL v1 → v2.
 *
 * Tabelas em V2_TABLES_PRESERVE não são truncadas e não recebem dados do legado
 * (configurações, catálogos do v2, seeds).
 */

/** Config / catálogo do v2 — mantém dados atuais após truncate+migração */
export const V2_TABLES_PRESERVE = [
  "configuracoes_sistema",
  "planos",
  "templates_email",
  "pacotes_leitura_ia",
  "automacoes",
  "funil_estagios",
  "google_ads_campanhas",
] as const;

/** Destinos do ETL que não devem ser importados do legado (modo --dados) */
export const ETL_TARGETS_SKIP_CONFIG = new Set<string>([
  ...V2_TABLES_PRESERVE,
]);

/** Tabelas operacionais migradas do legado (para log/resumo) */
export const MIGRATION_DOMAINS = [
  "Acesso (usuários, perfis, menus, auditoria)",
  "Clientes (cadastro, contatos, certificados, contratos digitais)",
  "SICAF (cadastros, níveis, renovações, análises, certidões)",
  "Manutenção e taxas SICAF",
  "Pagamentos e NFS-e",
  "Documentos",
  "Licitações e coleta",
  "Propostas e workflow",
  "Análises de edital / IA (uso)",
  "Tickets e alertas",
  "Notificações e preferências",
  "Processos, tracking e Google Ads",
] as const;
