-- Propostas comerciais geradas no sistema de cadastro (/proposta).
-- Vincular ao cliente pelo protocolo_cadastro (SICAF-...).
-- Executar no MySQL antes de usar a página em produção.

CREATE TABLE IF NOT EXISTS propostas_comerciais (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id BIGINT UNSIGNED NOT NULL,
  protocolo_cadastro VARCHAR(40) NOT NULL,
  protocolo_proposta VARCHAR(40) NOT NULL,
  razao_social VARCHAR(160) NULL,
  documento VARCHAR(32) NULL,
  valor_base DECIMAL(12,2) NOT NULL DEFAULT 985.00, -- fallback de schema; app usa configuracoes_sistema
  valor_extras DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  valor_total DECIMAL(12,2) NOT NULL,
  periodicidade VARCHAR(20) NOT NULL DEFAULT 'anual',
  modulos_base_json JSON NOT NULL,
  modulos_extras_json JSON NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Gerada',
  observacoes TEXT NULL,
  tracking_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_propostas_comerciais_protocolo (protocolo_proposta),
  KEY idx_propostas_comerciais_cliente (cliente_id),
  KEY idx_propostas_comerciais_protocolo_cadastro (protocolo_cadastro),
  KEY idx_propostas_comerciais_status (status),
  KEY idx_propostas_comerciais_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Status possíveis:
--   Gerada              (cliente clicou em Gerar proposta)
--   Em_negociacao       (equipe em contato)
--   Aceita              (proposta formalizada / pagamento gerado)
--   Recusada
--   Cancelada
--   Convertida          (virou contrato/pagamento confirmado)
