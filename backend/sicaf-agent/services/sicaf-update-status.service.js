/**
 * Alteração manual do status SICAF — espelha POST /api/sicaf/update-status do legado.
 */
const { getDb } = require('../database/connection');
const emailService = require('./email.service');
const { resolveSicafDisplayStatus, calcDaysRemaining } = require('../utils/sicaf-status');

const VALID_STATUSES = ['Ativo', 'Vencendo', 'Vencido', 'Pendente', 'Cancelado', 'Suspenso'];
const STATUS_COM_EMAIL = ['Vencido', 'Vencendo', 'Pendente', 'Suspenso', 'Cancelado'];
/** Status que exigem data de pagamento + motivo (ativa vigência e financeiro). */
const STATUS_COM_DATA_PAGAMENTO = ['Ativo', 'Vencendo'];
const TEMPLATE_CANCELAMENTO_FALLBACK_ID = 21;
const TEMPLATE_ALERTA_FALLBACK_ID = 24;

async function findCancelamentoTemplate(db) {
  const ativo = () => db('templates_email').whereRaw('COALESCE(ativo, 1) = 1');
  try {
    let row = await ativo()
      .whereRaw('LOWER(COALESCE(codigo, \'\')) IN (?, ?, ?)', [
        'cancelamento',
        'cancelamento_sicaf',
        'sicaf_cancelamento',
      ])
      .orderBy('id')
      .first();
    if (row) return row;

    row = await ativo().whereRaw('LOWER(nome) LIKE ?', ['%cancelamento%']).orderBy('id').first();
    if (row) return row;

    row = await ativo().where('id', TEMPLATE_CANCELAMENTO_FALLBACK_ID).first();
    return row || null;
  } catch (_) {
    return null;
  }
}

async function findAlertaTemplate(db) {
  try {
    let row = await db('templates_email')
      .whereRaw('COALESCE(ativo, 1) = 1')
      .where('id', TEMPLATE_ALERTA_FALLBACK_ID)
      .first();
    if (row) return row;

    row = await db('templates_email')
      .whereRaw('COALESCE(ativo, 1) = 1')
      .whereRaw('LOWER(nome) LIKE ?', ['%alerta%'])
      .orderBy('id')
      .first();
    return row || null;
  } catch (_) {
    return null;
  }
}

async function sendStatusEmailNotification(db, {
  status,
  sicaf,
  oldDisplayStatus,
  mensagem,
  usuarioId,
}) {
  const cliente = await db('clientes').where('id', sicaf.cliente_id).first();
  const emailDestino = String(cliente?.email || '').trim();
  if (!emailDestino) {
    return { enviado: false, motivo: 'sem_email_destino' };
  }

  if (status === 'Cancelado') {
    const templateRow = await findCancelamentoTemplate(db);
    if (!templateRow) {
      return {
        enviado: false,
        motivo: 'template_nao_encontrado',
        templateId: TEMPLATE_CANCELAMENTO_FALLBACK_ID,
      };
    }

    const emailAvisos = require('./email-avisos.service');
    const envio = await emailAvisos.enviarAvisoCliente({
      clienteId: sicaf.cliente_id,
      templateDbId: templateRow.id,
      to: emailDestino,
      mensagemAdicional: String(mensagem || '').trim(),
      usuarioId,
    });

    if (!envio.ok) {
      return {
        enviado: false,
        motivo: 'erro_envio',
        erro: envio.error || 'Falha ao enviar',
        templateId: templateRow.id,
        templateNome: templateRow.nome,
      };
    }

    return {
      enviado: !envio.simulado,
      simulado: Boolean(envio.simulado),
      templateId: templateRow.id,
      templateNome: templateRow.nome,
      para: emailDestino,
      tipo: 'cancelamento',
    };
  }

  const templateRow = await findAlertaTemplate(db);
  if (!templateRow) {
    return { enviado: false, motivo: 'template_nao_encontrado', templateId: TEMPLATE_ALERTA_FALLBACK_ID };
  }

  const nomeCliente = cliente.razao_social || cliente.nome_fantasia || '';
  const envio = await emailService.sendTemplate(templateRow.nome, {
    to: emailDestino,
    vars: {
      nome: nomeCliente,
      email: emailDestino,
      documento: cliente.documento || '',
      status_anterior: oldDisplayStatus,
      status_novo: status,
      status,
      data_atual: new Date().toLocaleDateString('pt-BR'),
      empresa_nome: nomeCliente,
      mensagem_adicional: String(mensagem || '').trim(),
    },
  });

  return envio.ok
    ? {
        enviado: true,
        templateId: templateRow.id,
        templateNome: templateRow.nome,
        para: emailDestino,
        tipo: 'alerta',
      }
    : {
        enviado: false,
        motivo: 'erro_envio',
        erro: envio.error || 'Falha ao enviar',
        templateId: templateRow.id,
      };
}

function isPaidTaxaStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return ['pago', 'paga', 'aprovado', 'aprovada', 'liberado', 'liberada'].includes(s);
}

function parseDataInicio(dataInicioRaw) {
  const dataInicio = String(dataInicioRaw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
    return { ok: false, error: 'dataInicio é obrigatória no formato YYYY-MM-DD' };
  }
  const [y, m, d] = dataInicio.split('-').map(Number);
  const dtInicio = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dtInicio.getTime()) ||
    dtInicio.getUTCFullYear() !== y ||
    dtInicio.getUTCMonth() !== m - 1 ||
    dtInicio.getUTCDate() !== d
  ) {
    return { ok: false, error: 'dataInicio inválida. Informe uma data real no formato YYYY-MM-DD' };
  }
  const dtValidade = new Date(dtInicio);
  dtValidade.setUTCFullYear(dtValidade.getUTCFullYear() + 1);
  const validadeStr = dtValidade.toISOString().slice(0, 10);
  const now = new Date();
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const valUtc = Date.UTC(dtValidade.getUTCFullYear(), dtValidade.getUTCMonth(), dtValidade.getUTCDate());
  const diasValidade = Math.ceil((valUtc - nowUtc) / (1000 * 60 * 60 * 24));
  return {
    ok: true,
    dataInicioAplicada: dataInicio,
    validadeStr,
    diasValidade,
    credenciamentoAnual: 1,
  };
}

async function syncFinanceiroPagamentoManual(db, {
  clienteId,
  sicafId,
  dataInicio,
  usuarioId,
  mensagem,
  targetStatus,
}) {
  const resumo = { taxaAtualizada: false, pagamentosAtualizados: 0, renovacoesConcluidas: 0 };

  let taxa = await db('taxas_sicaf')
    .where({ cliente_id: clienteId, sicaf_id: sicafId })
    .orderBy('created_at', 'desc')
    .first();

  if (!taxa) {
    taxa = await db('taxas_sicaf').where({ cliente_id: clienteId }).orderBy('created_at', 'desc').first();
  }

  if (taxa) {
    const updates = { data_pagamento: dataInicio };
    if (!isPaidTaxaStatus(taxa.status)) {
      updates.status = 'Pago';
    }
    await db('taxas_sicaf').where('id', taxa.id).update(updates);
    resumo.taxaAtualizada = true;

    for (const tabela of ['pagamentos', 'pagamentos_gerencianet']) {
      try {
        const n = await db(tabela)
          .where({ origem: 'sicaf', origem_id: taxa.id })
          .whereNotIn('status', ['pago', 'cancelado', 'estornado'])
          .update({ status: 'pago', data_pagamento: dataInicio });
        resumo.pagamentosAtualizados += Number(n) || 0;
      } catch (_) {}
    }
  }

  try {
    const nRen = await db('sicaf_renovacoes')
      .where({ sicaf_id: sicafId, cliente_id: clienteId, status: 'Pendente' })
      .update({ status: 'Concluída' });
    resumo.renovacoesConcluidas = Number(nRen) || 0;
  } catch (_) {}

  try {
    const valorFmt = taxa?.valor != null ? `R$ ${parseFloat(taxa.valor).toFixed(2)}` : 'valor não informado';
    await db('historico_acoes').insert({
      cliente_id: clienteId,
      usuario_id: usuarioId,
      acao: `Financeiro — pagamento registrado manualmente em ${dataInicio} (${targetStatus}). Taxa ${taxa ? `#${taxa.id}` : 'n/a'} · ${valorFmt}. ${mensagem}`,
      entidade: taxa ? 'taxas_sicaf' : 'sicaf_cadastros',
      entidade_id: taxa?.id || sicafId,
      created_at: db.fn.now(),
    });
  } catch (_) {}

  return resumo;
}

function dbStatusForTarget(targetStatus) {
  if (['Ativo', 'Pendente', 'Suspenso', 'Cancelado'].includes(targetStatus)) return targetStatus;
  return 'Ativo';
}

