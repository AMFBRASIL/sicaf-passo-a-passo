/**
 * Cota de atualizações gratuitas SICAF — conta envios da Situação do Fornecedor
 * pelo Assistente (manutencao_uso_log). Upload manual não consome cota.
 */
const { getDb } = require('../database/connection');
const { isSicafDisplayValid } = require('../utils/sicaf-status');

const COUNTABLE_WHERE = (qb) => {
  qb.where('tipo', 'situacao_fornecedor')
    .where('origem', 'assistente')
    .whereNotIn('plano_status', ['pendente', 'anulado_admin']);
};

async function hasTaxaSicafPaga(db, sicaf, clienteId) {
  if (!sicaf?.id || !clienteId) return false;

  try {
    const paidTax = await db('taxas_sicaf')
      .where({ sicaf_id: sicaf.id, cliente_id: clienteId })
      .where(function () {
        this.whereIn('status', [
          'Pago', 'Paga', 'Aprovado', 'Aprovada', 'Liberado', 'Liberada',
          'pago', 'paga', 'aprovado', 'aprovada', 'liberado', 'liberada',
        ]).orWhereRaw(
          "LOWER(TRIM(CAST(status AS CHAR))) IN ('pago','paga','aprovado','aprovada','liberado','liberada','paid')",
        );
      })
      .first();
    if (paidTax) return true;
  } catch (_) {}

  try {
    const hasPg = await db.schema.hasTable('pagamentos');
    if (hasPg) {
      const pg = await db('pagamentos')
        .where({ cliente_id: clienteId, origem: 'sicaf' })
        .where(function () {
          this.whereIn('status', ['Pago', 'pago', 'Aprovado', 'aprovado', 'paid'])
            .orWhereRaw("LOWER(TRIM(CAST(status AS CHAR))) IN ('pago','aprovado','paid')");
        })
        .whereNotNull('data_pagamento')
        .first();
      if (pg) return true;
    }
  } catch (_) {}

  try {
    const hasGn = await db.schema.hasTable('pagamentos_gerencianet');
    if (hasGn) {
      const pg = await db('pagamentos_gerencianet')
        .where({ cliente_id: clienteId, origem: 'sicaf' })
        .where(function () {
          this.whereIn('status', ['Pago', 'pago', 'Aprovado', 'aprovado', 'paid'])
            .orWhereRaw("LOWER(TRIM(CAST(status AS CHAR))) IN ('pago','aprovado','paid')");
        })
        .whereNotNull('data_pagamento')
        .first();
      if (pg) return true;
    }
  } catch (_) {}

  return false;
}

async function hasPaidActiveAnnualSicaf(db, sicaf, clienteId) {
  if (!sicaf) return false;
  if (isSicafDisplayValid(sicaf.status, sicaf.data_validade, true)) return true;
  if (await hasTaxaSicafPaga(db, sicaf, clienteId)) return true;
  return false;
}

async function getLimiteAtualizacoesGratuitas(db) {
  let limite = 3;
  try {
    const cfg = await db('configuracoes_sistema').where('chave', 'limite_atualizacoes_gratuitas').first();
    if (cfg) limite = parseInt(cfg.valor, 10) || 3;
  } catch (_) {}
  return limite;
}

async function ensureBonusColumn(db) {
  try {
    const [cols] = await db.raw(
      "SHOW COLUMNS FROM sicaf_cadastros LIKE 'bonus_atualizacoes_gratuitas'",
    );
    if (!cols || cols.length === 0) {
      await db.raw(
        'ALTER TABLE sicaf_cadastros ADD COLUMN bonus_atualizacoes_gratuitas INT NOT NULL DEFAULT 0',
      );
    }
  } catch (_) {}
}

async function getBonusAtualizacoes(db, clienteId) {
  await ensureBonusColumn(db);
  try {
    const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
    return parseInt(sicaf?.bonus_atualizacoes_gratuitas, 10) || 0;
  } catch (_) {
    return 0;
  }
}

async function setBonusAtualizacoes(db, clienteId, bonus) {
  await ensureBonusColumn(db);
  const value = Math.max(0, parseInt(bonus, 10) || 0);
  await db('sicaf_cadastros').where('cliente_id', clienteId).update({
    bonus_atualizacoes_gratuitas: value,
    updated_at: db.fn.now(),
  });
  return value;
}

