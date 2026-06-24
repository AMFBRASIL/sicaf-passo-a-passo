/**
 * Régua de cobrança — etapas automáticas e configuração.
 */
const { getDb } = require('../database/connection');

const CANAIS_VALIDOS = new Set(['email', 'whatsapp', 'sms', 'ligacao', 'nenhum']);

const ETAPAS_PADRAO = [
  {
    ordem: 1,
    dias_relativo: -3,
    canal: 'email',
    titulo: 'Lembrete pré-vencimento',
    mensagem:
      'Olá {nome}, seu pagamento de {valor} referente a {servico} vence em 3 dias. Acesse: {link}',
    ativo: 1,
  },
  {
    ordem: 2,
    dias_relativo: 1,
    canal: 'whatsapp',
    titulo: 'Aviso de atraso',
    mensagem:
      '{nome}, identificamos que o pagamento de {valor} venceu. Regularize pelo link: {link}',
    ativo: 1,
  },
  {
    ordem: 3,
    dias_relativo: 7,
    canal: 'whatsapp',
    titulo: 'Segunda cobrança',
    mensagem: '{nome}, seu pagamento de {valor} segue em aberto há {dias} dias. Link: {link}',
    ativo: 1,
  },
  {
    ordem: 4,
    dias_relativo: 15,
    canal: 'ligacao',
    titulo: 'Ligação de renegociação',
    mensagem: 'Ligação para tentativa de renegociação — {nome}, {valor} em aberto há {dias} dias.',
    ativo: 1,
  },
  {
    ordem: 5,
    dias_relativo: 30,
    canal: 'email',
    titulo: 'Aviso final',
    mensagem:
      '{nome}, último aviso: pendência de {valor} ({servico}) há {dias} dias. Regularize: {link}',
    ativo: 0,
  },
  {
    ordem: 6,
    dias_relativo: 45,
    canal: 'nenhum',
    titulo: 'Suspensão programada',
    mensagem: 'Etapa reservada para suspensão de serviço após 45 dias de atraso.',
    ativo: 0,
  },
];

async function hasTable(db, name) {
  try {
    return await db.schema.hasTable(name);
  } catch (_) {
    return false;
  }
}

