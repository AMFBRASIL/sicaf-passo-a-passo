/**
 * Preços comerciais (SICAF / manutenção) — lê configuracoes_sistema.
 * Fallback apenas se a chave não existir no banco.
 */
const { getDb } = require('../database/connection');

const FALLBACK = {
  valor_cadastro_sicaf: 985,
  valor_cadastro_sicaf_imediato: 1480,
  valor_manutencao_mensal: 155,
  valor_manutencao_anual: 1860,
};

function parseMoney(val, fallback) {
  if (val === undefined || val === null || String(val).trim() === '') return fallback;
  let s = String(val).trim().replace(/R\$\s?/gi, '').replace(/\s/g, '');
  if (!s) return fallback;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

async function getPrecosComerciais(dbArg) {
  const db = dbArg || getDb();
  const out = {
    valorCadastroSicaf: FALLBACK.valor_cadastro_sicaf,
    valorCadastroSicafImediato: FALLBACK.valor_cadastro_sicaf_imediato,
    valorManutencaoMensal: FALLBACK.valor_manutencao_mensal,
    valorManutencaoAnual: FALLBACK.valor_manutencao_anual,
  };

  if (!db) return out;

  try {
    const rows = await db('configuracoes_sistema').whereIn('chave', [
      'valor_cadastro_sicaf',
      'valor_cadastro_sicaf_imediato',
      'valor_manutencao_mensal',
      'valor_manutencao_anual',
    ]);
    const map = {};
    for (const row of rows || []) {
      if (row.chave) map[row.chave] = row.valor;
    }
    out.valorCadastroSicaf = parseMoney(map.valor_cadastro_sicaf, out.valorCadastroSicaf);
    out.valorCadastroSicafImediato = parseMoney(
      map.valor_cadastro_sicaf_imediato,
      out.valorCadastroSicafImediato,
    );
    out.valorManutencaoMensal = parseMoney(map.valor_manutencao_mensal, out.valorManutencaoMensal);
    const anualDerivado = Math.round(out.valorManutencaoMensal * 12 * 100) / 100;
    out.valorManutencaoAnual = parseMoney(map.valor_manutencao_anual, anualDerivado);
  } catch (_) {}

  return out;
}

function formatBrl(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

module.exports = {
  FALLBACK,
  getPrecosComerciais,
  formatBrl,
  parseMoney,
};