async function countAtualizacoesSituacaoAssistente(db, clienteId) {
  if (!db || !clienteId) return 0;

  try {
    const has = await db.schema.hasTable('manutencao_uso_log');
    if (has) {
      const row = await db('manutencao_uso_log')
        .where('cliente_id', clienteId)
        .modify(COUNTABLE_WHERE)
        .count({ total: '*' })
        .first();
      const total = row?.total ?? row?.['count(*)'];
      if (total != null) return Number(total) || 0;
    }
  } catch (e) {
    console.error('[AtualizacoesSicaf] Erro ao contar log:', e.message);
  }

  try {
    const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
    return sicaf?.atualizacoes_usadas || 0;
  } catch (_) {
    return 0;
  }
}

async function anularRegistrosUso(db, clienteId, quantidade, observacao) {
  if (!quantidade || quantidade <= 0) return 0;

  const has = await db.schema.hasTable('manutencao_uso_log');
  if (!has) return 0;

  const rows = await db('manutencao_uso_log')
    .where('cliente_id', clienteId)
    .modify(COUNTABLE_WHERE)
    .orderBy('created_at', 'asc')
    .limit(quantidade)
    .select('id');

  const ids = rows.map((r) => r.id).filter(Boolean);
  if (!ids.length) return 0;

  await db('manutencao_uso_log')
    .whereIn('id', ids)
    .update({
      plano_status: 'anulado_admin',
      observacao: String(observacao || 'Anulado pelo admin').substring(0, 255),
    });

  return ids.length;
}

async function anularTodosRegistrosUso(db, clienteId, observacao) {
  const has = await db.schema.hasTable('manutencao_uso_log');
  if (!has) return 0;

  const row = await db('manutencao_uso_log')
    .where('cliente_id', clienteId)
    .modify(COUNTABLE_WHERE)
    .count({ total: '*' })
    .first();
  const total = Number(row?.total ?? row?.['count(*)'] ?? 0) || 0;
  if (!total) return 0;

  await db('manutencao_uso_log')
    .where('cliente_id', clienteId)
    .modify(COUNTABLE_WHERE)
    .update({
      plano_status: 'anulado_admin',
      observacao: String(observacao || 'Anulado pelo admin').substring(0, 255),
    });

  return total;
}

/**
 * @param {object} opts
 * @param {boolean} opts.contadorAtivo
 * @param {boolean} opts.manutencaoAtiva
 * @param {string|null} opts.resetEm
 */
async function buildAtualizacoesStatus(db, clienteId, opts) {
  const limite = await getLimiteAtualizacoesGratuitas(db);
  const bonus = await getBonusAtualizacoes(db, clienteId);
  const limiteEfetivo = limite + bonus;
  const { contadorAtivo, manutencaoAtiva, resetEm, semSicaf } = opts;
  const usadas = contadorAtivo ? await countAtualizacoesSituacaoAssistente(db, clienteId) : 0;
  const restantes = Math.max(0, limiteEfetivo - usadas);

  return {
    usadas,
    limite,
    bonus,
    limiteEfetivo,
    restantes,
    restantesGratuitas: restantes,
    manutencaoAtiva: !!manutencaoAtiva,
    contadorAtivo: !!contadorAtivo,
    bloqueado: !!contadorAtivo && !manutencaoAtiva && usadas >= limiteEfetivo,
    resetEm: resetEm || null,
    semSicaf: !!semSicaf,
    origemContagem: 'assistente_situacao_fornecedor',
  };
}

async function loadClienteAtualizacoesContext(db, clienteId) {
  const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
  let manutencaoAtiva = !!sicaf?.manutencao_ativa;
  if (!manutencaoAtiva) {
    try {
      const m = await db('manutencoes')
        .where('cliente_id', clienteId)
        .whereIn('status', ['Ativo', 'ativo', 'Ativa', 'ativa'])
        .first();
      manutencaoAtiva = !!m;
    } catch (_) {}
  }

  const contadorAtivo = sicaf
    ? await hasPaidActiveAnnualSicaf(db, sicaf, clienteId)
    : false;

  return {
    sicaf,
    manutencaoAtiva,
    contadorAtivo,
    status: await buildAtualizacoesStatus(db, clienteId, {
      contadorAtivo,
      manutencaoAtiva,
      resetEm: sicaf?.atualizacoes_reset_em || null,
      semSicaf: !sicaf,
    }),
  };
}

