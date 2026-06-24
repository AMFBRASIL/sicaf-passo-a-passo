-- Cobrança: régua automática + disparos em massa
-- Execute no banco MySQL do projeto CADBRASIL

CREATE TABLE IF NOT EXISTS regua_cobranca_config (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  automacao_ativa TINYINT(1) NOT NULL DEFAULT 0,
  ultima_execucao_em DATETIME DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_por BIGINT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO regua_cobranca_config (id, automacao_ativa) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS regua_cobranca_etapas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ordem INT NOT NULL DEFAULT 0,
  dias_relativo INT NOT NULL COMMENT 'Negativo=antes do vencimento, positivo=após',
  canal ENUM('email','whatsapp','sms','ligacao','nenhum') NOT NULL DEFAULT 'email',
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_regua_ordem (ordem),
  KEY idx_regua_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cobranca_disparos_massa (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  publico_alvo VARCHAR(30) NOT NULL,
  canais JSON NOT NULL,
  modelo VARCHAR(80) DEFAULT NULL,
  mensagem TEXT NOT NULL,
  agendar TINYINT(1) NOT NULL DEFAULT 0,
  agendado_para DATETIME DEFAULT NULL,
  status ENUM('agendado','processando','concluido','erro','cancelado') NOT NULL DEFAULT 'processando',
  total_destinatarios INT NOT NULL DEFAULT 0,
  total_enviados INT NOT NULL DEFAULT 0,
  total_erros INT NOT NULL DEFAULT 0,
  criado_por BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluido_em DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_disparo_status (status, agendado_para)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Colunas extras em cobrancas_taxa_sicaf (histórico de cobrança)
-- Ignorar erro se coluna já existir
ALTER TABLE cobrancas_taxa_sicaf ADD COLUMN canal VARCHAR(20) DEFAULT 'email' AFTER email_destino;
ALTER TABLE cobrancas_taxa_sicaf ADD COLUMN mensagem TEXT DEFAULT NULL AFTER canal;
ALTER TABLE cobrancas_taxa_sicaf ADD COLUMN modelo VARCHAR(80) DEFAULT NULL AFTER mensagem;
ALTER TABLE cobrancas_taxa_sicaf ADD COLUMN disparo_massa_id BIGINT UNSIGNED DEFAULT NULL AFTER modelo;
ALTER TABLE cobrancas_taxa_sicaf ADD COLUMN regua_etapa_id BIGINT UNSIGNED DEFAULT NULL AFTER disparo_massa_id;
