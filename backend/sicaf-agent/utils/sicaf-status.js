/**
 * Status exibido do SICAF — alinha listagem /clients e /sicaf com data_validade.
 * Se a credencial ainda está vigente, mostra Ativo/Vencendo mesmo que o campo
 * status no banco ainda diga "Pendente" (cadastros legados ou migração).
 */

function calcDaysRemaining(dataValidade) {
  if (!dataValidade) return null;
  const val = new Date(dataValidade);
  if (Number.isNaN(val.getTime())) return null;
  const now = new Date();
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const valUtc = Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate());
  return Math.ceil((valUtc - nowUtc) / (1000 * 60 * 60 * 24));
}

/**
 * @param {string|null} dbStatus - sicaf_cadastros.status
 * @param {string|Date|null} dataValidade - sicaf_cadastros.data_validade
 * @param {boolean} hasSicaf
 */
function resolveSicafDisplayStatus(dbStatus, dataValidade, hasSicaf = true) {
  if (!hasSicaf) return 'Sem SICAF';

  const daysRemaining = calcDaysRemaining(dataValidade);
  const db = String(dbStatus || '').trim();

  if (daysRemaining !== null) {
    if (daysRemaining <= 0) return 'Vencido';
    if (daysRemaining <= 30) return 'Vencendo';
    return 'Ativo';
  }

  if (['Ativo', 'Vencendo', 'Vencido', 'Pendente', 'Inativo'].includes(db)) return db;
  return db || 'Pendente';
}

function isSicafDisplayValid(dbStatus, dataValidade, hasSicaf = true) {
  const status = resolveSicafDisplayStatus(dbStatus, dataValidade, hasSicaf);
  return ['Ativo', 'Vencendo'].includes(status);
}

/**
 * Regra 1 — SICAF Ativo e pago: acesso liberado (assistente, etc.).
 */
function isSicafAcessoLiberado({ hasSicaf = false, status = '', financialReleased = false } = {}) {
  const s = String(status || '').trim() || 'Sem SICAF';
  if (!hasSicaf || s !== 'Ativo') return false;
  return !!financialReleased;
}

/**
 * Regra 2 — Vencido: sempre exige pagamento (renovação).
 * Regra 3 — Sem SICAF / sem pagamento / Ativo sem pago: exige pagamento.
 */
function needsSicafTaxaPayment({ hasSicaf = false, status = '', financialReleased = false } = {}) {
  const s = String(status || '').trim() || 'Sem SICAF';
  if (!hasSicaf || s === 'Sem SICAF') return true;
  if (s === 'Vencido') return true;
  if (isSicafAcessoLiberado({ hasSicaf, status: s, financialReleased })) return false;
  return true;
}

/** @deprecated Use isSicafAcessoLiberado */
function isSicafTaxaLiberada(params) {
  return isSicafAcessoLiberado(params);
}

function enrichSicafRow(sicafRow) {
  if (!sicafRow) return null;
  const daysRaw = calcDaysRemaining(sicafRow.data_validade);
  const status = resolveSicafDisplayStatus(sicafRow.status, sicafRow.data_validade, true);
  return {
    ...sicafRow,
    status,
    dias_validade: daysRaw !== null ? Math.max(0, daysRaw) : sicafRow.dias_validade,
  };
}

module.exports = {
  calcDaysRemaining,
  resolveSicafDisplayStatus,
  isSicafDisplayValid,
  needsSicafTaxaPayment,
  isSicafAcessoLiberado,
  isSicafTaxaLiberada,
  enrichSicafRow,
};
