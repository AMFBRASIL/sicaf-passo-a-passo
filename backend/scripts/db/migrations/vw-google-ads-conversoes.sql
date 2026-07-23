-- View Google Ads — exportação segura para o Data Manager
--
-- Datas na tabela = horário de Brasília (wall clock).
-- Export = UTC com +00:00 (evita Data Manager tratar -03:00 como UTC).
--
-- Valor:
--   conversion_value:
--     - só SICAF → valor pago da taxa
--     - SICAF + manutenção → taxa + valor completo do plano (ex.: 1860)
--   currency_code = BRL
--
-- Melhoria da medição:
--   gbraid / wbraid / ip_address (da sessão de tracking atribuída)
--
-- Filtros:
--   1) Sem datas no futuro
--   2) Só últimos 90 dias
--   3) GCLID inválido → NULL
--
-- mysql -u USER -p DATABASE < backend/scripts/db/migrations/vw-google-ads-conversoes.sql

DROP VIEW IF EXISTS `vw_google_ads_conversoes`;

CREATE
ALGORITHM=UNDEFINED
DEFINER=`cadbrasilv2`@`%`
SQL SECURITY DEFINER
VIEW `vw_google_ads_conversoes` AS
SELECT
  CAST(
    CASE
      WHEN NULLIF(TRIM(`g`.`gclid`), '') IS NULL THEN NULL
      WHEN CHAR_LENGTH(TRIM(`g`.`gclid`)) < 20 THEN NULL
      WHEN TRIM(`g`.`gclid`) REGEXP '^[0-9]+$' THEN NULL
      ELSE TRIM(`g`.`gclid`)
    END AS CHAR(255) CHARSET utf8mb4
  ) AS `gclid`,
  REPLACE(LOWER(TRIM(`g`.`email_address`)), ' ', '') AS `email_address`,
  `g`.`phone_number` AS `phone_number`,
  CONCAT(
    DATE_FORMAT(
      LEAST(
        CONVERT_TZ(`g`.`conversion_date_time`, '-03:00', '+00:00'),
        UTC_TIMESTAMP()
      ),
      '%Y-%m-%d %H:%i:%s'
    ),
    '+00:00'
  ) AS `conversion_date_time`,
  CAST(`g`.`conversion_value` AS DECIMAL(12,2)) AS `conversion_value`,
  COALESCE(NULLIF(TRIM(`g`.`conversion_currency`), ''), 'BRL') AS `currency_code`,
  NULLIF(TRIM(`g`.`gbraid`), '') AS `gbraid`,
  NULLIF(TRIM(`g`.`wbraid`), '') AS `wbraid`,
  NULLIF(TRIM(`g`.`ip_address`), '') AS `ip_address`
FROM `google_ads_conversoes` AS `g`
WHERE `g`.`email_address` IS NOT NULL
  AND NULLIF(TRIM(`g`.`email_address`), '') IS NOT NULL
  AND `g`.`conversion_date_time` IS NOT NULL
  AND `g`.`conversion_value` IS NOT NULL
  AND `g`.`conversion_value` > 0
  AND `g`.`conversion_date_time` <= CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-03:00')
  AND `g`.`conversion_date_time` >= DATE_SUB(
    CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-03:00'),
    INTERVAL 90 DAY
  );