function addDaysUtc(baseDate, days) {
  const d = new Date(baseDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function applyValidityForStatus(targetStatus, dataInicioRaw) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (STATUS_COM_DATA_PAGAMENTO.includes(targetStatus)) {
    if (!dataInicioRaw) {
      return {
        ok: false,
        error: 'dataInicio é obrigatória para registrar o pagamento e iniciar a vigência do SICAF',
      };
    }
    return parseDataInicio(dataInicioRaw);
  }

  if (targetStatus === 'Vencido') {
    const validadeStr = addDaysUtc(now, -1);
    const diasValidade = 0;
    return { ok: true, validadeStr, diasValidade };
  }

  return { ok: true, validadeStr: null, diasValidade: null, clearValidade: true };
}

async function updateSicafStatusManual({ sicafId, status, usuarioId, mensagem, dataInicio }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  if (!sicafId) return { ok: false, error: 'sicafId é obrigatório' };
  if (!status || !VALID_STATUSES.includes(status)) {
    return { ok: false, error: `Status inválido. Valores aceitos: ${VALID_STATUSES.join(', ')}` };
  }

  if (STATUS_COM_DATA_PAGAMENTO.includes(status) && !String(dataInicio || '').trim()) {
    return { ok: false, error: 'Informe a data do pagamento para alterar para ' + status };
  }
  if (STATUS_COM_DATA_PAGAMENTO.includes(status) && !String(mensagem || '').trim()) {
    return { ok: false, error: 'Informe o motivo/observação para registro no histórico' };
  }
  if (status === 'Cancelado' && !String(mensagem || '').trim()) {
    return { ok: false, error: 'Informe o motivo do cancelamento para registro no histórico e no e-mail' };
  }

  const sicaf = await db('sicaf_cadastros').where('id', sicafId).first();
  if (!sicaf) return { ok: false, error: 'Cadastro SICAF não encontrado' };

  const oldDbStatus = sicaf.status;
  const oldDisplayStatus = resolveSicafDisplayStatus(sicaf.status, sicaf.data_validade, true);

  const validity = applyValidityForStatus(status, dataInicio);
  if (!validity.ok) return validity;

  const updatePayload = {
    status: dbStatusForTarget(status),
    updated_at: db.fn.now(),
  };

  if (validity.validadeStr) {
    updatePayload.data_validade = validity.validadeStr;
    updatePayload.dias_validade = validity.diasValidade ?? 0;
    updatePayload.data_ultima_atualizacao = db.fn.now();
  } else if (validity.clearValidade) {
    updatePayload.data_validade = null;
    updatePayload.dias_validade = 0;
  }

  if (validity.credenciamentoAnual) {
    updatePayload.credenciamento_anual = 1;
  }

  await db('sicaf_cadastros').where('id', sicafId).update(updatePayload);

  let financeiro = null;
  if (validity.dataInicioAplicada && STATUS_COM_DATA_PAGAMENTO.includes(status)) {
    financeiro = await syncFinanceiroPagamentoManual(db, {
      clienteId: sicaf.cliente_id,
      sicafId,
      dataInicio: validity.dataInicioAplicada,
      usuarioId,
      mensagem: String(mensagem || '').trim(),
      targetStatus: status,
    });
  }

  const acaoBase = validity.dataInicioAplicada
    ? `Status SICAF alterado manualmente: ${oldDisplayStatus} → ${status} (início ${validity.dataInicioAplicada}, validade até ${validity.validadeStr})`
    : `Status SICAF alterado manualmente: ${oldDisplayStatus} → ${status}`;
  const acaoFull = mensagem ? `${acaoBase} — ${mensagem}` : acaoBase;

  try {
    await db('historico_acoes').insert({
      cliente_id: sicaf.cliente_id,
      usuario_id: usuarioId,
      acao: acaoFull,
      entidade: 'sicaf_cadastros',
      entidade_id: sicafId,
      created_at: db.fn.now(),
    });
  } catch (_) {}

  let emailNotificacao = { enviado: false, motivo: 'status_ativo' };
  if (STATUS_COM_EMAIL.includes(status)) {
    try {
      emailNotificacao = await sendStatusEmailNotification(db, {
        status,
        sicaf,
        oldDisplayStatus,
        mensagem: String(mensagem || '').trim(),
        usuarioId,
      });
    } catch (emailErr) {
      emailNotificacao = { enviado: false, motivo: 'erro_envio', erro: emailErr.message };
    }
  }

  return {
    ok: true,
    message: `Status alterado de ${oldDisplayStatus} para ${status}`,
    oldStatus: oldDisplayStatus,
    oldDbStatus,
    newStatus: status,
    dataInicio: validity.dataInicioAplicada || null,
    novaValidade: validity.validadeStr || null,
    diasValidade: validity.diasValidade ?? null,
    emailNotificacao,
    financeiro,
  };
}

module.exports = {
  updateSicafStatusManual,
  VALID_STATUSES,
};
