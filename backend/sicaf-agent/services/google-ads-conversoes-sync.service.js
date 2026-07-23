/**
 * Sincroniza google_ads_conversoes (Google Ads Data Manager — conversões offline).
 * Usado pelo CLI, cron e página Processos.
 */
const knex = require('knex');
const { getDb } = require('../database/connection');

/** Tabela de pagamentos no v2 (legado: pagamentos_gerencianet). */
const PAGAMENTOS_TABLE = 'pagamentos';

const COL = {
  GCLID: 'gclid',
  EMAIL: 'email_address',
  PHONE: 'phone_number',
  TIME: 'conversion_date_time',
  VALUE: 'conversion_value',
  CURRENCY: 'conversion_currency',
  GBRAID: 'gbraid',
  WBRAID: 'wbraid',
  IP: 'ip_address',
};

/**
 * Margem mínima após o clique do GCLID.
 * 5 min falhava no Google Ads quando o Data Manager reinterpretava o fuso
 * (conversão parecia ~3h antes do clique). 1h cobre skew + transformação errada parcial.
 */
const CLICK_MARGIN_SQL = 'INTERVAL 1 HOUR';

/** Janela máxima clique → conversão (Google Ads costuma usar 90 dias). */
const CLICK_LOOKBACK_SQL = 'INTERVAL 90 DAY';

/**
 * “Agora” em horário de Brasília (wall clock).
 * O MySQL do servidor roda em UTC; pagamentos/tracking estão em Brasília.
 * Usar NOW() misturava fusos e gerava conversões “no futuro” após CONVERT_TZ.
 */
const NOW_SP_SQL = `CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-03:00')`;

/** GCLID válido (rejeita lixo numérico tipo 323224…). */
function gclidValidSql(alias = 'ts') {
  return `(
  NULLIF(TRIM(${alias}.gclid), '') IS NOT NULL
  AND CHAR_LENGTH(TRIM(${alias}.gclid)) >= 20
  AND TRIM(${alias}.gclid) NOT REGEXP '^[0-9]+$'
)`;
}

const TAXA_SICAF_PAGA_SQL = `
  (
    LOWER(TRIM(CAST(t.status AS CHAR))) IN ('pago', 'paga', 'aprovado', 'aprovada', 'liberado', 'liberada', 'paid')
    OR t.status IN ('Pago', 'Paga', 'Aprovado', 'Aprovada', 'Liberado', 'Liberada')
  )
`;

const PG_PAGO_SQL = `
  (
    LOWER(TRIM(CAST(p.status AS CHAR))) IN ('pago', 'paga', 'aprovado', 'aprovada', 'paid')
    OR p.status IN ('Pago', 'Paga', 'Aprovado', 'Aprovada')
  )
`;

function phoneE164FromField(fieldSql) {
  const digits = `NULLIF(REGEXP_REPLACE(IFNULL(${fieldSql}, ''), '[^0-9]', ''), '')`;
  const norm = `NULLIF(REGEXP_REPLACE(${digits}, '^0+', ''), '')`;
  return `
    CASE
      WHEN ${norm} IS NULL THEN NULL
      WHEN ${norm} REGEXP '^55[1-9][0-9][0-9]{8}$' THEN CONCAT('+', ${norm})
      WHEN ${norm} REGEXP '^55[1-9][0-9]9[0-9]{8}$' THEN CONCAT('+', ${norm})
      WHEN ${norm} REGEXP '^[1-9][0-9]9[0-9]{8}$' THEN CONCAT('+55', ${norm})
      WHEN ${norm} REGEXP '^[1-9][0-9][0-9]{8}$' THEN CONCAT('+55', ${norm})
      ELSE NULL
    END
  `;
}

const PHONE_E164_SQL = `
  COALESCE(
    ${phoneE164FromField("NULLIF(TRIM(c.celular), '')")},
    ${phoneE164FromField("NULLIF(TRIM(c.telefone), '')")},
    ${phoneE164FromField("NULLIF(TRIM(c.responsavel_telefone), '')")}
  )
`;

function qCol(name) {
  return `\`${name.replace(/`/g, '``')}\``;
}

