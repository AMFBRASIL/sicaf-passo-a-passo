-- Renomeia etapas do CRM: analise → em_negociacao, negociacao → em_uso
-- Execute: npm run db:migrate:sql -- scripts/db/migrations/crm-clientes-rename-stages.sql

ALTER TABLE crm_cards
  MODIFY stage ENUM(
    'analise','boleto','liberado','negociacao','cancelado',
    'em_negociacao','em_uso'
  ) NOT NULL DEFAULT 'analise';

UPDATE crm_cards SET stage = 'em_negociacao' WHERE stage = 'analise';
UPDATE crm_cards SET stage = 'em_uso' WHERE stage = 'negociacao';

ALTER TABLE crm_cards
  MODIFY stage ENUM(
    'em_negociacao','boleto','liberado','em_uso','cancelado'
  ) NOT NULL DEFAULT 'em_negociacao';