async function ensureColumn(db, table, column, ddl) {
  try {
    const has = await db.schema.hasColumn(table, column);
    if (!has) await db.raw(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  } catch (_) {}
}

async function ensureReguaTables(db) {
  const hasConfig = await hasTable(db, 'regua_cobranca_config');
  if (!hasConfig) {
    await db.raw(`
      CREATE TABLE regua_cobranca_config (
        id TINYINT UNSIGNED NOT NULL DEFAULT 1,
        automacao_ativa TINYINT(1) NOT NULL DEFAULT 0,
        ultima_execucao_em DATETIME DEFAULT NULL,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_por BIGINT UNSIGNED DEFAULT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await db('regua_cobranca_config').insert({ id: 1, automacao_ativa: 0 });
    console.log('[ReguaCobranca] Tabela regua_cobranca_config criada.');
  }

  const hasEtapas = await hasTable(db, 'regua_cobranca_etapas');
  if (!hasEtapas) {
    await db.raw(`
      CREATE TABLE regua_cobranca_etapas (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        ordem INT NOT NULL DEFAULT 0,
        dias_relativo INT NOT NULL,
        canal ENUM('email','whatsapp','sms','ligacao','nenhum') NOT NULL DEFAULT 'email',
        titulo VARCHAR(255) NOT NULL,
        mensagem TEXT NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_regua_ordem (ordem)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[ReguaCobranca] Tabela regua_cobranca_etapas criada.');
  }

  const count = await db('regua_cobranca_etapas').count({ total: '*' }).first();
  if (parseInt(count?.total || '0', 10) === 0) {
    await db('regua_cobranca_etapas').insert(ETAPAS_PADRAO);
    console.log('[ReguaCobranca] Etapas padrão inseridas.');
  }
}

async function ensureDisparoMassaTable(db) {
  const has = await hasTable(db, 'cobranca_disparos_massa');
  if (has) return;
  await db.raw(`
    CREATE TABLE cobranca_disparos_massa (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      publico_alvo VARCHAR(30) NOT NULL,
      canais JSON NOT NULL,
      modelo VARCHAR(80) DEFAULT NULL,
      mensagem TEXT NOT NULL,
      agendar TINYINT(1) NOT NULL DEFAULT 0,
      agendado_para DATETIME DEFAULT NULL,
      status ENUM('agendado','processando','concluido','erro','cancelado') NOT NULL DEFAULT 'processando',
      total_destinatarios INT NOT NULL DEFAULT 0,
      total_enviados INT NOT NULL DEFAULT 0,
      total_erros INT NOT NULL DEFAULT 0,
      criado_por BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      concluido_em DATETIME DEFAULT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[ReguaCobranca] Tabela cobranca_disparos_massa criada.');
}

async function ensureCobrancaHistoricoColumns(db) {
  if (!(await hasTable(db, 'cobrancas_taxa_sicaf'))) return;
  await ensureColumn(db, 'cobrancas_taxa_sicaf', 'canal', "canal VARCHAR(20) DEFAULT 'email' AFTER email_destino");
  await ensureColumn(db, 'cobrancas_taxa_sicaf', 'mensagem', 'mensagem TEXT DEFAULT NULL AFTER canal');
  await ensureColumn(db, 'cobrancas_taxa_sicaf', 'modelo', 'modelo VARCHAR(80) DEFAULT NULL AFTER mensagem');
  await ensureColumn(db, 'cobrancas_taxa_sicaf', 'disparo_massa_id', 'disparo_massa_id BIGINT UNSIGNED DEFAULT NULL AFTER modelo');
  await ensureColumn(db, 'cobrancas_taxa_sicaf', 'regua_etapa_id', 'regua_etapa_id BIGINT UNSIGNED DEFAULT NULL AFTER disparo_massa_id');
}

function mapEtapaRow(row) {
  return {
    id: row.id,
    ordem: row.ordem,
    diasRelativo: row.dias_relativo,
    diasLabel:
      row.dias_relativo < 0
        ? `${Math.abs(row.dias_relativo)}d antes`
        : row.dias_relativo === 0
          ? 'No vencimento'
          : `${row.dias_relativo}d após`,
    canal: row.canal,
    titulo: row.titulo,
    mensagem: row.mensagem,
    ativo: !!row.ativo,
  };
}

async function getReguaCobranca() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureReguaTables(db);

  const config = (await db('regua_cobranca_config').where('id', 1).first()) || {
    automacao_ativa: 0,
    ultima_execucao_em: null,
  };

  const etapas = await db('regua_cobranca_etapas').orderBy('ordem', 'asc');
  const mapped = etapas.map(mapEtapaRow);
  const ativas = mapped.filter((e) => e.ativo).length;

  return {
    ok: true,
    automacaoAtiva: !!config.automacao_ativa,
    ultimaExecucaoEm: config.ultima_execucao_em,
    etapas: mapped,
    resumo: {
      total: mapped.length,
      ativas,
    },
  };
}

async function saveReguaCobranca({ automacaoAtiva, etapas, usuarioId }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureReguaTables(db);

  await db('regua_cobranca_config')
    .where('id', 1)
    .update({
      automacao_ativa: automacaoAtiva ? 1 : 0,
      updated_por: usuarioId || null,
      updated_at: new Date(),
    });

  const incoming = Array.isArray(etapas) ? etapas : [];
  const existingIds = new Set();

  for (let i = 0; i < incoming.length; i += 1) {
    const e = incoming[i];
    const canal = CANAIS_VALIDOS.has(String(e.canal || '').toLowerCase())
      ? String(e.canal).toLowerCase()
      : 'email';
    const payload = {
      ordem: i + 1,
      dias_relativo: parseInt(e.diasRelativo ?? e.dias_relativo, 10) || 0,
      canal,
      titulo: String(e.titulo || `Etapa ${i + 1}`).slice(0, 255),
      mensagem: String(e.mensagem || '').slice(0, 5000),
      ativo: e.ativo === false || e.ativo === 0 ? 0 : 1,
      updated_at: new Date(),
    };

    const id = parseInt(e.id, 10);
    if (Number.isFinite(id) && id > 0) {
      await db('regua_cobranca_etapas').where('id', id).update(payload);
      existingIds.add(id);
    } else {
      const [newId] = await db('regua_cobranca_etapas').insert({
        ...payload,
        created_at: new Date(),
      });
      existingIds.add(newId);
    }
  }

  const allRows = await db('regua_cobranca_etapas').select('id');
  const toDelete = allRows.map((r) => r.id).filter((id) => !existingIds.has(id));
  if (toDelete.length) {
    await db('regua_cobranca_etapas').whereIn('id', toDelete).delete();
  }

  return getReguaCobranca();
}

module.exports = {
  ensureReguaTables,
  ensureDisparoMassaTable,
  ensureCobrancaHistoricoColumns,
  getReguaCobranca,
  saveReguaCobranca,
  ETAPAS_PADRAO,
};