function buildPagamentoSicafSubquery(days) {
  // Usa SOMENTE a data real do pagamento (data_pagamento / paid_at).
  // Nunca cair em created_at — isso distorce conversões no Google Ads.
  // Inclui valor_sicaf do pagamento mais recente (para conversion_value).
  const periodFilter =
    days > 0
      ? `AND pago_em >= DATE_SUB(${NOW_SP_SQL}, INTERVAL ${Number(days)} DAY)`
      : '';

  return `
    SELECT cliente_id, pago_em AS ultimo_pagamento, valor AS valor_sicaf
    FROM (
      SELECT
        cliente_id,
        pago_em,
        valor,
        ROW_NUMBER() OVER (
          PARTITION BY cliente_id
          ORDER BY pago_em DESC, valor DESC
        ) AS rn
      FROM (
        SELECT t.cliente_id, t.data_pagamento AS pago_em, CAST(t.valor AS DECIMAL(12,2)) AS valor
        FROM taxas_sicaf AS t
        WHERE t.cliente_id IS NOT NULL
          AND t.data_pagamento IS NOT NULL
          AND ${TAXA_SICAF_PAGA_SQL}
        UNION ALL
        SELECT p.cliente_id, p.data_pagamento AS pago_em, CAST(p.valor AS DECIMAL(12,2)) AS valor
        FROM ${PAGAMENTOS_TABLE} AS p
        WHERE p.cliente_id IS NOT NULL
          AND p.origem = 'sicaf'
          AND p.data_pagamento IS NOT NULL
          AND ${PG_PAGO_SQL}
      ) AS pagos_sicaf
      WHERE pago_em IS NOT NULL
      ${periodFilter}
    ) AS ranked_pago
    WHERE rn = 1
  `;
}

const MANUT_ATIVA_SQL = `
  LOWER(TRIM(CAST(m.status AS CHAR))) IN ('ativo', 'a vencer', 'vencendo')
  OR m.status IN ('Ativo', 'A Vencer', 'Vencendo')
`;

/** Manutenção do cliente: flag + valor completo do plano (anual / contrato). */
function buildManutencaoValorSubquery() {
  return `
    SELECT
      m.cliente_id,
      MAX(CASE WHEN ${MANUT_ATIVA_SQL} THEN 1 ELSE 0 END) AS manut_ativa,
      MAX(CAST(m.valor AS DECIMAL(12,2))) AS valor_manut_completa,
      COALESCE(SUM(CAST(mb.valor AS DECIMAL(12,2))), 0) AS soma_boletos,
      COALESCE(SUM(
        CASE
          WHEN mb.data_pagamento IS NOT NULL
           AND (
             LOWER(TRIM(CAST(mb.status AS CHAR))) IN ('pago', 'paga', 'aprovado', 'aprovada', 'paid', 'quitado')
             OR mb.status IN ('Pago', 'Paga', 'Aprovado', 'Aprovada')
           )
          THEN 1 ELSE 0
        END
      ), 0) AS qtd_boletos_pagos
    FROM manutencoes AS m
    LEFT JOIN manutencao_boletos AS mb ON mb.manutencao_id = m.id
    WHERE m.cliente_id IS NOT NULL
    GROUP BY m.cliente_id
  `;
}

function normalizeEmailSql(columnSql) {
  return `REPLACE(LOWER(TRIM(COALESCE(${columnSql}, ''))), ' ', '')`;
}

/** Sessão de tracking com algum identificador de clique Google. */
function trackingClickSql(alias = 'ts') {
  return `(
  ${gclidValidSql(alias)}
  OR NULLIF(TRIM(${alias}.gbraid), '') IS NOT NULL
  OR NULLIF(TRIM(${alias}.wbraid), '') IS NOT NULL
)`;
}

