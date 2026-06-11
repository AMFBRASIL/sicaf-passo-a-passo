/**
 * Alteração manual do status SICAF — espelha POST /api/sicaf/update-status do legado.
 */
const { getDb } = require('../database/connection');
const emailService = require('./email.service');
const { resolveSicafDisplayStatus, calcDaysRemaining } = require('../utils/sicaf-status');

const VALID_STATUSES = ['Ativo', 'Vencendo', 'Vencido', 'Pendente', 'Cancelado', 'Suspenso'];
const STATUS_COM_EMAIL = ['Vencido', 'Vencendo', 'Pendente', 'Suspenso', 'Cancelado'];

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

  if (targetStatus === 'Ativo') {
    const dataInicio = String(dataInicioRaw || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
      return { ok: false, error: 'dataInicio é obrigatória no formato YYYY-MM-DD para ativar o SICAF' };
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

  if (targetStatus === 'Vencendo') {
    const validadeStr = addDaysUtc(now, 15);
    const diasValidade = calcDaysRemaining(validadeStr);
    return { ok: true, validadeStr, diasValidade: diasValidade ?? 15 };
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
      const cliente = await db('clientes').where('id', sicaf.cliente_id).first();
      const emailDestino = String(cliente?.email || '').trim();
      if (!emailDestino) {
        emailNotificacao = { enviado: false, motivo: 'sem_email_destino' };
      } else {
        const isCancelamento = status === 'Cancelado';
        const templateId = isCancelamento ? 21 : 24;
        const templateRow = await db('templates_email').where('id', templateId).first();
        if (!templateRow) {
          emailNotificacao = { enviado: false, motivo: 'template_nao_encontrado', templateId };
        } else {
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
            },
          });
          emailNotificacao = envio.ok
            ? { enviado: true, templateId, para: emailDestino, tipo: isCancelamento ? 'cancelamento' : 'alerta' }
            : { enviado: false, motivo: 'erro_envio', erro: envio.error || 'Falha ao enviar', templateId };
        }
      }
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
  };
}

module.exports = {
  updateSicafStatusManual,
  VALID_STATUSES,
};