async function registrarHistoricoAdmin(db, clienteId, usuarioId, descricao) {
  try {
    if (await db.schema.hasTable('auditoria_log')) {
      await db('auditoria_log').insert({
        usuario_id: usuarioId || null,
        cliente_id: clienteId,
        acao: 'CUSTOM:ajuste_cota_gratuita',
        descricao: String(descricao).substring(0, 500),
        entidade: 'manutencao_uso_log',
        entidade_id: clienteId,
        created_at: db.fn.now(),
      });
      return;
    }
  } catch (_) {}

  try {
    if (await db.schema.hasTable('historico_acoes')) {
      await db('historico_acoes').insert({
        cliente_id: clienteId,
        usuario_id: usuarioId || null,
        acao: String(descricao).substring(0, 500),
        entidade: 'manutencao_uso_log',
        entidade_id: clienteId,
        created_at: db.fn.now(),
      });
    }
  } catch (_) {}
}

/**
 * Define quantas utilizações gratuitas o cliente deve ter disponíveis agora.
 * Ex.: usou 3/3 → disponiveis=3 restaura; disponiveis=4 concede 1 extra.
 */
async function ajustarDisponiveisGratuitas(clienteId, usuarioId, disponiveis, motivo) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco indisponível' };

  const alvo = parseInt(disponiveis, 10);
  if (!Number.isFinite(alvo) || alvo < 0 || alvo > 20) {
    return { ok: false, error: 'Informe entre 0 e 20 utilizações disponíveis' };
  }

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  const ctx = await loadClienteAtualizacoesContext(db, clienteId);
  if (!ctx.sicaf) return { ok: false, error: 'Cliente sem cadastro SICAF' };
  if (ctx.status.manutencaoAtiva) {
    return {
      ok: false,
      error: 'Cliente com manutenção mensal ativa — cota gratuita não se aplica',
    };
  }

  const { limite, usadas } = ctx.status;
  const obs = motivo
    ? `Anulado admin #${usuarioId || 'sistema'}: ${motivo}`
    : `Anulado admin #${usuarioId || 'sistema'}`;

  let anulados = 0;
  let bonus = 0;

  if (alvo <= limite) {
    const targetUsadas = Math.max(0, limite - alvo);
    anulados = await anularRegistrosUso(db, clienteId, usadas - targetUsadas, obs);
    bonus = await setBonusAtualizacoes(db, clienteId, 0);
  } else {
    anulados = await anularTodosRegistrosUso(db, clienteId, obs);
    bonus = await setBonusAtualizacoes(db, clienteId, alvo - limite);
  }

  const depois = await loadClienteAtualizacoesContext(db, clienteId);
  const msg =
    `Cota gratuita ajustada: ${ctx.status.restantes} → ${depois.status.restantes} disponíveis ` +
    `(usadas ${ctx.status.usadas}→${depois.status.usadas}, bônus ${ctx.status.bonus}→${bonus}` +
    `${anulados ? `, ${anulados} uso(s) anulado(s)` : ''})`;

  await registrarHistoricoAdmin(db, clienteId, usuarioId, msg);

  return {
    ok: true,
    message: msg,
    antes: ctx.status,
    depois: depois.status,
    anulados,
  };
}

async function getAdminAtualizacoesGratuitas(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco indisponível' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  const ctx = await loadClienteAtualizacoesContext(db, clienteId);
  return {
    ok: true,
    clienteId,
    razaoSocial: cliente.razao_social || cliente.nome_fantasia || cliente.nome || '',
    ...ctx.status,
  };
}

module.exports = {
  hasPaidActiveAnnualSicaf,
  getLimiteAtualizacoesGratuitas,
  countAtualizacoesSituacaoAssistente,
  buildAtualizacoesStatus,
  getAdminAtualizacoesGratuitas,
  ajustarDisponiveisGratuitas,
};
