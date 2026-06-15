/**
 * Mapeamento unificado de status de nível SICAF (banco → UI).
 */

const ENABLED_HEADER_LEVELS = new Set(['I', 'II', 'V', 'VI']);

function normalizeStatusText(status) {
  return String(status || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function nivelStatusToUi(status) {
  const s = normalizeStatusText(status);
  if (!s || s.includes('nao informado') || s === 'nao_cadastrado') return 'nao_cadastrado';
  if (s.includes('valid') || s.includes('habilit') || s.includes('regular') || s.includes('ativo')) {
    return 'validado';
  }
  if (s.includes('vencendo') || s.includes('a vencer')) return 'vencendo';
  if (s.includes('vencid') || s.includes('expirad')) return 'vencido';
  if (s.includes('pend') || s.includes('parcial')) return 'pendente';
  return 'nao_cadastrado';
}

function rawStatusFromRow(row) {
  if (!row) return 'Não informado';
  if (!row.habilitado) return 'Não informado';
  let raw = row.status || 'Válido';
  if (ENABLED_HEADER_LEVELS.has(row.nivel) && raw === 'Pendente') {
    raw = 'Habilitado';
  }
  return raw;
}

function buildNivelDetailFromRow(row) {
  if (!row?.habilitado) {
    return {
      status: 'nao_cadastrado',
      observacao: row?.observacao || undefined,
    };
  }
  return {
    status: nivelStatusToUi(rawStatusFromRow(row)),
    observacao: row.observacao || undefined,
  };
}

function buildNiveisDetailFromRows(rows) {
  const detail = {};
  for (const row of rows || []) {
    if (!row?.nivel) continue;
    detail[row.nivel] = buildNivelDetailFromRow(row);
  }
  return detail;
}

module.exports = {
  ENABLED_HEADER_LEVELS,
  nivelStatusToUi,
  rawStatusFromRow,
  buildNivelDetailFromRow,
  buildNiveisDetailFromRows,
};
