/**
 * E-mails do cliente para cobrança e avisos (principal + financeiro + adicional).
 */

async function ensureClienteEmailExtrasColumns(db) {
  if (!db) return;
  for (const col of ['email_financeiro', 'email_adicional']) {
    try {
      const [cols] = await db.raw(`SHOW COLUMNS FROM clientes LIKE '${col}'`);
      if (!cols || cols.length === 0) {
        await db.raw(
          `ALTER TABLE clientes ADD COLUMN ${col} VARCHAR(255) NULL DEFAULT NULL AFTER email`,
        );
      }
    } catch (e) {
      console.warn(`[ClienteEmails] ensure ${col}:`, e.message);
    }
  }
}

function normalizeEmail(value) {
  const raw = String(value || '').trim();
  if (!raw || !raw.includes('@')) return null;
  const lower = raw.toLowerCase();
  if (lower.length < 5 || lower.startsWith('@') || lower.endsWith('@')) return null;
  return { display: raw, key: lower };
}

/**
 * Lista única de e-mails válidos do cadastro do cliente.
 * Ordem: principal → responsável → financeiro → adicional.
 */
function collectClienteEmails(cliente) {
  if (!cliente) return [];
  const candidates = [
    cliente.email,
    cliente.responsavel_email,
    cliente.email_financeiro,
    cliente.email_adicional,
  ];
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const n = normalizeEmail(c);
    if (!n || seen.has(n.key)) continue;
    seen.add(n.key);
    out.push(n.display);
  }
  return out;
}

module.exports = {
  ensureClienteEmailExtrasColumns,
  collectClienteEmails,
  normalizeEmail,
};
