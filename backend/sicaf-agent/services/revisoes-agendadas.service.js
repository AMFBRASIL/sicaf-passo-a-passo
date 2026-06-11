/**
 * Revisões agendadas pelo usuário + vencimentos SICAF do portfólio.
 */
const { getDb } = require('../database/connection');
const { assertClienteAcessivel } = require('./client-access.service');
const sicafListService = require('./sicaf-list.service');

async function ensureRevisoesTable(db) {
  const has = await db.schema.hasTable('revisoes_agendadas');
  if (has) return;
  await db.raw(`
    CREATE TABLE revisoes_agendadas (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      usuario_id BIGINT UNSIGNED NOT NULL,
      cliente_id BIGINT UNSIGNED NOT NULL,
      data_alvo DATE NOT NULL,
      meses_lembrete TINYINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_revisoes_usuario_data (usuario_id, data_alvo),
      KEY idx_revisoes_cliente (cliente_id),
      CONSTRAINT fk_revisoes_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON DELETE CASCADE,
      CONSTRAINT fk_revisoes_cliente FOREIGN KEY (cliente_id)
        REFERENCES clientes (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[RevisoesAgendadas] Tabela revisoes_agendadas criada.');
}

function parseDateInput(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const str = String(value).trim();
  const br = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  }
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? null : new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function toIsoDate(d) {
  const dt = parseDateInput(d);
  if (!dt) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T12:00:00.000Z`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** SICAF entra na lista só quando a renovação está próxima (não todo cadastro ativo). */
function sicafPrecisaRevisaoEmBreve(item) {
  if (!item?.hasSicaf) return false;
  const status = String(item.status || '').trim();
  if (status === 'Vencendo' || status === 'Vencido') return true;
  if (item.daysValid != null && item.daysValid <= 90) return true;
  return false;
}

async function listarRevisoesAgendadas(usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureRevisoesTable(db);

  const hoje = startOfToday();
  const hojeSql = hoje.toISOString().slice(0, 10);

  const manualRows = await db('revisoes_agendadas as r')
    .join('clientes as c', 'r.cliente_id', 'c.id')
    .where('r.usuario_id', usuarioId)
    .where('r.data_alvo', '>=', hojeSql)
    .select(
      'r.id',
      'r.cliente_id',
      'r.data_alvo',
      'r.meses_lembrete',
      'r.created_at',
      'c.razao_social',
      'c.nome_fantasia',
      'c.documento',
    )
    .orderBy('r.data_alvo', 'asc');

  const manualClienteIds = new Set(manualRows.map((r) => Number(r.cliente_id)));

  const agendamentos = manualRows.map((r) => ({
    id: String(r.id),
    origem: 'manual',
    clienteId: Number(r.cliente_id),
    empresa: r.razao_social || r.nome_fantasia || 'Empresa',
    cnpj: r.documento || '',
    dataAlvo: toIsoDate(r.data_alvo),
    criadoEm: toIsoDate(r.created_at),
    mesesLembrete: r.meses_lembrete != null ? Number(r.meses_lembrete) : null,
    removivel: true,
  }));

  const list = await sicafListService.listSicaf('', usuarioId);
  if (list.ok) {
    for (const item of list.items || []) {
      const clienteId = Number(item.clienteId || 0);
      if (!clienteId || manualClienteIds.has(clienteId)) continue;
      if (!sicafPrecisaRevisaoEmBreve(item)) continue;

      const validade = parseDateInput(item.expiryDate);
      if (!validade || validade < hoje) continue;

      agendamentos.push({
        id: `sicaf-${clienteId}`,
        origem: 'sicaf',
        clienteId,
        empresa: item.client || item.fantasyName || 'Empresa',
        cnpj: item.documento || '',
        dataAlvo: toIsoDate(validade),
        criadoEm: null,
        mesesLembrete: null,
        removivel: false,
        statusSicaf: item.status || null,
      });
    }
  }

  agendamentos.sort((a, b) => new Date(a.dataAlvo).getTime() - new Date(b.dataAlvo).getTime());

  return { ok: true, agendamentos };
}

async function criarRevisaoAgendada({ usuarioId, clienteId, meses, jwtTipo }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const mesesNum = parseInt(String(meses), 10);
  if (![3, 6, 12].includes(mesesNum)) {
    return { ok: false, error: 'Prazo inválido. Use 3, 6 ou 12 meses.' };
  }

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId, jwtTipo);
  if (!cliente) return { ok: false, error: 'Empresa não encontrada ou sem permissão' };

  await ensureRevisoesTable(db);

  const dataAlvo = startOfToday();
  dataAlvo.setMonth(dataAlvo.getMonth() + mesesNum);

  const [id] = await db('revisoes_agendadas').insert({
    usuario_id: usuarioId,
    cliente_id: clienteId,
    data_alvo: dataAlvo,
    meses_lembrete: mesesNum,
    created_at: new Date(),
  });

  return {
    ok: true,
    agendamento: {
      id: String(id),
      origem: 'manual',
      clienteId: Number(clienteId),
      empresa: cliente.razao_social || cliente.nome_fantasia || 'Empresa',
      cnpj: cliente.documento || '',
      dataAlvo: toIsoDate(dataAlvo),
      criadoEm: toIsoDate(new Date()),
      mesesLembrete: mesesNum,
      removivel: true,
    },
  };
}

async function removerRevisaoAgendada({ usuarioId, id }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const revisaoId = parseInt(String(id), 10);
  if (!Number.isFinite(revisaoId) || revisaoId <= 0) {
    return { ok: false, error: 'Agendamento inválido' };
  }

  await ensureRevisoesTable(db);

  const row = await db('revisoes_agendadas')
    .where({ id: revisaoId, usuario_id: usuarioId })
    .first();

  if (!row) return { ok: false, error: 'Agendamento não encontrado' };

  await db('revisoes_agendadas').where({ id: revisaoId, usuario_id: usuarioId }).delete();

  return { ok: true };
}

module.exports = {
  listarRevisoesAgendadas,
  criarRevisaoAgendada,
  removerRevisaoAgendada,
};