function buildSelectSql(days) {
  const pagoSub = buildPagamentoSicafSubquery(days);
  const manutSub = buildManutencaoValorSubquery();
  // Google Ads: conversão NÃO pode ser anterior ao clique do anúncio.
  // 1) Usa o último clique (GCLID/GBRAID/WBRAID) com sessão <= pagamento.
  // 2) Garante conversion_date_time >= clique + margem.
  // 3) Também >= cadastro do cliente + 1 min; nunca no futuro.
  // 4) conversion_value: só SICAF ou SICAF + manutenção completa.
  // 5) Exporta gbraid / wbraid / ip_address da mesma sessão de atribuição.
  return `
SELECT
  ranked.gclid_val AS ${COL.GCLID},
  ranked.email_val AS ${COL.EMAIL},
  ranked.phone_val AS ${COL.PHONE},
  ranked.time_val AS ${COL.TIME},
  ranked.value_val AS ${COL.VALUE},
  'BRL' AS ${COL.CURRENCY},
  ranked.gbraid_val AS ${COL.GBRAID},
  ranked.wbraid_val AS ${COL.WBRAID},
  ranked.ip_val AS ${COL.IP}
FROM (
  SELECT
    src.gclid_val,
    src.email_val,
    src.phone_val,
    src.time_val,
    src.value_val,
    src.gbraid_val,
    src.wbraid_val,
    src.ip_val,
    ROW_NUMBER() OVER (
      PARTITION BY src.email_val
      ORDER BY src.time_val DESC, src.cliente_id DESC
    ) AS rn
  FROM (
    SELECT
      c.id AS cliente_id,
      CASE
        WHEN click.click_at IS NOT NULL
         AND DATE_ADD(click.click_at, ${CLICK_MARGIN_SQL}) <= ${NOW_SP_SQL}
         AND click.click_at >= DATE_SUB(pago.ultimo_pagamento, ${CLICK_LOOKBACK_SQL})
         AND ${gclidValidSql('click')}
        THEN NULLIF(TRIM(click.gclid), '')
        ELSE NULL
      END AS gclid_val,
      REPLACE(LOWER(TRIM(c.email)), ' ', '') AS email_val,
      ${PHONE_E164_SQL} AS phone_val,
      LEAST(
        ${NOW_SP_SQL},
        GREATEST(
          pago.ultimo_pagamento,
          CASE
            WHEN click.click_at IS NOT NULL
             AND DATE_ADD(click.click_at, ${CLICK_MARGIN_SQL}) <= ${NOW_SP_SQL}
             AND click.click_at >= DATE_SUB(pago.ultimo_pagamento, ${CLICK_LOOKBACK_SQL})
            THEN DATE_ADD(click.click_at, ${CLICK_MARGIN_SQL})
            ELSE pago.ultimo_pagamento
          END,
          COALESCE(DATE_ADD(c.created_at, INTERVAL 1 MINUTE), pago.ultimo_pagamento)
        )
      ) AS time_val,
      ROUND(
        COALESCE(pago.valor_sicaf, 0) +
        CASE
          WHEN COALESCE(manut.manut_ativa, 0) = 1
            OR COALESCE(manut.qtd_boletos_pagos, 0) > 0
          THEN COALESCE(
            NULLIF(manut.valor_manut_completa, 0),
            NULLIF(manut.soma_boletos, 0),
            1860
          )
          ELSE 0
        END
      , 2) AS value_val,
      NULLIF(TRIM(click.gbraid), '') AS gbraid_val,
      NULLIF(TRIM(click.wbraid), '') AS wbraid_val,
      NULLIF(TRIM(click.ip_address), '') AS ip_val
    FROM clientes AS c
    INNER JOIN (${pagoSub}) AS pago ON pago.cliente_id = c.id
    LEFT JOIN (${manutSub}) AS manut ON manut.cliente_id = c.id
    LEFT JOIN (
      SELECT
        last_click.cliente_id,
        ts.gclid,
        ts.gbraid,
        ts.wbraid,
        ts.ip_address,
        ts.created_at AS click_at
      FROM (
        SELECT
          ts0.cliente_id,
          MAX(ts0.created_at) AS click_at
        FROM tracking_sessoes AS ts0
        INNER JOIN (${pagoSub}) AS pago2 ON pago2.cliente_id = ts0.cliente_id
        WHERE ts0.cliente_id IS NOT NULL
          AND ${trackingClickSql('ts0')}
          AND ts0.created_at <= pago2.ultimo_pagamento
          AND ts0.created_at >= DATE_SUB(pago2.ultimo_pagamento, ${CLICK_LOOKBACK_SQL})
        GROUP BY ts0.cliente_id
      ) AS last_click
      INNER JOIN tracking_sessoes AS ts
        ON ts.cliente_id = last_click.cliente_id
       AND ts.created_at = last_click.click_at
       AND ${trackingClickSql('ts')}
    ) AS click ON click.cliente_id = c.id
    WHERE NULLIF(TRIM(c.email), '') IS NOT NULL
  ) AS src
  WHERE src.email_val IS NOT NULL AND src.time_val IS NOT NULL
) AS ranked
WHERE ranked.rn = 1
`;
}

