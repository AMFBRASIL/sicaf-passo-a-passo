/**
 * Configurações SICAF — configuracoes_sistema (níveis, automações, valores, central de alertas).
 */
const { getDb } = require('../database/connection');

const NIVEL_KEYS = [
  'sicaf_nivel_1_obrigatorio',
  'sicaf_nivel_2_obrigatorio',
  'sicaf_nivel_3_obrigatorio',
  'sicaf_nivel_4_obrigatorio',
  'sicaf_nivel_5_obrigatorio',
  'sicaf_nivel_6_obrigatorio',
];

const MONEY_KEYS = [
  'valor_cadastro_sicaf',
  'valor_cadastro_sicaf_imediato',
  'valor_manutencao_mensal',
  'valor_manutencao_anual',
];

const SICAF_CONFIG_KEYS = [
  ...NIVEL_KEYS,
  'sicaf_aviso_antecedencia_dias',
  'sicaf_lembrete_reenvio_dias',
  'sicaf_central_alerta_certidoes_dias',
  'sicaf_ticket_automatico',
  'sicaf_notificar_email_whatsapp',
  'sicaf_bloquear_relatorio_vencido',
  ...MONEY_KEYS,
];

const DEFAULTS = {
  sicaf_nivel_1_obrigatorio: 'true',
  sicaf_nivel_2_obrigatorio: 'true',
  sicaf_nivel_3_obrigatorio: 'true',
  sicaf_nivel_4_obrigatorio: 'true',
  sicaf_nivel_5_obrigatorio: 'false',
  sicaf_nivel_6_obrigatorio: 'false',
  sicaf_aviso_antecedencia_dias: '30',
  sicaf_lembrete_reenvio_dias: '7',
  sicaf_central_alerta_certidoes_dias: '30',
  sicaf_ticket_automatico: 'true',
  sicaf_notificar_email_whatsapp: 'true',
  sicaf_bloquear_relatorio_vencido: 'false',
  valor_cadastro_sicaf: '985',
  valor_cadastro_sicaf_imediato: '1480',
  valor_manutencao_mensal: '155',
  valor_manutencao_anual: '1860',
};

let cache = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

function parseBool(val, fallback = false) {
  if (val === undefined || val === null || String(val).trim() === '') return fallback;
  const s = String(val).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'sim' || s === 'yes';
}

