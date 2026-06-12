/**
 * Registro e histórico de processos automáticos (cron jobs do sistema).
 */
const { getDb } = require('../database/connection');

const PROCESSO_GOOGLE_ADS = 'google-ads-conversoes';

const DEFAULT_SCHEDULES = [
  { id: 'manha', label: 'Manhã', hour: 8, minute: 0 },
  { id: 'tarde', label: 'Tarde', hour: 18, minute: 0 },
];

function parseScheduleEnv() {
  const raw = process.env.CRON_GOOGLE_ADS_CONVERSOES_SCHEDULE || '08:00,18:00';
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const slotIds = ['manha', 'tarde', 'noite', 'extra'];
  const slotLabels = ['Manhã', 'Tarde', 'Noite', 'Extra'];
  return parts.map((part, i) => {
    const [h, m] = part.split(':').map((n) => parseInt(n, 10));
    return {
      id: slotIds[i] || `slot-${i}`,
      label: slotLabels[i] || `Horário ${i + 1}`,
      hour: Number.isFinite(h) ? h : 8,
      minute: Number.isFinite(m) ? m : 0,
    };
  });
}

async function ensureExecucoesTable(db) {
  const exists = await db.schema.hasTable('processos_execucoes');
  if (exists) return;

  await db.raw(`
    CREATE TABLE processos_execucoes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      processo_id VARCHAR(64) NOT NULL,
      trigger_type ENUM('cron','manual') NOT NULL DEFAULT 'cron',
      schedule_slot VARCHAR(32) NULL COMMENT 'manha, tarde, noite',
      status ENUM('running','success','error') NOT NULL,
      started_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      message TEXT NULL,
      details JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_proc_exec_processo (processo_id, started_at),
      INDEX idx_proc_exec_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function startExecution(db, processoId, triggerType, scheduleSlot = null) {
  await ensureExecucoesTable(db);
  const [id] = await db('processos_execucoes').insert({
    processo_id: processoId,
    trigger_type: triggerType,
    schedule_slot: scheduleSlot,
    status: 'running',
    started_at: db.fn.now(),
  });
  return id;
}

async function finishExecution(db, execId, status, message, details = null) {
  await db('processos_execucoes').where('id', execId).update({
    status,
    finished_at: db.fn.now(),
    message: message ? String(message).slice(0, 2000) : null,
    details: details ? JSON.stringify(details) : null,
  });
}

async function getLastExecutions(db, processoId, limit = 10) {
  await ensureExecucoesTable(db);
  const rows = await db('processos_execucoes')
    .where('processo_id', processoId)
    .orderBy('started_at', 'desc')
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    triggerType: r.trigger_type,
    scheduleSlot: r.schedule_slot,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    message: r.message,
    details: r.details ? (typeof r.details === 'string' ? JSON.parse(r.details) : r.details) : null,
  }));
}

function getProcessDefinitions() {
  const enabled = (process.env.CRON_GOOGLE_ADS_CONVERSOES_ENABLED || 'true').toLowerCase() !== 'false';
  const schedules = parseScheduleEnv();

  return [
    {
      id: PROCESSO_GOOGLE_ADS,
      name: 'Sync Google Ads Conversões',
      description:
        'Insere apenas conversões novas em google_ads_conversoes (clientes com taxa SICAF paga). Não apaga a tabela; um e-mail por cadastro, sem duplicatas.',
      enabled,
      schedules: schedules.length ? schedules : DEFAULT_SCHEDULES,
      npmScript: 'sync:google-ads-conversoes',
    },
  ];
}

async function listProcessos() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const definitions = getProcessDefinitions();
  const googleAdsCron = require('./google-ads-conversoes-cron.service');

  const processos = [];
  for (const def of definitions) {
    const history = await getLastExecutions(db, def.id, 15);
    const cronStatus = def.id === PROCESSO_GOOGLE_ADS ? googleAdsCron.getStatus() : null;
    processos.push({
      ...def,
      cron: cronStatus,
      history,
      lastRun: history[0] || null,
    });
  }

  return { ok: true, processos };
}

module.exports = {
  PROCESSO_GOOGLE_ADS,
  getProcessDefinitions,
  parseScheduleEnv,
  ensureExecucoesTable,
  startExecution,
  finishExecution,
  getLastExecutions,
  listProcessos,
};