/**
 * Garante conversion_date_time >= primeiro clique do GCLID + margem.
 * Também remove GCLID inválido / fora da janela de 90 dias.
 */
async function sanitizeConversionAgainstFirstClick(db, log = () => {}) {
  const emailNormG = normalizeEmailSql(`g.${COL.EMAIL}`);

  const [fake] = await db.raw(`
    UPDATE google_ads_conversoes AS g
    SET g.${COL.GCLID} = NULL
    WHERE NULLIF(TRIM(g.${COL.GCLID}), '') IS NOT NULL
      AND (
        CHAR_LENGTH(TRIM(g.${COL.GCLID})) < 20
        OR TRIM(g.${COL.GCLID}) REGEXP '^[0-9]+$'
      )
  `);
  const fakeCleared = Number(fake?.affectedRows ?? 0);
  if (fakeCleared > 0) log(`Removidos ${fakeCleared} GCLID(s) inválido(s)`);

  const [bumped] = await db.raw(`
    UPDATE google_ads_conversoes AS g
    INNER JOIN (
      SELECT
        ${normalizeEmailSql('c.email')} AS email_norm,
        ts.gclid AS gclid,
        MIN(ts.created_at) AS first_click
      FROM tracking_sessoes AS ts
      INNER JOIN clientes AS c ON c.id = ts.cliente_id
      WHERE ts.cliente_id IS NOT NULL
        AND ${gclidValidSql('ts')}
        AND NULLIF(TRIM(c.email), '') IS NOT NULL
      GROUP BY ${normalizeEmailSql('c.email')}, ts.gclid
    ) AS clk
      ON clk.email_norm = ${emailNormG}
     AND clk.gclid = g.${COL.GCLID}
    SET g.${COL.TIME} = LEAST(
      ${NOW_SP_SQL},
      DATE_ADD(clk.first_click, ${CLICK_MARGIN_SQL})
    )
    WHERE NULLIF(TRIM(g.${COL.GCLID}), '') IS NOT NULL
      AND g.${COL.TIME} < DATE_ADD(clk.first_click, ${CLICK_MARGIN_SQL})
      AND DATE_ADD(clk.first_click, ${CLICK_MARGIN_SQL}) <= ${NOW_SP_SQL}
  `);
  const updated = Number(bumped?.affectedRows ?? 0);
  if (updated > 0) {
    log(`Ajustados ${updated} registro(s) (conversão >= 1º clique + 1h)`);
  }

  const [cleared] = await db.raw(`
    UPDATE google_ads_conversoes AS g
    INNER JOIN (
      SELECT
        ${normalizeEmailSql('c.email')} AS email_norm,
        ts.gclid AS gclid,
        MIN(ts.created_at) AS first_click
      FROM tracking_sessoes AS ts
      INNER JOIN clientes AS c ON c.id = ts.cliente_id
      WHERE ts.cliente_id IS NOT NULL
        AND ${gclidValidSql('ts')}
        AND NULLIF(TRIM(c.email), '') IS NOT NULL
      GROUP BY ${normalizeEmailSql('c.email')}, ts.gclid
    ) AS clk
      ON clk.email_norm = ${emailNormG}
     AND clk.gclid = g.${COL.GCLID}
    SET g.${COL.GCLID} = NULL
    WHERE NULLIF(TRIM(g.${COL.GCLID}), '') IS NOT NULL
      AND (
        g.${COL.TIME} < DATE_ADD(clk.first_click, ${CLICK_MARGIN_SQL})
        OR clk.first_click < DATE_SUB(g.${COL.TIME}, ${CLICK_LOOKBACK_SQL})
      )
  `);
  const removedGclid = Number(cleared?.affectedRows ?? 0);
  if (removedGclid > 0) {
    log(`Removido GCLID de ${removedGclid} registro(s) (janela/clique inválido)`);
  }

  // Não exportar timestamps no futuro (wall clock SP)
  const [capped] = await db.raw(`
    UPDATE google_ads_conversoes AS g
    SET g.${COL.TIME} = ${NOW_SP_SQL}
    WHERE g.${COL.TIME} > ${NOW_SP_SQL}
  `);
  const cappedN = Number(capped?.affectedRows ?? 0);
  if (cappedN > 0) log(`Limitados ${cappedN} registro(s) com data no futuro`);

  return updated + removedGclid + fakeCleared + cappedN;
}