function parseIntConfig(val, fallback) {
  const n = parseInt(String(val ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseMoney(val, fallback) {
  if (val === undefined || val === null || String(val).trim() === '') return fallback;
  let s = String(val).trim().replace(/R\$\s?/gi, '').replace(/\s/g, '');
  if (!s) return fallback;
  // pt-BR: 1.480,00 → 1480.00 | 155,00 → 155.00 | 1480 → 1480
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

function moneyToString(val, fallback) {
  const n = parseMoney(val, fallback);
  return String(n);
}

function rawToSettings(raw) {
  const merged = { ...DEFAULTS, ...raw };
  const niveisObrigatorios = NIVEL_KEYS.map((k) => parseBool(merged[k], parseBool(DEFAULTS[k])));
  const valorCadastroSicaf = parseMoney(merged.valor_cadastro_sicaf, 985);
  const valorCadastroSicafImediato = parseMoney(merged.valor_cadastro_sicaf_imediato, 1480);
  const valorManutencaoMensal = parseMoney(merged.valor_manutencao_mensal, 155);
  const anualFromMensal = Math.round(valorManutencaoMensal * 12 * 100) / 100;
  const valorManutencaoAnual = parseMoney(merged.valor_manutencao_anual, anualFromMensal);
  return {
    niveisObrigatorios,
    avisoAntecedenciaDias: parseIntConfig(merged.sicaf_aviso_antecedencia_dias, 30),
    lembreteReenvioDias: parseIntConfig(merged.sicaf_lembrete_reenvio_dias, 7),
    centralAlertaCertidoesDias: parseIntConfig(merged.sicaf_central_alerta_certidoes_dias, 30),
    ticketAutomatico: parseBool(merged.sicaf_ticket_automatico, true),
    notificarEmailWhatsapp: parseBool(merged.sicaf_notificar_email_whatsapp, true),
    bloquearRelatorioVencido: parseBool(merged.sicaf_bloquear_relatorio_vencido, false),
    valorCadastroSicaf,
    valorCadastroSicafImediato,
    valorManutencaoMensal,
    valorManutencaoAnual,
  };
}

function settingsToRaw(settings) {
  const out = {};
  for (let i = 0; i < 6; i++) {
    out[NIVEL_KEYS[i]] = settings.niveisObrigatorios?.[i] ? 'true' : 'false';
  }
  out.sicaf_aviso_antecedencia_dias = String(settings.avisoAntecedenciaDias ?? 30);
  out.sicaf_lembrete_reenvio_dias = String(settings.lembreteReenvioDias ?? 7);
  out.sicaf_central_alerta_certidoes_dias = String(settings.centralAlertaCertidoesDias ?? 30);
  out.sicaf_ticket_automatico = settings.ticketAutomatico ? 'true' : 'false';
  out.sicaf_notificar_email_whatsapp = settings.notificarEmailWhatsapp ? 'true' : 'false';
  out.sicaf_bloquear_relatorio_vencido = settings.bloquearRelatorioVencido ? 'true' : 'false';
  out.valor_cadastro_sicaf = moneyToString(settings.valorCadastroSicaf, 985);
  out.valor_cadastro_sicaf_imediato = moneyToString(settings.valorCadastroSicafImediato, 1480);

  const mensal = parseMoney(settings.valorManutencaoMensal, 155);
  const anualInformado = parseMoney(settings.valorManutencaoAnual, Math.round(mensal * 12 * 100) / 100);
  // Mantém o anual digitado; mensal é referência para boletos (anual/12).
  out.valor_manutencao_anual = moneyToString(anualInformado, 1860);
  out.valor_manutencao_mensal = moneyToString(mensal, 155);
  return out;
}

async function upsertConfigRow(db, chave, valor, descricao) {
  const exists = await db('configuracoes_sistema').where('chave', chave).first();
  if (exists) {
    await db('configuracoes_sistema').where('chave', chave).update({
      valor,
      updated_at: db.fn.now(),
    });
  } else {
    await db('configuracoes_sistema').insert({
      chave,
      valor,
      // ENUM real: empresa|licitacoes|integracoes|...|pagamentos|armazenamento (sem "financeiro")
      categoria: MONEY_KEYS.includes(chave) ? 'licitacoes' : 'integracoes',
      descricao: descricao || '',
      tipo_valor: MONEY_KEYS.includes(chave) ? 'number' : 'string',
    });
  }
}

/** Mantém planos.preco alinhado aos valores de configuração (tela de pagamento). */
async function syncPlanosPrecos(db, settings) {
  try {
    const hasPlanos = await db.schema.hasTable('planos');
    if (!hasPlanos) return;

    const pairs = [
      { codigo: 'sicaf_padrao', preco: parseMoney(settings.valorCadastroSicaf, 985) },
      { codigo: 'sicaf_imediato', preco: parseMoney(settings.valorCadastroSicafImediato, 1480) },
    ];

    for (const p of pairs) {
      const row = await db('planos').where('codigo', p.codigo).first();
      if (row) {
        try {
          await db('planos').where('id', row.id).update({
            preco: p.preco,
            updated_at: db.fn.now(),
          });
        } catch (_) {
          await db('planos').where('id', row.id).update({ preco: p.preco });
        }
      }
    }
  } catch (e) {
    console.warn('[SICAF Config] syncPlanosPrecos:', e.message);
  }
}

async function loadSicafRawFromDb() {
  const db = getDb();
  if (!db) return { ...DEFAULTS };

  const rows = await db('configuracoes_sistema').whereIn('chave', SICAF_CONFIG_KEYS);
  const raw = { ...DEFAULTS };
  for (const row of rows) {
    if (row.chave && row.valor != null) raw[row.chave] = String(row.valor);
  }
  return raw;
}

async function getSicafSettingsResolved() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;

  const raw = await loadSicafRawFromDb();
  cache = rawToSettings(raw);
  cacheAt = now;
  return cache;
}

function invalidateSicafConfigCache() {
  cache = null;
  cacheAt = 0;
}

async function getSicafSettings() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const settings = await getSicafSettingsResolved();
  const niveisAtivos = settings.niveisObrigatorios.filter(Boolean).length;

  return {
    ok: true,
    settings,
    status: {
      niveisAtivos,
      centralAlertaDias: settings.centralAlertaCertidoesDias,
      avisoAntecedenciaDias: settings.avisoAntecedenciaDias,
      valorCadastroSicaf: settings.valorCadastroSicaf,
      valorManutencaoAnual: settings.valorManutencaoAnual,
    },
  };
}

const MONEY_DESCRIPTIONS = {
  valor_cadastro_sicaf: 'Valor padrão da taxa de cadastro SICAF (anual)',
  valor_cadastro_sicaf_imediato: 'Valor da taxa SICAF com atendimento imediato',
  valor_manutencao_mensal: 'Valor mensal da manutenção SICAF',
  valor_manutencao_anual: 'Valor anual integral da manutenção SICAF',
};

async function updateSicafSettings(payload) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Configurações inválidas' };
  }

  const updates = settingsToRaw(payload);
  let updatedCount = 0;

  for (const chave of SICAF_CONFIG_KEYS) {
    if (updates[chave] === undefined) continue;
    const valor = String(updates[chave]);
    await upsertConfigRow(db, chave, valor, MONEY_DESCRIPTIONS[chave] || '');
    updatedCount++;
  }

  const resolvedForSync = rawToSettings({ ...DEFAULTS, ...updates });
  await syncPlanosPrecos(db, resolvedForSync);

  try {
    const sicafTaxa = require('./sicaf-taxa.service');
    await sicafTaxa.syncValoresTaxasPendentes();
  } catch (e) {
    console.warn('[SICAF Config] syncValoresTaxasPendentes:', e.message);
  }

  invalidateSicafConfigCache();
  return {
    ok: true,
    updated: updatedCount,
    message: 'Configurações SICAF salvas com sucesso',
  };
}

