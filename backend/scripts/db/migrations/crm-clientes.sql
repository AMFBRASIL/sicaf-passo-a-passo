-- CRM Clientes — funil kanban de atendimento comercial
-- Execute: npm run db:migrate:sql -- scripts/db/migrations/crm-clientes.sql

CREATE TABLE IF NOT EXISTS crm_cards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(20) NOT NULL,
  cliente_id BIGINT UNSIGNED NOT NULL,
  consultor_id BIGINT UNSIGNED DEFAULT NULL,
  stage ENUM('em_negociacao','boleto','liberado','em_uso','cancelado') NOT NULL DEFAULT 'em_negociacao',
  prioridade ENUM('alta','media','baixa') NOT NULL DEFAULT 'media',
  canal ENUM('whatsapp','ligacao','email','presencial') NOT NULL DEFAULT 'whatsapp',
  valor DECIMAL(12,2) DEFAULT NULL,
  boleto VARCHAR(100) DEFAULT NULL,
  proxima_acao TEXT DEFAULT NULL,
  data_acao DATE DEFAULT NULL,
  notas TEXT DEFAULT NULL,
  tags JSON DEFAULT NULL,
  progresso_docs TINYINT UNSIGNED NOT NULL DEFAULT 0,
  criado_por BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_codigo (codigo),
  KEY idx_crm_stage (stage),
  KEY idx_crm_consultor (consultor_id),
  KEY idx_crm_cliente (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crm_timeline (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  card_id BIGINT UNSIGNED NOT NULL,
  tipo ENUM('criacao','contato','mudanca','nota','financeiro') NOT NULL DEFAULT 'nota',
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT DEFAULT NULL,
  autor_id BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_crm_tl_card (card_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crm_anexos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  card_id BIGINT UNSIGNED NOT NULL,
  nome_original VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  tamanho INT UNSIGNED NOT NULL DEFAULT 0,
  mimetype VARCHAR(120) DEFAULT NULL,
  tipo ENUM('comprovante','conversa','outro') NOT NULL DEFAULT 'outro',
  descricao TEXT DEFAULT NULL,
  enviado_por BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_crm_anexo_card (card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
