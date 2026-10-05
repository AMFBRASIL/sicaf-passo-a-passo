/**
 * Processa a fila de campanhas de captação (Admin → Serviços) em lotes e dispara as rotinas vencidas.
 * CAPTACAO_INTERVALO_SEG (padrão 20) e CAPTACAO_LOTE (padrão 30) controlam o ritmo.
 * A cópia da base de fornecedores é refeita uma vez por dia (verificada a cada hora).
 * Fora de produção fica desligado por padrão (o banco é compartilhado) — veja filaHabilitada().
 */
const {
  processarFila,
  atualizarBaseFornecedoresSeVencida,
  filaHabilitada,
} = require('./servicos-captacao.service');

const LOG_PREFIX = '[Cron:Captacao]';

let _timer = null;
let _timerForn = null;

function tick() {
  processarFila().catch((e) => console.error(`${LOG_PREFIX} Erro no tick:`, e.message));
}

function tickFornecedores() {
  atualizarBaseFornecedoresSeVencida().catch((e) =>
    console.error(`${LOG_PREFIX} Erro ao atualizar fornecedores:`, e.message),
  );
}

function start() {
  if (!filaHabilitada()) {
    console.log(`${LOG_PREFIX} Desativado neste ambiente (só roda em produção ou com CRON_CAPTACAO_ENABLED=true)`);
    return;
  }
  if (_timer) return;
  const seg = Math.max(5, parseInt(process.env.CAPTACAO_INTERVALO_SEG || '20', 10) || 20);
  _timer = setInterval(tick, seg * 1000);
  _timerForn = setInterval(tickFornecedores, 3600 * 1000);
  setTimeout(tick, 15000);
  setTimeout(tickFornecedores, 60000);
  console.log(`${LOG_PREFIX} Iniciado — a cada ${seg}s`);
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  if (_timerForn) {
    clearInterval(_timerForn);
    _timerForn = null;
  }
}

module.exports = { start, stop, tick };