/** Remove linhas duplicadas na tabela (mesmo e-mail normalizado), mantém o registro mais recente (maior id). */
async function removeDuplicateEmails(db, log = () => {}) {
  const normG1 = normalizeEmailSql(`g1.${COL.EMAIL}`);
  const normG2 = normalizeEmailSql(`g2.${COL.EMAIL}`);
  const [result] = await db.raw(`
    DELETE g1 FROM google_ads_conversoes AS g1
    INNER JOIN google_ads_conversoes AS g2
      ON ${normG1} = ${normG2}
      AND g1.id < g2.id
    WHERE NULLIF(${normG1}, '') IS NOT NULL
  `);
  const removed = Number(result?.affectedRows ?? 0);
  if (removed > 0) log(`Removidos ${removed} registro(s) duplicados por e-mail`);
  return removed;
}

function buildInsertOnlySql(selectSql) {
  const emailNormExisting = normalizeEmailSql(`g.${COL.EMAIL}`);
  const cols = [
    COL.GCLID, COL.EMAIL, COL.PHONE, COL.TIME, COL.VALUE, COL.CURRENCY,
    COL.GBRAID, COL.WBRAID, COL.IP,
  ].join(', ');
  return `
INSERT INTO google_ads_conversoes (${cols})
SELECT
  src.${COL.GCLID}, src.${COL.EMAIL}, src.${COL.PHONE}, src.${COL.TIME},
  src.${COL.VALUE}, src.${COL.CURRENCY},
  src.${COL.GBRAID}, src.${COL.WBRAID}, src.${COL.IP}
FROM (${selectSql}) AS src
WHERE NOT EXISTS (
  SELECT 1 FROM google_ads_conversoes AS g
  WHERE ${emailNormExisting} = src.${COL.EMAIL}
    AND NULLIF(src.${COL.EMAIL}, '') IS NOT NULL
)
`;
}

/** Atualiza conversion_date_time / gclid / valor / gbraid das linhas já existentes. */
async function updateExistingPaymentDates(db, selectSql, log = () => {}) {
  const emailNormG = normalizeEmailSql(`g.${COL.EMAIL}`);
  const [result] = await db.raw(`
    UPDATE google_ads_conversoes AS g
    INNER JOIN (${selectSql}) AS src
      ON ${emailNormG} = src.${COL.EMAIL}
     AND NULLIF(src.${COL.EMAIL}, '') IS NOT NULL
    SET
      g.${COL.TIME} = src.${COL.TIME},
      g.${COL.GCLID} = src.${COL.GCLID},
      g.${COL.PHONE} = COALESCE(NULLIF(TRIM(src.${COL.PHONE}), ''), g.${COL.PHONE}),
      g.${COL.VALUE} = src.${COL.VALUE},
      g.${COL.CURRENCY} = COALESCE(src.${COL.CURRENCY}, 'BRL'),
      g.${COL.GBRAID} = src.${COL.GBRAID},
      g.${COL.WBRAID} = src.${COL.WBRAID},
      g.${COL.IP} = src.${COL.IP}
    WHERE g.${COL.TIME} IS NULL
       OR g.${COL.TIME} <> src.${COL.TIME}
       OR IFNULL(g.${COL.GCLID}, '') <> IFNULL(src.${COL.GCLID}, '')
       OR IFNULL(g.${COL.VALUE}, -1) <> IFNULL(src.${COL.VALUE}, -1)
       OR IFNULL(g.${COL.CURRENCY}, '') <> IFNULL(src.${COL.CURRENCY}, '')
       OR IFNULL(g.${COL.GBRAID}, '') <> IFNULL(src.${COL.GBRAID}, '')
       OR IFNULL(g.${COL.WBRAID}, '') <> IFNULL(src.${COL.WBRAID}, '')
       OR IFNULL(g.${COL.IP}, '') <> IFNULL(src.${COL.IP}, '')
  `);
  const updated = Number(result?.affectedRows ?? 0);
  if (updated > 0) log(`Atualizados ${updated} registro(s) (data/gclid/valor/gbraid alinhados)`);
  return updated;
}

