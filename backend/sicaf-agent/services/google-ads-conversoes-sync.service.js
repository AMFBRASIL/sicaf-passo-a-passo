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
};

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
  const periodFilter =
    days > 0
      ? `AND COALESCE(pago_em, '1970-01-01') >= DATE_SUB(NOW(), INTERVAL ${Number(days)} DAY)`
      : '';

  return `
    SELECT cliente_id, MAX(pago_em) AS ultimo_pagamento
    FROM (
      SELECT t.cliente_id, COALESCE(t.data_pagamento, t.created_at) AS pago_em
      FROM taxas_sicaf AS t
      WHERE t.cliente_id IS NOT NULL AND ${TAXA_SICAF_PAGA_SQL}
      UNION ALL
      SELECT p.cliente_id, COALESCE(p.data_pagamento, p.updated_at, p.created_at) AS pago_em
      FROM ${PAGAMENTOS_TABLE} AS p
      WHERE p.cliente_id IS NOT NULL AND p.origem = 'sicaf' AND ${PG_PAGO_SQL}
    ) AS pagos_sicaf
    WHERE pago_em IS NOT NULL
    ${periodFilter}
    GROUP BY cliente_id
  `;
}

function normalizeEmailSql(columnSql) {
  return `REPLACE(LOWER(TRIM(COALESCE(${columnSql}, ''))), ' ', '')`;
}

function buildSelectSql(days) {
  const pagoSub = buildPagamentoSicafSubquery(days);
  return `
SELECT
  ranked.gclid_val AS ${COL.GCLID},
  ranked.email_val AS ${COL.EMAIL},
  ranked.phone_val AS ${COL.PHONE},
  ranked.time_val AS ${COL.TIME}
FROM (
  SELECT
    src.gclid_val,
    src.email_val,
    src.phone_val,
    src.time_val,
    ROW_NUMBER() OVER (
      PARTITION BY src.email_val
      ORDER BY src.time_val DESC, src.cliente_id DESC
    ) AS rn
  FROM (
    SELECT
      c.id AS cliente_id,
      tg.gclid AS gclid_val,
      REPLACE(LOWER(TRIM(c.email)), ' ', '') AS email_val,
      ${PHONE_E164_SQL} AS phone_val,
      pago.ultimo_pagamento AS time_val
    FROM clientes AS c
    INNER JOIN (${pagoSub}) AS pago ON pago.cliente_id = c.id
    LEFT JOIN (
      SELECT ts.cliente_id,
        SUBSTRING_INDEX(
          GROUP_CONCAT(NULLIF(TRIM(ts.gclid), '') ORDER BY ts.created_at DESC SEPARATOR '||'),
          '||', 1
        ) AS gclid
      FROM tracking_sessoes AS ts
      WHERE ts.cliente_id IS NOT NULL AND NULLIF(TRIM(ts.gclid), '') IS NOT NULL
      GROUP BY ts.cliente_id
    ) AS tg ON tg.cliente_id = c.id
    WHERE NULLIF(TRIM(c.email), '') IS NOT NULL
  ) AS src
  WHERE src.email_val IS NOT NULL AND src.time_val IS NOT NULL
) AS ranked
WHERE ranked.rn = 1
`;
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
  return `
INSERT INTO google_ads_conversoes (${[COL.GCLID, COL.EMAIL, COL.PHONE, COL.TIME].join(', ')})
SELECT src.${COL.GCLID}, src.${COL.EMAIL}, src.${COL.PHONE}, src.${COL.TIME}
FROM (${selectSql}) AS src
WHERE NOT EXISTS (
  SELECT 1 FROM google_ads_conversoes AS g
  WHERE ${emailNormExisting} = src.${COL.EMAIL}
    AND NULLIF(src.${COL.EMAIL}, '') IS NOT NULL
)
`;
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
  if (cols.includes(COL.EMAIL) && cols.includes(COL.TIME) && timeType === 'datetime') return;

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
    if (!truncate) {
      duplicatesRemoved = await removeDuplicateEmails(db, log);
    } else {
      log('TRUNCATE google_ads_conversoes (modo substituir)');
      await db.raw('TRUNCATE TABLE google_ads_conversoes');
    }

    const [result] = await db.raw(truncate ? `INSERT INTO google_ads_conversoes (${[COL.GCLID, COL.EMAIL, COL.PHONE, COL.TIME].join(', ')}) ${selectSql}` : insertSql);
    const inserted = Number(result?.affectedRows ?? 0);

    if (!truncate && inserted > 0) {
      duplicatesRemoved += await removeDuplicateEmails(db, log);
    }

    const [[totais]] = await db.raw(`
      SELECT COUNT(*) AS linhas,
        SUM(${COL.GCLID} IS NOT NULL AND ${COL.GCLID} <> '') AS com_gclid,
        SUM(${COL.PHONE} IS NOT NULL AND ${COL.PHONE} <> '') AS com_telefone
      FROM google_ads_conversoes`);

    return {
      ok: true,
      inserted,
      skipped: linhasJaExistentes,
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
        : `Sync concluído: ${inserted} nova(s), ${linhasJaExistentes} já existente(s)${duplicatesRemoved ? `, ${duplicatesRemoved} duplicata(s) removida(s)` : ''}. Total: ${Number(totais?.linhas ?? 0)}.`,
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
