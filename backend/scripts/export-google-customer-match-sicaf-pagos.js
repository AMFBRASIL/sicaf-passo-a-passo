/**
 * Exporta CSV Google Ads Customer Match — empresas com taxa SICAF quitada.
 *
 * Uso:
 *   node scripts/export-google-customer-match-sicaf-pagos.js
 *   node scripts/export-google-customer-match-sicaf-pagos.js --out=../exports/sicaf-pagos.csv
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const { initDatabase, getDb } = require('../sicaf-agent/database/connection');

const PAGAMENTOS_TABLE = 'pagamentos';

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

const INSTRUCTION_LINES = [
  '# Instructions:',
  '# Customer Match data files must follow specific formatting guidelines in order to be accepted. Incorrect formatting can lead to an upload error or a low number of matched records.',
  '#',
  '# Un-hashed (Plain Text) Formatting Guidelines:',
  '# Files must be in the CSV format',
  '# All identifiers for one user record must be comma-separated. Different user records must be separated by a line break. They cannot be separated with a space or semicolon',
  '# Headers must be: Email, Phone, First Name, Last Name, Country, Zip (multiple email, phone, and postal columns are allowed)',
  '# You must provide First Name and Last Name if you want Google Ads to create a Country and Zip match',
  '# The Phone column header name is required to upload phone numbers. The only formatting requirement is to include country code.',
  '#',
  '# Hashed Formatting Guidelines:',
  '# All of the above',
  '# Lowercase all characters and remove all extra spaces before after or in between email addresses and names',
  '# Phone numbers must be formatted as E.164 prior to hashing https://en.wikipedia.org/wiki/E.164',
  '#',
  '# Field Specific Guidelines:',
  '# Please reference this help center article for field specific requirements: https://support.google.com/google-ads/answer/7475964',
  '#',
];

const CSV_HEADER = 'Email,First Name,Last Name,Country,Zip,Email,Zip,Phone,Phone';

function parseArgs(argv) {
  const opts = {
    out: path.resolve(__dirname, '..', '..', 'exports', 'google-customer-match-sicaf-pagos.csv'),
  };
  for (const arg of argv) {
    const m = arg.match(/^--out=(.+)$/);
    if (m) opts.out = path.resolve(m[1]);
  }
  return opts;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return '';
  return email.replace(/\s+/g, '');
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function toE164(phone) {
  let d = digitsOnly(phone).replace(/^0+/, '');
  if (!d) return '';
  if (/^55[1-9]\d{10}$/.test(d)) return `+${d}`;
  if (/^[1-9]\d9\d{8}$/.test(d)) return `+55${d}`;
  if (/^[1-9]\d{9}$/.test(d)) return `+55${d}`;
  if (/^[1-9]\d{10}$/.test(d)) return `+55${d}`;
  return '';
}

function splitName(fullName) {
  const raw = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { firstName: '', lastName: '' };
  const parts = raw.split(' ');
  if (parts.length === 1) return { firstName: parts[0].toLowerCase(), lastName: '' };
  return {
    firstName: parts[0].toLowerCase(),
    lastName: parts.slice(1).join(' ').toLowerCase(),
  };
}

function normalizeZip(cep) {
  const d = digitsOnly(cep);
  if (d.length === 8) return d;
  return d || '';
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildPagamentoSicafSubquery() {
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
    GROUP BY cliente_id
  `;
}

async function fetchClientesPagos(db) {
  const pagoSub = buildPagamentoSicafSubquery();
  const [rows] = await db.raw(`
    SELECT
      c.id,
      c.email,
      c.responsavel_email,
      c.responsavel_nome,
      c.razao_social,
      c.nome_fantasia,
      c.cep,
      c.celular,
      c.telefone,
      c.responsavel_telefone,
      pago.ultimo_pagamento
    FROM clientes AS c
    INNER JOIN (${pagoSub}) AS pago ON pago.cliente_id = c.id
    ORDER BY pago.ultimo_pagamento DESC, c.id DESC
  `);
  return Array.isArray(rows) ? rows : [];
}

function mapRowToCustomerMatch(row) {
  const email = normalizeEmail(row.responsavel_email || row.email);
  if (!email) return null;

  const nameSource =
    row.responsavel_nome ||
    row.nome_fantasia ||
    String(row.razao_social || '').split(/\s+/).slice(0, 3).join(' ') ||
    'cliente';
  const { firstName, lastName } = splitName(nameSource);
  const phone =
    toE164(row.celular) ||
    toE164(row.telefone) ||
    toE164(row.responsavel_telefone) ||
    '';
  const zip = normalizeZip(row.cep);

  return {
    email,
    firstName,
    lastName,
    country: 'br',
    zip,
    phone,
  };
}

function dedupeByEmail(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row?.email) continue;
    if (!map.has(row.email)) map.set(row.email, row);
  }
  return [...map.values()];
}

function buildCsvContent(records) {
  const lines = [...INSTRUCTION_LINES, CSV_HEADER];
  for (const r of records) {
    lines.push(
      [
        csvEscape(r.email),
        csvEscape(r.firstName),
        csvEscape(r.lastName),
        csvEscape(r.country),
        csvEscape(r.zip),
        '',
        '',
        csvEscape(r.phone),
        '',
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  initDatabase();
  const db = getDb();
  if (!db) {
    console.error('Banco de dados não disponível. Verifique backend/.env');
    process.exit(1);
  }

  const rawRows = await fetchClientesPagos(db);
  const mapped = rawRows.map(mapRowToCustomerMatch).filter(Boolean);
  const records = dedupeByEmail(mapped).filter((r) => r.email);

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, buildCsvContent(records), 'utf8');

  const withPhone = records.filter((r) => r.phone).length;
  const withZip = records.filter((r) => r.zip).length;

  console.log('');
  console.log('Export Google Customer Match — SICAF pagos');
  console.log(`  Clientes com pagamento SICAF : ${rawRows.length}`);
  console.log(`  Linhas no CSV (e-mail único) : ${records.length}`);
  console.log(`  Com telefone E.164           : ${withPhone}`);
  console.log(`  Com CEP                      : ${withZip}`);
  console.log(`  Arquivo                      : ${opts.out}`);
  console.log('');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