async function getColumnNames(db) {
  const [rows] = await db.raw('SHOW COLUMNS FROM google_ads_conversoes');
  return (Array.isArray(rows) ? rows : []).map((r) => r.Field);
}

async function getConversionTimeColumnType(db) {
  const [rows] = await db.raw(
    `SELECT DATA_TYPE AS data_type FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'google_ads_conversoes' AND COLUMN_NAME = ?`,
    [COL.TIME]
  );
  return rows?.[0]?.data_type ? String(rows[0].data_type).toLowerCase() : '';
}

async function createTable(db) {
  await db.raw(`
    CREATE TABLE google_ads_conversoes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      ${COL.GCLID} VARCHAR(255) NULL,
      ${COL.EMAIL} VARCHAR(255) NULL,
      ${COL.PHONE} VARCHAR(20) NULL,
      ${COL.TIME} DATETIME NOT NULL,
      ${COL.VALUE} DECIMAL(12,2) NULL,
      ${COL.CURRENCY} CHAR(3) NULL DEFAULT 'BRL',
      ${COL.GBRAID} VARCHAR(255) NULL,
      ${COL.WBRAID} VARCHAR(255) NULL,
      ${COL.IP} VARCHAR(50) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_gac_gclid (${COL.GCLID}),
      INDEX idx_gac_email (${COL.EMAIL}),
      INDEX idx_gac_time (${COL.TIME})
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

const RENAME_MAP = [
  { from: 'GCLID', to: COL.GCLID },
  { from: 'Email Address', to: COL.EMAIL },
  { from: 'Phone number', to: COL.PHONE },
  { from: 'Conversion date and time', to: COL.TIME },
  { from: 'hashed_email', to: COL.EMAIL },
  { from: 'email', to: COL.EMAIL },
  { from: 'hashed_phone_number', to: COL.PHONE },
  { from: 'phone', to: COL.PHONE },
  { from: 'conversion_event_time', to: COL.TIME },
  { from: 'Convertion_time_event', to: COL.TIME },
];

async function migrateTableSchema(db, log = () => {}) {
  const exists = await db.schema.hasTable('google_ads_conversoes');
  if (!exists) {
    log('Criando tabela google_ads_conversoes');
    await createTable(db);
    return;
  }

  let cols = await getColumnNames(db);
  const timeType = cols.includes(COL.TIME) ? await getConversionTimeColumnType(db) : '';

  if (!cols.includes(COL.EMAIL) || !cols.includes(COL.TIME) || timeType !== 'datetime') {
    log('Migrando schema google_ads_conversoes');
    for (const { from, to } of RENAME_MAP) {
      if (!cols.includes(from) || cols.includes(to)) continue;
      const type =
        to === COL.GCLID ? 'VARCHAR(255) NULL'
          : to === COL.EMAIL ? 'VARCHAR(255) NULL'
            : to === COL.PHONE ? 'VARCHAR(20) NULL'
              : 'DATETIME NOT NULL';
      await db.raw(`ALTER TABLE google_ads_conversoes CHANGE COLUMN \`${from}\` ${qCol(to)} ${type}`);
      cols = await getColumnNames(db);
    }

    cols = await getColumnNames(db);
    if (!cols.includes(COL.EMAIL) || !cols.includes(COL.TIME)) {
      await db.raw('DROP TABLE google_ads_conversoes');
      await createTable(db);
      return;
    }

    const finalType = await getConversionTimeColumnType(db);
    if (finalType !== 'datetime') {
      await db.raw('TRUNCATE TABLE google_ads_conversoes');
      await db.raw(`ALTER TABLE google_ads_conversoes MODIFY ${COL.TIME} DATETIME NOT NULL`);
    }
    cols = await getColumnNames(db);
  }

  if (!cols.includes(COL.VALUE)) {
    log('Adicionando conversion_value');
    await db.raw(`ALTER TABLE google_ads_conversoes ADD COLUMN ${COL.VALUE} DECIMAL(12,2) NULL`);
    cols = await getColumnNames(db);
  }
  if (!cols.includes(COL.CURRENCY)) {
    log('Adicionando conversion_currency');
    await db.raw(
      `ALTER TABLE google_ads_conversoes ADD COLUMN ${COL.CURRENCY} CHAR(3) NULL DEFAULT 'BRL'`
    );
    cols = await getColumnNames(db);
  }
  if (!cols.includes(COL.GBRAID)) {
    log('Adicionando gbraid');
    await db.raw(`ALTER TABLE google_ads_conversoes ADD COLUMN ${COL.GBRAID} VARCHAR(255) NULL`);
    cols = await getColumnNames(db);
  }
  if (!cols.includes(COL.WBRAID)) {
    log('Adicionando wbraid');
    await db.raw(`ALTER TABLE google_ads_conversoes ADD COLUMN ${COL.WBRAID} VARCHAR(255) NULL`);
    cols = await getColumnNames(db);
  }
  if (!cols.includes(COL.IP)) {
    log('Adicionando ip_address');
    await db.raw(`ALTER TABLE google_ads_conversoes ADD COLUMN ${COL.IP} VARCHAR(50) NULL`);
  }
}

