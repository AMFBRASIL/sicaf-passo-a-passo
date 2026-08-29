/**
 * Agenda boletim diário de licitações segmentadas por cliente — padrão 06:00.
 */
const { getDb } = require('../database/connection');
const processosService = require('./processos.service');
const { runBoletimLicitacoes } = require('./licitacoes-boletim.service');

const LOG_PREFIX = '[Cron:BoletimLicitacoes]';

let _timer = null;
let _running = false;
let _runCount = 0;
let _lastRun = null;
const _lastSlotKeys = new Map();

function log(msg, extra) {
  const ts = new Date().toISOString();
  if (extra !== undefined) console.log(`${LOG_PREFIX} ${ts} — ${msg}`, extra);
  else console.log(`${LOG_PREFIX} ${ts} — ${msg}`);
}

function parseSchedule() {
  const raw = process.env.CRON_LICITACOES_BOLETIM_SCHEDULE || '06:00';
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const slotIds = ['manha', 'tarde', 'noite', 'extra'];
  const slotLabels = ['Manhã', 'Tarde', 'Noite', 'Extra'];
  return parts.map((part, i) => {
    const [h, m] = part.split(':').map((n) => parseInt(n, 10));
    return {
      id: slotIds[i] || `slot-${i}`,
      label: slotLabels[i] || `Horário ${i + 1}`,
      hour: Number.isFinite(h) ? h : 6,
      minute: Number.isFinite(m) ? m : 0,
    };
  });
}

function isEnabled() {
  return (process.env.CRON_LICITACOES_BOLETIM_ENABLED || 'true').toLowerCase() !== 'false';
}

function slotKeyForNow(schedule, date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${schedule.id}`;
}

function getCurrentMinuteSlot(schedules) {
  const now = new Date();
  return schedules.find((s) => s.hour === now.getHours() && s.minute === now.getMinutes()) || null;
}

function slimResult(result) {
  if (!result) return result;
  return {
    ...result,
    envios: (result.envios || []).slice(0, 80).map((e) => ({
      ...e,
      itens: (e.itens || []).slice(0, 8),
    })),
  };
}

async function runSync(triggerType = 'cron', scheduleSlot = null) {
  if (_running) {
    return { ok: false, error: 'Boletim de licitações já em execução' };
  }

  const db = getDb();
  if (!db) {
    return { ok: false, error: 'Banco de dados não disponível' };
  }

  _running = true;
  _runCount += 1;
  const startedAt = new Date();
  let execId = null;

  try {
    execId = await processosService.startExecution(
      db,
      processosService.PROCESSO_LICITACOES_BOLETIM,
      triggerType,
      scheduleSlot,
    );
    log(`Iniciando boletim (${triggerType}${scheduleSlot ? ` / ${scheduleSlot}` : ''})`);

    const result = await runBoletimLicitacoes({
      log: (msg) => log(msg),
      processoExecId: execId,
    });

    if (!result.ok) {
      await processosService.finishExecution(db, execId, 'error', result.error, result);
      _lastRun = { startedAt, finishedAt: new Date(), error: result.error, triggerType, scheduleSlot };
      log('Erro no boletim', result.error);
      return result;
    }

    await processosService.finishExecution(db, execId, 'success', result.message, slimResult(result));
    _lastRun = { startedAt, finishedAt: new Date(), result, triggerType, scheduleSlot };
    log('Boletim concluído', { emailsEnviados: result.emailsEnviados });
    return result;
  } catch (e) {
    if (execId) {
      await processosService.finishExecution(db, execId, 'error', e.message, null).catch(() => {});
    }
    _lastRun = { startedAt, finishedAt: new Date(), error: e.message, triggerType, scheduleSlot };
    log('Exceção', e.message);
    return { ok: false, error: e.message };
  } finally {
    _running = false;
  }
}

function tick() {
  if (!isEnabled()) return;
  const schedules = parseSchedule();
  const slot = getCurrentMinuteSlot(schedules);
  if (!slot) return;
  const key = slotKeyForNow(slot);
  if (_lastSlotKeys.get(slot.id) === key) return;
  _lastSlotKeys.set(slot.id, key);
  runSync('cron', slot.id).catch((err) => log('Erro no tick', err.message));
}

function start() {
  if (!isEnabled()) {
    log('Desativado (CRON_LICITACOES_BOLETIM_ENABLED=false)');
    return;
  }
  const schedules = parseSchedule();
  const scheduleStr = schedules
    .map((s) => `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} (${s.label})`)
    .join(', ');
  log(`Iniciado — horários: ${scheduleStr}`);
  _timer = setInterval(tick, 60 * 1000);
  setTimeout(tick, 10000);
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    log('Parado');
  }
}

function getStatus() {
  return {
    running: _running,
    runCount: _runCount,
    lastRun: _lastRun,
    timerActive: !!_timer,
    schedules: parseSchedule(),
    enabled: isEnabled(),
  };
}

module.exports = {
  start,
  stop,
  runSync,
  getStatus,
  parseSchedule,
};
