/**
 * Agenda sync google_ads_conversoes — manhã, tarde e noite (horários configuráveis).
 */
const { getDb } = require('../database/connection');
const { runGoogleAdsConversoesSync } = require('./google-ads-conversoes-sync.service');
const processosService = require('./processos.service');

const LOG_PREFIX = '[Cron:GoogleAdsConversoes]';

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

function slotKeyForNow(schedule, date = new Date()) {
  const y = date.getFullYear();
  const mo = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${mo}-${d}-${schedule.id}`;
}

function getCurrentMinuteSlot(schedules) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  return schedules.find((s) => s.hour === h && s.minute === m) || null;
}

async function runSync(triggerType = 'cron', scheduleSlot = null) {
  if (_running) {
    return { ok: false, error: 'Sync já em execução' };
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
    execId = await processosService.startExecution(db, processosService.PROCESSO_GOOGLE_ADS, triggerType, scheduleSlot);
    log(`Iniciando sync (${triggerType}${scheduleSlot ? ` / ${scheduleSlot}` : ''})`);

    const result = await runGoogleAdsConversoesSync({
      db,
      days: 0,
      truncate: false,
      log: (msg) => log(msg),
    });

    if (!result.ok) {
      await processosService.finishExecution(db, execId, 'error', result.error, result);
      _lastRun = { startedAt, finishedAt: new Date(), error: result.error, triggerType, scheduleSlot };
      log('Erro no sync', result.error);
      return result;
    }

    await processosService.finishExecution(db, execId, 'success', result.message, result);
    _lastRun = { startedAt, finishedAt: new Date(), result, triggerType, scheduleSlot };
    log('Sync concluído', { inserted: result.inserted });
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
  const enabled = (process.env.CRON_GOOGLE_ADS_CONVERSOES_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return;

  const schedules = processosService.parseScheduleEnv();
  const slot = getCurrentMinuteSlot(schedules);
  if (!slot) return;

  const key = slotKeyForNow(slot);
  if (_lastSlotKeys.get(slot.id) === key) return;
  _lastSlotKeys.set(slot.id, key);

  runSync('cron', slot.id).catch((err) => log('Erro no tick', err.message));
}

function start() {
  const enabled = (process.env.CRON_GOOGLE_ADS_CONVERSOES_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    log('Desativado (CRON_GOOGLE_ADS_CONVERSOES_ENABLED=false)');
    return;
  }

  const schedules = processosService.parseScheduleEnv();
  const scheduleStr = schedules.map((s) => `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} (${s.label})`).join(', ');
  log(`Iniciado — horários: ${scheduleStr}`);

  if ((process.env.CRON_GOOGLE_ADS_CONVERSOES_RUN_AT_STARTUP || 'false').toLowerCase() === 'true') {
    setTimeout(() => runSync('cron', 'startup').catch((e) => log('Erro startup', e.message)), 20000);
  }

  _timer = setInterval(tick, 60 * 1000);
  setTimeout(tick, 5000);
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
    schedules: processosService.parseScheduleEnv(),
    enabled: (process.env.CRON_GOOGLE_ADS_CONVERSOES_ENABLED || 'true').toLowerCase() !== 'false',
  };
}

module.exports = {
  start,
  stop,
  runSync,
  getStatus,
};
