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

/** Extrai data DD/MM/AAAA da observação gravada pelo PDF Situação do Fornecedor. */
function extractValidadeFromObservacao(observacao) {
  if (!observacao?.trim()) return null;

  const validadeExplicita = observacao.match(/validade[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
  if (validadeExplicita?.[1]) return validadeExplicita[1];

  const valParenteses = observacao.match(/\(Val:\s*(\d{2}\/\d{2}\/\d{4})\)/i);
  if (valParenteses?.[1]) return valParenteses[1];

  const datas = [...observacao.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map((m) => m[1]);
  if (datas.length === 0) return null;
  if (datas.length === 1) return datas[0];

  const ordenadas = [...datas].sort((a, b) => {
    const toTime = (d) => {
      const [dd, mm, yyyy] = d.split('/').map(Number);
      return new Date(yyyy, mm - 1, dd).getTime();
    };
    return toTime(a) - toTime(b);
  });
  return ordenadas[0];
}

function parseBrDate(dateStr) {
  const m = String(dateStr || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function isValidadeFutura(dateStr) {
  const d = parseBrDate(dateStr);
  if (!d) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d >= hoje;
}

/** Nível marcado como válido no PDF com validade futura na observação. */
function nivelValidadoComValidadePdf(niveisDetail, nivelRoman) {
  const det = niveisDetail?.[nivelRoman];
  if (!det || det.status !== 'validado') return false;
  const validade = extractValidadeFromObservacao(det.observacao);
  return validade ? isValidadeFutura(validade) : false;
}

module.exports = {
  ENABLED_HEADER_LEVELS,
  nivelStatusToUi,
  rawStatusFromRow,
  buildNivelDetailFromRow,
  buildNiveisDetailFromRows,
  extractValidadeFromObservacao,
  nivelValidadoComValidadePdf,
};
