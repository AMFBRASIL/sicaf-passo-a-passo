/**
 * Corrige mojibake comum em dados migrados do legado:
 * "GestÃ£o" → "Gestão" (UTF-8 lido/gravado como Latin-1).
 */

const MOJIBAKE_RE = /Ã[\u0080-\u00FF]|Â[\u0080-\u00FF]/;

function looksLikeMojibake(value) {
  return typeof value === 'string' && MOJIBAKE_RE.test(value);
}

function fixMojibake(value) {
  if (!looksLikeMojibake(value)) return value;
  try {
    const fixed = Buffer.from(value, 'latin1').toString('utf8');
    if (fixed.includes('\uFFFD')) return value;
    return fixed;
  } catch {
    return value;
  }
}

function fixTextFields(row, fields) {
  if (!row || typeof row !== 'object') return row;
  for (const key of fields) {
    if (typeof row[key] === 'string') {
      row[key] = fixMojibake(row[key]);
    }
  }
  return row;
}

module.exports = { fixMojibake, looksLikeMojibake, fixTextFields };