async function fetchStats(db, days) {
  const pagoSub = buildPagamentoSicafSubquery(days);
  const [[eligible]] = await db.raw(`
    SELECT COUNT(*) AS total FROM clientes AS c
    INNER JOIN (${pagoSub}) AS pago ON pago.cliente_id = c.id
    WHERE NULLIF(TRIM(c.email), '') IS NOT NULL`);
  const [[withGclid]] = await db.raw(`
    SELECT COUNT(*) AS total FROM clientes AS c
    INNER JOIN (${pagoSub}) AS pago ON pago.cliente_id = c.id
    INNER JOIN tracking_sessoes AS ts ON ts.cliente_id = c.id AND NULLIF(TRIM(ts.gclid), '') IS NOT NULL
    WHERE NULLIF(TRIM(c.email), '') IS NOT NULL`);
  const [[taxas]] = await db.raw(`
    SELECT COUNT(DISTINCT t.cliente_id) AS total FROM taxas_sicaf AS t
    WHERE t.cliente_id IS NOT NULL AND ${TAXA_SICAF_PAGA_SQL}`);
  const [[pg]] = await db.raw(`
    SELECT COUNT(DISTINCT p.cliente_id) AS total FROM ${PAGAMENTOS_TABLE} AS p
    WHERE p.cliente_id IS NOT NULL AND p.origem = 'sicaf' AND ${PG_PAGO_SQL}`);

  return {
    clientesElegiveis: Number(eligible?.total || 0),
    comGclid: Number(withGclid?.total || 0),
    comTaxaPaga: Number(taxas?.total || 0),
    comPgSicaf: Number(pg?.total || 0),
  };
}

function createStandaloneDb() {
  return knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
  });
}

/**
 * @param {Object} opts
 * @param {number} [opts.days=0]
 * @param {boolean} [opts.dryRun=false]
 * @param {boolean} [opts.truncate=false] — se true, limpa a tabela antes (uso excepcional / CLI --truncate)
 * @param {Function} [opts.log]
 */