/** Dias para classificar certidão como "vencendo" no checklist. */
async function getDiasAvisoAntecedencia() {
  const cfg = await getSicafSettingsResolved();
  return cfg.avisoAntecedenciaDias;
}

/** Janela (dias) para exibir alertas de certidões na central do cliente. */
async function getDiasCentralAlertaCertidoes() {
  const cfg = await getSicafSettingsResolved();
  return cfg.centralAlertaCertidoesDias;
}

function diasAteVencimento(dataValidade) {
  if (!dataValidade) return null;
  const d = new Date(dataValidade);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));
}

/** Certidão deve aparecer na central de alertas do cliente (vencida ou vencendo dentro da janela). */
function certidaoVisivelCentralAlerta(status, dataValidade, diasCentral) {
  const st = String(status || '').toLowerCase();
  if (st === 'vencida') return true;
  if (st !== 'vencendo' && st !== 'ok') return false;
  const dias = diasAteVencimento(dataValidade);
  if (dias === null) return st === 'vencendo';
  if (dias < 0) return true;
  return dias <= diasCentral;
}

module.exports = {
  SICAF_CONFIG_KEYS,
  MONEY_KEYS,
  DEFAULTS,
  getSicafSettings,
  updateSicafSettings,
  getDiasAvisoAntecedencia,
  getDiasCentralAlertaCertidoes,
  certidaoVisivelCentralAlerta,
  diasAteVencimento,
  invalidateSicafConfigCache,
};
