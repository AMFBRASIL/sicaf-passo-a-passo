/**
 * Cria certidoes e tracking_sessoes com nomes de FK únicos
 * (corrige conflito fk_cert_cliente / fk_ts_cliente no schema original)
 */
import { createConnection, getCredentialsFromEnv } from "./sql-runner";

const CERTIDOES_SQL = `
CREATE TABLE IF NOT EXISTS \`certidoes\` (
  \`id\`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`cliente_id\`        BIGINT UNSIGNED NOT NULL,
  \`sicaf_id\`          BIGINT UNSIGNED DEFAULT NULL,
  \`tipo_certidao_id\`  BIGINT UNSIGNED NOT NULL,
  \`numero\`            VARCHAR(100) DEFAULT NULL,
  \`nivel_sicaf\`       ENUM('I','II','III','IV','V','VI') DEFAULT NULL,
  \`data_emissao\`      DATE DEFAULT NULL,
  \`data_validade\`     DATE DEFAULT NULL,
  \`status\`            ENUM('Válida','Vencendo','Vencida') NOT NULL DEFAULT 'Válida',
  \`dias_restantes\`    INT NOT NULL DEFAULT 0,
  \`auto_renovar\`      TINYINT(1) NOT NULL DEFAULT 0,
  \`arquivo_url\`       VARCHAR(500) DEFAULT NULL,
  \`arquivo_nome\`      VARCHAR(255) DEFAULT NULL,
  \`arquivo_tamanho\`   VARCHAR(20)  DEFAULT NULL,
  \`observacoes\`       TEXT DEFAULT NULL,
  \`created_at\`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  \`deleted_at\`        TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_cert_cliente_tipo\` (\`cliente_id\`,\`tipo_certidao_id\`),
  KEY \`idx_cert_sicaf\` (\`sicaf_id\`),
  KEY \`idx_cert_validade\` (\`data_validade\`),
  KEY \`idx_cert_status\` (\`status\`),
  CONSTRAINT \`fk_certidoes_cliente\` FOREIGN KEY (\`cliente_id\`)
    REFERENCES \`clientes\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_certidoes_sicaf\` FOREIGN KEY (\`sicaf_id\`)
    REFERENCES \`sicaf_cadastros\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`fk_certidoes_tipo\` FOREIGN KEY (\`tipo_certidao_id\`)
    REFERENCES \`tipo_certidoes\` (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const TRACKING_SESSOES_SQL = `
CREATE TABLE IF NOT EXISTS \`tracking_sessoes\` (
  \`id\`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`session_id\`       VARCHAR(100) NOT NULL,
  \`cliente_id\`       BIGINT UNSIGNED DEFAULT NULL,
  \`usuario_id\`       BIGINT UNSIGNED DEFAULT NULL,
  \`utm_source\`       VARCHAR(255) DEFAULT NULL,
  \`utm_medium\`       VARCHAR(255) DEFAULT NULL,
  \`utm_campaign\`     VARCHAR(255) DEFAULT NULL,
  \`utm_term\`         VARCHAR(255) DEFAULT NULL,
  \`utm_content\`      VARCHAR(255) DEFAULT NULL,
  \`gclid\`            VARCHAR(255) DEFAULT NULL,
  \`gbraid\`           VARCHAR(255) DEFAULT NULL,
  \`wbraid\`           VARCHAR(255) DEFAULT NULL,
  \`gad_source\`       VARCHAR(50) DEFAULT NULL,
  \`gad_campaignid\`   VARCHAR(100) DEFAULT NULL,
  \`fbclid\`           VARCHAR(255) DEFAULT NULL,
  \`msclkid\`          VARCHAR(255) DEFAULT NULL,
  \`landing_page\`     VARCHAR(1000) DEFAULT NULL,
  \`referrer\`         VARCHAR(1000) DEFAULT NULL,
  \`exit_page\`        VARCHAR(1000) DEFAULT NULL,
  \`user_agent\`       TEXT DEFAULT NULL,
  \`device_type\`      ENUM('desktop','mobile','tablet','unknown') NOT NULL DEFAULT 'unknown',
  \`browser\`          VARCHAR(100) DEFAULT NULL,
  \`browser_version\`  VARCHAR(50) DEFAULT NULL,
  \`os\`               VARCHAR(100) DEFAULT NULL,
  \`os_version\`       VARCHAR(50) DEFAULT NULL,
  \`screen_resolution\` VARCHAR(20) DEFAULT NULL,
  \`viewport_size\`    VARCHAR(20) DEFAULT NULL,
  \`language\`         VARCHAR(10) DEFAULT NULL,
  \`ip_address\`       VARCHAR(50) DEFAULT NULL,
  \`geo_country\`      VARCHAR(100) DEFAULT NULL,
  \`geo_state\`        VARCHAR(100) DEFAULT NULL,
  \`geo_city\`         VARCHAR(100) DEFAULT NULL,
  \`pages_viewed\`     INT NOT NULL DEFAULT 0,
  \`session_duration\` INT NOT NULL DEFAULT 0,
  \`bounce\`           TINYINT(1) NOT NULL DEFAULT 0,
  \`scroll_depth_max\` INT NOT NULL DEFAULT 0,
  \`converted\`        TINYINT(1) NOT NULL DEFAULT 0,
  \`conversion_type\`  VARCHAR(100) DEFAULT NULL,
  \`conversion_value\` DECIMAL(12,2) DEFAULT NULL,
  \`conversion_at\`    DATETIME DEFAULT NULL,
  \`funnel_step\`      VARCHAR(100) DEFAULT NULL,
  \`first_visit_at\`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`last_activity_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`created_at\`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_ts_session\` (\`session_id\`),
  KEY \`idx_ts_cliente\` (\`cliente_id\`),
  KEY \`idx_ts_user\` (\`usuario_id\`),
  KEY \`idx_ts_gclid\` (\`gclid\`),
  KEY \`idx_ts_utm_source\` (\`utm_source\`),
  KEY \`idx_ts_utm_camp\` (\`utm_campaign\`),
  KEY \`idx_ts_converted\` (\`converted\`),
  KEY \`idx_ts_created\` (\`created_at\`),
  CONSTRAINT \`fk_trk_sess_cliente\` FOREIGN KEY (\`cliente_id\`)
    REFERENCES \`clientes\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`fk_trk_sess_user\` FOREIGN KEY (\`usuario_id\`)
    REFERENCES \`usuarios\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function main() {
  const { write, v2SchemaName } = getCredentialsFromEnv();
  const conn = await createConnection(write, { database: v2SchemaName });

  console.log("Criando tabelas ausentes com FKs corrigidas...\n");

  for (const [name, sql] of [
    ["certidoes", CERTIDOES_SQL],
    ["tracking_sessoes", TRACKING_SESSOES_SQL],
  ] as const) {
    try {
      await conn.query(sql);
      console.log(`✔ ${name}`);
    } catch (err) {
      console.error(`✖ ${name}:`, (err as Error).message);
    }
  }

  await conn.end();
}

main();
