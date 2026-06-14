/**
 * Prontidão para licitar — agrega dados reais por empresa do usuário.
 * Score: SICAF (40%) + certidões (30%) + documentos (20%) + histórico licitações (10%).
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

function acaoFromScore(score, sicafStatus, docsPend, propostasCount) {
  if (score >= 80) return 'Pronta para licitar. Monitore certidões e validade do SICAF.';
  if (sicafStatus === 'danger') {
    return `SICAF crítico. ${docsPend} documento(s) pendente(s) para reativar cadastro.`;
  }
  if (docsPend > 0) {
    return `${docsPend} documento(s) pendente(s). Regularize para aumentar o score.`;
  }
  if (!propostasCount) {
    return 'Cadastro em dia — considere participar de licitações para consolidar histórico.';
  }
  return 'Atualize certidões e níveis SICAF para melhorar a prontidão.';
}

function countChecklistStats(docsPorNivel) {
  let docsOk = 0;
  let docsTotal = 0;
  let certOk = 0;
  let certWarn = 0;
  let certDanger = 0;

  for (const items of Object.values(docsPorNivel || {})) {
    for (const d of items) {
      docsTotal += 1;
      const st = String(d.status || 'pendente').toLowerCase();
      if (st === 'ok') {
        docsOk += 1;
        certOk += 1;
      } else if (st === 'vencendo') {
        certWarn += 1;
      } else {
        certDanger += 1;
      }
    }
  }

  return { docsOk, docsTotal, certOk, certWarn, certDanger };
}

function scoreSicafPart(status, nivelMax) {
  const base =
    status === 'Ativo' ? 30 : status === 'Vencendo' ? 18 : status === 'Vencido' ? 5 : 8;
  const nivelPart = nivelMax > 0 ? Math.round((nivelMax / 6) * 10) : 0;
  return Math.min(40, base + nivelPart);
}

function scoreCertidoesPart(certOk, certWarn, docsTotal) {
  if (!docsTotal) return 0;
  const weighted = certOk + certWarn * 0.5;
  return Math.round((weighted / docsTotal) * 30);
}

function scoreDocumentosPart(docsOk, docsTotal) {
  if (!docsTotal) return 0;
  return Math.round((docsOk / docsTotal) * 20);
}

function scoreLicitacoesPart(propostasCount, hasSicaf, status) {
  if (propostasCount >= 5) return 10;
  if (propostasCount >= 2) return 8;
  if (propostasCount >= 1) return 6;
  if (hasSicaf && status === 'Ativo') return 3;
  return 0;
}

async function loadPropostasCountByCliente(clienteIds) {
  const map = {};
  if (!clienteIds.length) return map;

  const db = getDb();
  if (!db) return map;

  try {
    const rows = await db('propostas')
      .whereIn('cliente_id', clienteIds)
      .groupBy('cliente_id')
      .select('cliente_id')
      .count({ total: '*' });

    for (const row of rows) {
      map[Number(row.cliente_id)] = Number(row.total || 0);
    }
  } catch (_) {
    // tabela propostas pode não existir em ambientes antigos
  }

  return map;
}

async function getPortfolioProntidao(usuarioId, search = '') {
  const list = await sicafListService.listSicaf(search, usuarioId);
  if (!list.ok) return list;

  const clienteIds = (list.items || []).map((item) => Number(item.clienteId)).filter((id) => id > 0);
  const propostasMap = await loadPropostasCountByCliente(clienteIds);

  const empresas = [];
  for (const item of list.items || []) {
    const checklist = await getChecklistDocumentos(item.clienteId, usuarioId);
    const stats =
      checklist.ok && checklist.docsPorNivel
        ? countChecklistStats(checklist.docsPorNivel)
        : { docsOk: 0, docsTotal: 0, certOk: 0, certWarn: 0, certDanger: 0 };

    const { docsOk, docsTotal, certOk, certWarn, certDanger } = stats;
    const docsPend = Math.max(0, docsTotal - docsOk);

    const niveis = (item.levels || []).map((r) => ROMAN_TO_NUM[r] || 0).filter((n) => n > 0);
    const nivelMax = niveis.length ? Math.max(...niveis) : 0;
    const sicafSt = sicafUiStatus(item.status);
    const propostasCount = propostasMap[Number(item.clienteId)] || 0;

    const score =
      scoreSicafPart(item.status, nivelMax) +
      scoreCertidoesPart(certOk, certWarn, docsTotal) +
      scoreDocumentosPart(docsOk, docsTotal) +
      scoreLicitacoesPart(propostasCount, item.hasSicaf, item.status);

    empresas.push({
      id: String(item.clienteId),
      razao: item.client,
      cnpj: item.documento,
      uf: item.estado || '—',
      score: Math.min(100, Math.round(score)),
      sicaf: { nivel: nivelMax, status: sicafSt },
      certidoes: { ok: certOk, warn: certWarn, danger: certDanger },
      docs: { ok: docsOk, total: docsTotal },
      propostas: propostasCount,
      prioridade: prioridadeFromScore(score),
      acao: acaoFromScore(score, sicafSt, docsPend, propostasCount),
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
    atualizadoEm: new Date().toISOString(),
  };
}

module.exports = { getPortfolioProntidao };
