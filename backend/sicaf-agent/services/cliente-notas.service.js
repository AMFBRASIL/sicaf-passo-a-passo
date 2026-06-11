/**
 * Notas internas da equipe por cliente.
 */
const { getDb } = require('../database/connection');

async function ensureNotasTable(db) {
  const has = await db.schema.hasTable('cliente_notas_internas');
  if (has) return;
  await db.raw(`
    CREATE TABLE cliente_notas_internas (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      cliente_id BIGINT UNSIGNED NOT NULL,
      usuario_id BIGINT UNSIGNED DEFAULT NULL,
      texto TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_notas_cliente (cliente_id, created_at),
      CONSTRAINT fk_notas_cliente FOREIGN KEY (cliente_id)
        REFERENCES clientes (id) ON DELETE CASCADE,
      CONSTRAINT fk_notas_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[ClienteNotas] Tabela cliente_notas_internas criada.');
}

async function importLegacyObservacao(db, clienteId) {
  const countRow = await db('cliente_notas_internas')
    .where('cliente_id', clienteId)
    .count({ total: '*' })
    .first();
  const total = parseInt(countRow?.total || '0', 10);
  if (total > 0) return;

  const cliente = await db('clientes').where('id', clienteId).select('observacoes').first();
  const texto = String(cliente?.observacoes || '').trim();
  if (!texto) return;

  await db('cliente_notas_internas').insert({
    cliente_id: clienteId,
    usuario_id: null,
    texto,
    created_at: new Date(),
  });
}

function formatDateBr(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('pt-BR');
  } catch (_) {
    return String(d);
  }
}

async function listNotasCliente(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  await ensureNotasTable(db);
  await importLegacyObservacao(db, clienteId);

  const rows = await db('cliente_notas_internas as n')
    .leftJoin('usuarios as u', 'n.usuario_id', 'u.id')
    .where('n.cliente_id', clienteId)
    .select('n.id', 'n.texto', 'n.created_at', 'n.usuario_id', 'u.nome as usuario_nome')
    .orderBy('n.created_at', 'desc');

  return {
    ok: true,
    notas: rows.map((r) => ({
      id: r.id,
      texto: r.texto,
      autor: r.usuario_nome || 'Cadastro',
      data: formatDateBr(r.created_at),
      createdAt: r.created_at,
    })),
  };
}

async function criarNotaCliente({ clienteId, texto, usuarioId }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const conteudo = String(texto || '').trim();
  if (!conteudo) return { ok: false, error: 'Informe o texto da nota' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  await ensureNotasTable(db);

  const [id] = await db('cliente_notas_internas').insert({
    cliente_id: clienteId,
    usuario_id: usuarioId || null,
    texto: conteudo,
    created_at: new Date(),
  });

  let autor = 'Equipe CADBRASIL';
  if (usuarioId) {
    const user = await db('usuarios').where('id', usuarioId).select('nome').first();
    if (user?.nome) autor = user.nome;
  }

  try {
    const hasAudit = await db.schema.hasTable('auditoria_log');
    if (hasAudit) {
      await db('auditoria_log').insert({
        usuario_id: usuarioId || null,
        cliente_id: clienteId,
        acao: 'CUSTOM:nota_interna',
        descricao: 'Nota interna adicionada',
        entidade: 'cliente_notas_internas',
        entidade_id: id,
        dados_novos: JSON.stringify({ texto: conteudo.slice(0, 200) }),
        created_at: new Date(),
      });
    }
  } catch (_) {}

  return {
    ok: true,
    nota: {
      id,
      texto: conteudo,
      autor,
      data: formatDateBr(new Date()),
    },
    message: 'Nota salva com sucesso',
  };
}

module.exports = {
  listNotasCliente,
  criarNotaCliente,
};
