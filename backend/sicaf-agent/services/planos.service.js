/**
 * Planos comerciais — cadastro SICAF e outros.
 */
const { getDb } = require('../database/connection');

const SICAF_CADASTRO_CODIGOS = ['sicaf_padrao', 'sicaf_imediato'];

function parseRecursos(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function formatPlanoRow(row) {
  const recursos = parseRecursos(row.recursos);
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    descricao: row.descricao || '',
    preco: parseFloat(row.preco),
    tipo: row.tipo,
    destaque: row.destaque === 1,
    ordem: row.ordem,
    prazo: recursos.prazo || null,
    badge: recursos.badge || null,
    icon: recursos.icon || null,
    categoria: recursos.categoria || null,
  };
}

async function tableExists(db) {
  try {
    const r = await db.schema.hasTable('planos');
    return r;
  } catch (_) {
    return false;
  }
}

/**
 * Lista planos de cadastro SICAF (tela de pagamento).
 */
async function listPlanosSicafCadastro() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    if (!(await tableExists(db))) {
      return { ok: false, error: 'Tabela planos não encontrada no banco de dados.' };
    }

    const rows = await db('planos')
      .where('ativo', 1)
      .whereIn('codigo', SICAF_CADASTRO_CODIGOS)
      .orderBy('ordem', 'asc');

    if (!rows.length) {
      return {
        ok: false,
        error: 'Planos SICAF não cadastrados (sicaf_padrao / sicaf_imediato). Execute: npm run db:seed-planos-sicaf',
      };
    }

    return { ok: true, planos: rows.map(formatPlanoRow) };
  } catch (e) {
    console.error('[Planos] listPlanosSicafCadastro:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Busca plano por código (ativo).
 */
async function getPlanoByCodigo(codigo) {
  const db = getDb();
  if (!db || !codigo) return null;
  try {
    if (!(await tableExists(db))) return null;
    const row = await db('planos').where({ codigo, ativo: 1 }).first();
    return row ? formatPlanoRow(row) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Valor da taxa: plano informado → fallback configuracoes_sistema.
 */
async function resolveValorTaxaSicaf(planoCodigo) {
  const db = getDb();
  if (!db) return 985.0;

  if (planoCodigo) {
    const plano = await getPlanoByCodigo(planoCodigo);
    if (plano && Number.isFinite(plano.preco) && plano.preco > 0) {
      return plano.preco;
    }
  }

  try {
    const cfg = await db('configuracoes_sistema').where('chave', 'valor_cadastro_sicaf').first();
    if (cfg) return parseFloat(cfg.valor);
  } catch (_) {}

  return 985.0;
}

module.exports = {
  listPlanosSicafCadastro,
  getPlanoByCodigo,
  resolveValorTaxaSicaf,
  SICAF_CADASTRO_CODIGOS,
};
