-- Adiciona status 'pausado' para pausar/retomar campanhas de email marketing
-- mysql -u USER -p DATABASE < backend/scripts/db/migrations/email-marketing-v3-pausar.sql

ALTER TABLE email_mkt_campanhas
  MODIFY COLUMN status ENUM(
    'rascunho','agendado','enviando','enviado','falhou','cancelado','pausado'
  ) NOT NULL DEFAULT 'rascunho';
