-- Email Marketing (Admin → CRM)
-- Execute no MySQL de produção:
--   mysql -u USER -p DATABASE < backend/scripts/db/migrations/email-marketing.sql
-- Ou: npm run db:migrate:sql -- scripts/db/migrations/email-marketing.sql

CREATE TABLE IF NOT EXISTS email_mkt_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(180) NOT NULL,
  assunto VARCHAR(255) NOT NULL,
  corpo MEDIUMTEXT NOT NULL,
  categoria ENUM('licitacoes','certidoes','avisos','boas-vindas') NOT NULL DEFAULT 'avisos',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_por BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_emkt_tpl_cat (categoria),
  KEY idx_emkt_tpl_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_mkt_automacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(60) NOT NULL,
  nome VARCHAR(180) NOT NULL,
  descricao TEXT DEFAULT NULL,
  icone VARCHAR(40) DEFAULT 'Mail',
  tom VARCHAR(80) DEFAULT 'text-slate-600 bg-slate-100',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  stats_texto VARCHAR(255) DEFAULT NULL,
  config_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emkt_auto_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_mkt_campanhas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo VARCHAR(255) NOT NULL,
  categoria ENUM('licitacoes','certidoes','avisos','boas-vindas') NOT NULL DEFAULT 'avisos',
  publico_tipo ENUM(
    'manutencao','nunca_pagaram','taxa_pendente','ja_pagaram','sem_manutencao',
    'cnae','cert-venc','sicaf','novos','todos'
  ) NOT NULL DEFAULT 'manutencao',
  publico_label VARCHAR(255) DEFAULT NULL,
  assunto VARCHAR(255) NOT NULL,
  corpo MEDIUMTEXT NOT NULL,
  formato ENUM('texto','html') NOT NULL DEFAULT 'texto',
  status ENUM('rascunho','agendado','enviando','enviado','falhou','cancelado','pausado') NOT NULL DEFAULT 'rascunho',
  destinatarios INT UNSIGNED NOT NULL DEFAULT 0,
  enviados INT UNSIGNED NOT NULL DEFAULT 0,
  falhas INT UNSIGNED NOT NULL DEFAULT 0,
  aberturas INT UNSIGNED NOT NULL DEFAULT 0,
  cliques INT UNSIGNED NOT NULL DEFAULT 0,
  data_agendada DATETIME DEFAULT NULL,
  data_envio DATETIME DEFAULT NULL,
  template_id BIGINT UNSIGNED DEFAULT NULL,
  erro_resumo TEXT DEFAULT NULL,
  criado_por BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_emkt_camp_status (status),
  KEY idx_emkt_camp_cat (categoria),
  KEY idx_emkt_camp_agendada (data_agendada),
  KEY idx_emkt_camp_tpl (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_mkt_envios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campanha_id BIGINT UNSIGNED NOT NULL,
  cliente_id BIGINT UNSIGNED DEFAULT NULL,
  email VARCHAR(255) NOT NULL,
  nome VARCHAR(255) DEFAULT NULL,
  status ENUM('pendente','enviado','falhou','aberto','clicado') NOT NULL DEFAULT 'pendente',
  provider_message_id VARCHAR(255) DEFAULT NULL,
  erro TEXT DEFAULT NULL,
  enviado_em DATETIME DEFAULT NULL,
  aberto_em DATETIME DEFAULT NULL,
  clicado_em DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_emkt_envio_camp (campanha_id),
  KEY idx_emkt_envio_email (email),
  KEY idx_emkt_envio_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seeds iniciais (ignoram se código/nome já existir via serviço Node; aqui INSERT IGNORE por codigo)
INSERT IGNORE INTO email_mkt_automacoes (codigo, nome, descricao, icone, tom, ativo, stats_texto) VALUES
('boletim_licitacoes', 'Boletim diário de licitações', 'Envio diário às 07:00 com editais compatíveis com o CNAE de cada cliente.', 'Gavel', 'text-emerald-600 bg-emerald-100', 1, 'Aguardando primeira execução'),
('alerta_certidao', 'Alerta de certidão vencendo', 'Dispara 30, 15 e 5 dias antes do vencimento de cada certidão.', 'FileCheck2', 'text-amber-600 bg-amber-100', 1, 'Aguardando primeira execução'),
('alerta_sicaf', 'SICAF vencido / prestes a vencer', 'Notifica o responsável quando o SICAF atinge 10 dias para vencer.', 'BellRing', 'text-rose-600 bg-rose-100', 1, 'Aguardando primeira execução'),
('boas_vindas', 'Boas-vindas para novos clientes', 'Trilha de 3 e-mails no primeiro acesso ao portal.', 'Sparkles', 'text-blue-600 bg-blue-100', 1, 'Aguardando primeira execução'),
('manutencao_mensal', 'Aviso de manutenção mensal', 'Resumo mensal do que foi feito pela equipe CADBRASIL.', 'Mail', 'text-slate-600 bg-slate-100', 0, 'Desativada');

INSERT INTO email_mkt_templates (nome, assunto, corpo, categoria, ativo)
SELECT * FROM (
  SELECT
    'Boletim de licitações' AS nome,
    'Novas licitações para {empresa}' AS assunto,
    'Olá {nome},\n\nSelecionamos as licitações mais compatíveis com o CNAE da {empresa} publicadas nas últimas 24h.\n\nAcesse o portal para conferir os detalhes.' AS corpo,
    'licitacoes' AS categoria,
    1 AS ativo
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM email_mkt_templates WHERE nome = 'Boletim de licitações' LIMIT 1);

INSERT INTO email_mkt_templates (nome, assunto, corpo, categoria, ativo)
SELECT * FROM (
  SELECT
    'Certidão vencendo' AS nome,
    'Sua {certidao} vence em {dias} dias' AS assunto,
    'Olá {nome},\n\nA certidão {certidao} da {empresa} vence em {dias} dias.\n\nRegularize no portal SICAF e envie a Situação do Fornecedor atualizada.' AS corpo,
    'certidoes' AS categoria,
    1 AS ativo
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM email_mkt_templates WHERE nome = 'Certidão vencendo' LIMIT 1);

INSERT INTO email_mkt_templates (nome, assunto, corpo, categoria, ativo)
SELECT * FROM (
  SELECT
    'SICAF vencido' AS nome,
    'Ação necessária: SICAF de {empresa} vencido' AS assunto,
    'Olá {nome},\n\nO credenciamento SICAF de {empresa} está vencido ou prestes a vencer.\n\nAcesse o portal CADBRASIL para renovar.' AS corpo,
    'avisos' AS categoria,
    1 AS ativo
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM email_mkt_templates WHERE nome = 'SICAF vencido' LIMIT 1);

INSERT INTO email_mkt_templates (nome, assunto, corpo, categoria, ativo)
SELECT * FROM (
  SELECT
    'Boas-vindas' AS nome,
    'Bem-vindo à CADBRASIL, {nome}!' AS assunto,
    'Olá {nome},\n\nSeja bem-vindo(a) à CADBRASIL!\n\nEm poucos passos você conclui o SICAF e deixa {empresa} pronta para licitar.' AS corpo,
    'boas-vindas' AS categoria,
    1 AS ativo
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM email_mkt_templates WHERE nome = 'Boas-vindas' LIMIT 1);

INSERT INTO email_mkt_templates (nome, assunto, corpo, categoria, ativo)
SELECT * FROM (
  SELECT
    'Aviso geral' AS nome,
    '{titulo}' AS assunto,
    'Olá {nome},\n\n{mensagem}\n\nEquipe CADBRASIL' AS corpo,
    'avisos' AS categoria,
    1 AS ativo
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM email_mkt_templates WHERE nome = 'Aviso geral' LIMIT 1);
