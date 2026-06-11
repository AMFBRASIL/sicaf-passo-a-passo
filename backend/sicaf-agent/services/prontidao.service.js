/**
 * Prontidão para licitar — agrega dados reais por empresa do usuário.
 */
const { getDb } = require('../database/connection');
const sicafListService = require('./sicaf-list.service');
const { getChecklistDocumentos } = require('./certidoes.service');

const ROMAN_TO_NUM = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

function sicafUiStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'ativo') return 'ok';
  if (s === 'vencendo') return 'warn';
  if (s === 'vencido') return 'danger';
  return 'warn';
}

function prioridadeFromScore(score) {
  if (score >= 80) return 'baixa';
  if (score >= 50) return 'media';
  return 'alta';
}

function acaoFromScore(score, sicafStatus, docsPend) {
  if (score >= 80) return 'Pronta para licitar. Monitore certidões e validade do SICAF.';
  if (sicafStatus === 'danger') return `SICAF crítico. ${docsPend} documento(s) pendente(s) para reativar cadastro.`;
  if (docsPend > 0) return `${docsPend} documento(s) pendente(s). Regularize para aumentar o score.`;
  return 'Atualize certidões e níveis SICAF para melhorar a prontidão.';
}

async function getPortfolioProntidao(usuarioId, search = '') {
  const list = await sicafListService.listSicaf(search, usuarioId);
  if (!list.ok) return list;

  const empresas = [];
  for (const item of list.items || []) {
    const checklist = await getChecklistDocumentos(item.clienteId, usuarioId);
    let docsOk = 0;
    let docsTotal = 0;
    let certOk = 0;
    let certWarn = 0;
    let certDanger = 0;

    if (checklist.ok && checklist.docsPorNivel) {
      for (const items of Object.values(checklist.docsPorNivel)) {
        for (const d of items) {
          docsTotal += 1;
          if (d.status === 'ok') docsOk += 1;
          else certDanger += 1;
        }
      }
      certOk = docsOk;
    }

    const niveis = (item.levels || []).map((r) => ROMAN_TO_NUM[r] || 0).filter((n) => n > 0);
    const nivelMax = niveis.length ? Math.max(...niveis) : 0;
    const sicafSt = sicafUiStatus(item.status);

    const scoreSicaf = item.status === 'Ativo' ? 40 : item.status === 'Vencendo' ? 25 : item.status === 'Vencido' ? 5 : 10;
    const scoreCert = docsTotal ? Math.round((docsOk / docsTotal) * 30) : 0;
    const scoreDocs = docsTotal ? Math.round((docsOk / docsTotal) * 20) : 0;
    const scoreHist = item.hasSicaf && item.status === 'Ativo' ? 10 : item.hasSicaf ? 5 : 0;
    const score = Math.min(100, scoreSicaf + scoreCert + scoreDocs + scoreHist);

    empresas.push({
      id: String(item.clienteId),
      razao: item.client,
      cnpj: item.documento,
      uf: item.estado || '—',
      score,
      sicaf: { nivel: nivelMax, status: sicafSt },
      certidoes: { ok: certOk, warn: certWarn, danger: certDanger },
      docs: { ok: docsOk, total: docsTotal || docsOk },
      prioridade: prioridadeFromScore(score),
      acao: acaoFromScore(score, sicafSt, docsTotal - docsOk),
      clienteId: item.clienteId,
    });
  }

  empresas.sort((a, b) => a.score - b.score);

  const media = empresas.length
    ? Math.round(empresas.reduce((s, e) => s + e.score, 0) / empresas.length)
    : 0;

  return {
    ok: true,
    empresas,
    resumo: {
      media,
      prontas: empresas.filter((e) => e.score >= 80).length,
      atencao: empresas.filter((e) => e.score >= 50 && e.score < 80).length,
      criticas: empresas.filter((e) => e.score < 50).length,
    },
  };
}

module.exports = { getPortfolioProntidao };
