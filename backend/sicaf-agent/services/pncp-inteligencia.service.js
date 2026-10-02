/**
 * PNCP Inteligente — inteligência de mercado público sobre a base captada do PNCP.
 *
 * Para um produto/serviço (palavras-chave), responde: quem compra, quanto, com que frequência,
 * o que está aberto agora e quais empresas já vendem esse objeto (contratos).
 */
const { getDb } = require('../database/connection');

const LOG_PREFIX = '[PNCP Inteligente]';
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

/** Termos para MATCH … AGAINST em modo booleano (todas as palavras, com prefixo). */
function termosFulltext(q) {
  return String(q || '')
    .normalize('NFC')
    .replace(/[+\-<>()~*"@]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3)
    .slice(0, 6)
    .map((p) => `+${p}*`)
    .join(' ');
}

function filtroObjeto(q, colunas) {
  const ft = termosFulltext(q);
  if (ft) return { sql: `MATCH(${colunas}) AGAINST (? IN BOOLEAN MODE)`, bindings: [ft] };
  const like = `%${String(q).trim()}%`;
  const partes = colunas.split(',').map((c) => `${c.trim()} LIKE ?`);
  return { sql: `(${partes.join(' OR ')})`, bindings: partes.map(() => like) };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function analisar({ q, uf, meses }) {
  const termo = String(q || '').trim();
  if (termo.length < 3) return { ok: false, error: 'Informe um produto ou serviço com ao menos 3 letras.' };
  const janela = [3, 6, 12, 24].includes(Number(meses)) ? Number(meses) : 12;
  const estado = uf ? String(uf).slice(0, 2).toUpperCase() : null;

  const chave = `${termo.toLowerCase()}|${estado || ''}|${janela}`;
  const hit = cache.get(chave);
  if (hit && hit.expira > Date.now()) return hit.data;

  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const obj = filtroObjeto(termo, 'objeto, objeto_resumido');
    let where = `data_publicacao >= DATE_SUB(NOW(), INTERVAL ${janela} MONTH) AND ${obj.sql}`;
    const b = [...obj.bindings];
    if (estado) {
      where += ' AND uf = ?';
      b.push(estado);
    }

    const objContrato = filtroObjeto(termo, 'objeto');
    const whereContrato = `data_assinatura >= DATE_SUB(NOW(), INTERVAL ${janela} MONTH) AND ${objContrato.sql}`;

    const [resumo, orgaos, porUf, porModalidade, porMes, abertas, fornecedores, resumoContratos] =
      await Promise.all([
        db.raw(
          `SELECT COUNT(*) total, COALESCE(SUM(valor_estimado),0) valor, COUNT(DISTINCT nome_orgao) orgaos,
                  SUM(CASE WHEN data_encerramento >= NOW() THEN 1 ELSE 0 END) abertas
             FROM licitacoes WHERE ${where}`,
          b,
        ),
        db.raw(
          `SELECT nome_orgao, CASE WHEN COUNT(DISTINCT uf) = 1 THEN MAX(uf) END uf,
                  CASE WHEN COUNT(DISTINCT municipio) = 1 THEN MAX(municipio) END municipio,
                  COUNT(*) n, COALESCE(SUM(valor_estimado),0) valor,
                  MAX(data_publicacao) ultima
             FROM licitacoes WHERE ${where} AND nome_orgao IS NOT NULL
            GROUP BY nome_orgao ORDER BY n DESC, valor DESC LIMIT 10`,
          b,
        ),
        db.raw(
          `SELECT uf, COUNT(*) n, COALESCE(SUM(valor_estimado),0) valor
             FROM licitacoes WHERE ${where} AND uf IS NOT NULL AND uf <> ''
            GROUP BY uf ORDER BY n DESC LIMIT 27`,
          b,
        ),
        db.raw(
          `SELECT modalidade, COUNT(*) n FROM licitacoes WHERE ${where} AND modalidade IS NOT NULL
            GROUP BY modalidade ORDER BY n DESC LIMIT 8`,
          b,
        ),
        db.raw(
          `SELECT DATE_FORMAT(data_publicacao, '%Y-%m') mes, COUNT(*) n, COALESCE(SUM(valor_estimado),0) valor
             FROM licitacoes WHERE ${where} GROUP BY mes ORDER BY mes`,
          b,
        ),
        db.raw(
          `SELECT id, nome_orgao, uf, municipio, modalidade, objeto_resumido, objeto, data_encerramento,
                  valor_estimado, numero_controle_pncp, link_portal, link_edital
             FROM licitacoes WHERE ${where} AND data_encerramento >= NOW()
            ORDER BY data_encerramento ASC LIMIT 10`,
          b,
        ),
        db.raw(
          `SELECT nome_contratado, MAX(cnpj_contratado) cnpj, COUNT(*) n, COALESCE(SUM(valor_global),0) valor
             FROM contratos WHERE ${whereContrato} AND nome_contratado IS NOT NULL
            GROUP BY nome_contratado ORDER BY n DESC, valor DESC LIMIT 10`,
          objContrato.bindings,
        ),
        db.raw(
          `SELECT COUNT(*) total, COALESCE(SUM(valor_global),0) valor, COUNT(DISTINCT cnpj_contratado) empresas
             FROM contratos WHERE ${whereContrato}`,
          objContrato.bindings,
        ),
      ]);

    const r = resumo[0][0] || {};
    const rc = resumoContratos[0][0] || {};
    const data = {
      ok: true,
      termo,
      uf: estado,
      meses: janela,
      resumo: {
        licitacoes: num(r.total),
        valorEstimado: num(r.valor),
        orgaos: num(r.orgaos),
        abertas: num(r.abertas),
        contratos: num(rc.total),
        valorContratado: num(rc.valor),
        empresasContratadas: num(rc.empresas),
      },
      orgaos: orgaos[0].map((o) => ({
        nome: o.nome_orgao,
        uf: o.uf,
        municipio: o.municipio,
        quantidade: num(o.n),
        valor: num(o.valor),
        ultima: o.ultima,
      })),
      porUf: porUf[0].map((u) => ({ uf: u.uf, quantidade: num(u.n), valor: num(u.valor) })),
      porModalidade: porModalidade[0].map((m) => ({ modalidade: m.modalidade, quantidade: num(m.n) })),
      porMes: porMes[0].map((m) => ({ mes: m.mes, quantidade: num(m.n), valor: num(m.valor) })),
      abertas: abertas[0].map((a) => ({
        id: a.id,
        orgao: a.nome_orgao,
        uf: a.uf,
        municipio: a.municipio,
        modalidade: a.modalidade,
        objeto: a.objeto_resumido || a.objeto,
        encerramento: a.data_encerramento,
        valor: a.valor_estimado != null ? num(a.valor_estimado) : null,
        numeroControlePncp: a.numero_controle_pncp,
        linkPortal: a.link_portal,
        linkEdital: a.link_edital,
      })),
      fornecedores: fornecedores[0].map((f) => ({
        nome: f.nome_contratado,
        cnpj: f.cnpj,
        contratos: num(f.n),
        valor: num(f.valor),
      })),
    };

    cache.set(chave, { data, expira: Date.now() + CACHE_TTL_MS });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return data;
  } catch (e) {
    console.error(`${LOG_PREFIX} analisar:`, e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { analisar };
