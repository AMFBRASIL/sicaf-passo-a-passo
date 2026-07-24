-- Fluxos de automação do painel /admin/automacoes
-- Execute:
--   mysql -u USER -p DATABASE < backend/scripts/db/migrations/automacao-fluxos.sql

CREATE TABLE IF NOT EXISTS automacao_fluxos (
  id VARCHAR(64) NOT NULL,
  nome VARCHAR(180) NOT NULL,
  descricao TEXT NULL,
  gatilho_tipo VARCHAR(80) NOT NULL,
  gatilho_label VARCHAR(180) NULL,
  condicoes TEXT NULL,
  acoes_json JSON NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  rodou INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_automacao_fluxos_gatilho_ativo (gatilho_tipo, ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO automacao_fluxos
  (id, nome, descricao, gatilho_tipo, gatilho_label, acoes_json, ativo, rodou)
VALUES
(
  'renovar-manutencao',
  'Renovar Manutenção Cliente',
  'Renova a manutenção do cliente de forma automática ao quitar o ciclo.',
  'manutencao_ciclo_completo',
  'Ciclo de manutenção quitado',
  JSON_ARRAY(
    JSON_OBJECT(
      'tipo', 'renovar_manutencao',
      'label', 'Renovar manutenção (novo ciclo de boletos)',
      'delay', 'imediato'
    ),
    JSON_OBJECT(
      'tipo', 'email',
      'label', 'E-mail avisando renovação',
      'delay', 'imediato'
    )
  ),
  1,
  0
);
