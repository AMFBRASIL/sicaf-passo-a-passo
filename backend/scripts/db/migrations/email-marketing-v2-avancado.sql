-- Email Marketing v2 — públicos avançados + formato HTML
-- Execute no MySQL de produção após o email-marketing.sql base:
--   mysql -u USER -p DATABASE < backend/scripts/db/migrations/email-marketing-v2-avancado.sql

ALTER TABLE email_mkt_campanhas
  MODIFY COLUMN publico_tipo ENUM(
    'manutencao',
    'nunca_pagaram',
    'taxa_pendente',
    'ja_pagaram',
    'sem_manutencao',
    'cnae',
    'cert-venc',
    'sicaf',
    'novos',
    'todos'
  ) NOT NULL DEFAULT 'manutencao';

-- Formato do corpo (texto simples ou HTML completo)
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'email_mkt_campanhas'
    AND COLUMN_NAME = 'formato'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE email_mkt_campanhas ADD COLUMN formato ENUM(''texto'',''html'') NOT NULL DEFAULT ''texto'' AFTER corpo',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