async function runGoogleAdsConversoesSync(opts = {}) {
  const days = opts.days ?? 0;
  const dryRun = !!opts.dryRun;
  const truncate = opts.truncate === true;
  const log = opts.log || (() => {});

  let db = opts.db || getDb();
  let shouldDestroy = false;
  if (!db) {
    db = createStandaloneDb();
    shouldDestroy = true;
  }

  const selectSql = buildSelectSql(days);
  const insertSql = buildInsertOnlySql(selectSql);

  try {
    await migrateTableSchema(db, log);
    const stats = await fetchStats(db, days);

    const [previewTotal] = await db.raw(`SELECT COUNT(*) AS linhas FROM (${selectSql}) AS q`);
    const linhasElegiveis = Number(previewTotal?.[0]?.linhas ?? previewTotal?.linhas ?? 0);

    const [previewNew] = await db.raw(`
      SELECT COUNT(*) AS linhas FROM (${selectSql}) AS src
      WHERE NOT EXISTS (
        SELECT 1 FROM google_ads_conversoes AS g
        WHERE ${normalizeEmailSql(`g.${COL.EMAIL}`)} = src.${COL.EMAIL}
          AND NULLIF(src.${COL.EMAIL}, '') IS NOT NULL
      )
    `);
    const linhasNovas = Number(previewNew?.[0]?.linhas ?? previewNew?.linhas ?? 0);
    const linhasJaExistentes = Math.max(0, linhasElegiveis - linhasNovas);

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        stats,
        linhasPreview: linhasNovas,
        linhasElegiveis,
        linhasJaExistentes,
        message: `Dry-run: ${linhasNovas} linha(s) nova(s) seriam inseridas (${linhasJaExistentes} já na tabela).`,
      };
    }

    let duplicatesRemoved = 0;
    let updated = 0;
    let sanitized = 0;
    if (!truncate) {
      duplicatesRemoved = await removeDuplicateEmails(db, log);
      updated = await updateExistingPaymentDates(db, selectSql, log);
      sanitized = await sanitizeConversionAgainstFirstClick(db, log);
      updated += sanitized;
    } else {
      log('TRUNCATE google_ads_conversoes (modo substituir)');
      await db.raw('TRUNCATE TABLE google_ads_conversoes');
    }

    const [result] = await db.raw(
      truncate
        ? `INSERT INTO google_ads_conversoes (${[COL.GCLID, COL.EMAIL, COL.PHONE, COL.TIME, COL.VALUE, COL.CURRENCY, COL.GBRAID, COL.WBRAID, COL.IP].join(', ')}) ${selectSql}`
        : insertSql
    );
    const inserted = Number(result?.affectedRows ?? 0);

    if (!truncate && inserted > 0) {
      duplicatesRemoved += await removeDuplicateEmails(db, log);
      sanitized += await sanitizeConversionAgainstFirstClick(db, log);
    } else if (truncate) {
      sanitized = await sanitizeConversionAgainstFirstClick(db, log);
    }

    const [[totais]] = await db.raw(`
      SELECT COUNT(*) AS linhas,
        SUM(${COL.GCLID} IS NOT NULL AND ${COL.GCLID} <> '') AS com_gclid,
        SUM(${COL.PHONE} IS NOT NULL AND ${COL.PHONE} <> '') AS com_telefone
      FROM google_ads_conversoes`);

    return {
      ok: true,
      inserted,
      updated,
      skipped: Math.max(0, linhasJaExistentes - updated),
      duplicatesRemoved,
      linhasElegiveis,
      stats,
      totais: {
        linhas: Number(totais?.linhas ?? 0),
        comGclid: Number(totais?.com_gclid ?? 0),
        comTelefone: Number(totais?.com_telefone ?? 0),
      },
      message: truncate
        ? `Sync concluído (substituição): ${inserted} linha(s) na tabela.`
        : `Sync concluído: ${inserted} nova(s), ${updated} data(s) de pagamento atualizada(s), ${Math.max(0, linhasJaExistentes - updated)} já ok${duplicatesRemoved ? `, ${duplicatesRemoved} duplicata(s) removida(s)` : ''}. Total: ${Number(totais?.linhas ?? 0)}.`,
    };
  } catch (err) {
    return { ok: false, error: err.message, sql: err.sql };
  } finally {
    if (shouldDestroy && db) {
      await db.destroy();
    }
  }
}

module.exports = {
  runGoogleAdsConversoesSync,
  fetchStats,
  migrateTableSchema,
  removeDuplicateEmails,
  buildSelectSql,
};
