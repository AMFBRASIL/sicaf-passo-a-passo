/**
 * Manutenção SICAF — ativação e consulta (portado do launcher legado).
 */
const { getDb } = require('../database/connection');
const { assertClienteAcessivel } = require('./client-access.service');
const {
  resolveSicafDisplayStatus,
  isSicafAcessoLiberado,
  resolveFinancialReleased,
} = require('../utils/sicaf-status');

const MANUTENCAO_STATUS_ATIVOS = ['Ativo', 'ativo', 'A Vencer', 'a vencer', 'Vencendo', 'vencendo'];

function isPaidStatus(status) {
  const s = String(status || '').toLowerCase();
  return ['pago', 'paga', 'aprovado', 'aprovada', 'paid', 'quitado', 'liberado', 'liberada'].includes(s);
}

async function assertSicafVigenteParaManutencao(db, clienteId) {
  const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
  if (!sicaf) {
    return {
      ok: false,
      error: 'Cadastre e pague a taxa SICAF antes de ativar a manutenção.',
    };
  }

  const taxasSicaf = await db('taxas_sicaf')
    .where('cliente_id', clienteId)
    .orderBy('id', 'desc')
    .catch(() => []);

  const hasPaidTaxRecord = (taxasSicaf || []).some(
    (t) => isPaidStatus(t.status) || t.data_pagamento,
  );
  const financialReleased = resolveFinancialReleased({
    hasSicaf: true,
    sicafStatus: sicaf.status,
    dataValidade: sicaf.data_validade,
    taxaReleased: hasPaidTaxRecord,
  });
  const displayStatus = resolveSicafDisplayStatus(sicaf.status, sicaf.data_validade, true);
  const liberado = isSicafAcessoLiberado({
    hasSicaf: true,
    status: displayStatus,
    financialReleased,
  });

  if (liberado) return { ok: true };

  if (displayStatus === 'Vencido') {
    return {
      ok: false,
      error: 'Seu SICAF está vencido. Renove o cadastro para poder ativar a manutenção.',
    };
  }
  if (!financialReleased) {
    return {
      ok: false,
      error: 'Conclua o pagamento da taxa SICAF antes de ativar a manutenção.',
    };
  }
  return {
    ok: false,
    error: 'É necessário ter o SICAF pago e vigente antes de ativar a manutenção.',
  };
}

function isManutencaoStatusAtivo(status) {
  return MANUTENCAO_STATUS_ATIVOS.includes(String(status || '').trim());
}

async function getValorMensal(db) {
  let valorMensal = 155;
  try {
    const cfg = await db('configuracoes_sistema').where('chave', 'valor_manutencao_mensal').first();
    if (cfg) valorMensal = parseFloat(cfg.valor);
  } catch (_) {}
  return valorMensal;
}

function parseParcelamento(parcelamento) {
  const raw = String(parcelamento || '12x').trim().toLowerCase();
  if (raw === 'avista' || raw === 'à vista' || raw === 'a vista') {
    return { parcelas: 1, intervaloMeses: 1 };
  }
  const match = raw.match(/^(\d+)\s*x$/);
  const parcelas = match ? Math.max(1, Math.min(12, parseInt(match[1], 10))) : 12;
  const intervaloMeses = parcelas === 1 ? 1 : Math.max(1, Math.floor(12 / parcelas));
  return { parcelas, intervaloMeses };
}

async function getManutencaoCliente(clienteId, usuarioId, jwtTipo) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId, jwtTipo);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  const manut = await db('manutencoes')
    .where('cliente_id', clienteId)
    .whereIn('status', MANUTENCAO_STATUS_ATIVOS)
    .orderBy('created_at', 'desc')
    .first();

  if (!manut || !isManutencaoStatusAtivo(manut.status)) {
    return { ok: true, manutencao: null };
  }

  let boletos = [];
  try {
    const boletosRaw = await db('manutencao_boletos')
      .where('manutencao_id', manut.id)
      .orderBy('data_vencimento', 'asc');
    boletos = boletosRaw.map((b) => ({
      id: b.id,
      mes: b.mes_referencia,
      ano: b.ano_referencia,
      valor: parseFloat(b.valor),
      vencimento: b.data_vencimento,
      status: b.status,
      dataPagamento: b.data_pagamento || null,
    }));
  } catch (_) {}

  return {
    ok: true,
    manutencao: {
      id: manut.id,
      status: manut.status,
      dataInicio: manut.data_inicio,
      dataFim: manut.data_fim,
      valor: parseFloat(manut.valor),
      boletos,
    },
  };
}

async function ativarManutencao({ clienteId, usuarioId, diaVencimento, parcelamento, jwtTipo }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId, jwtTipo);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  const sicafCheck = await assertSicafVigenteParaManutencao(db, clienteId);
  if (!sicafCheck.ok) return sicafCheck;

  const { parcelas: qtdParcelas, intervaloMeses } = parseParcelamento(parcelamento);
  const dueDay = Math.max(1, Math.min(28, parseInt(String(diaVencimento), 10) || 10));

  const manutExistente = await db('manutencoes')
    .where('cliente_id', clienteId)
    .whereIn('status', MANUTENCAO_STATUS_ATIVOS)
    .first();
  if (manutExistente) {
    return { ok: false, error: 'Este cliente já possui uma manutenção ativa.' };
  }

  const valorMensal = await getValorMensal(db);
  const hoje = new Date();
  const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dataFim = new Date(hoje.getFullYear() + 1, hoje.getMonth(), 0);
  const diasRestantes = Math.ceil((dataFim - hoje) / (1000 * 60 * 60 * 24));

  const manutPayload = {
    titulo: 'Manutenção CADBRASIL',
    tipo: 'Preventiva',
    plano: 'Manutenção CADBRASIL',
    valor: valorMensal * 12,
    status: 'Ativo',
    data_inicio: dataInicio.toISOString().slice(0, 10),
    data_fim: dataFim.toISOString().slice(0, 10),
    dias_restantes: diasRestantes,
    updated_at: db.fn.now(),
  };

  const manutAnterior = await db('manutencoes').where('cliente_id', clienteId).first();
  let manutencaoId;

  if (manutAnterior) {
    manutencaoId = manutAnterior.id;
    await db('manutencoes').where('id', manutencaoId).update(manutPayload);
    try {
      await db('manutencao_boletos')
        .where('manutencao_id', manutencaoId)
        .where(function () {
          this.whereNotIn('status', ['Pago', 'pago']).orWhereNull('status');
        })
        .delete();
    } catch (_) {}
  } else {
    [manutencaoId] = await db('manutencoes').insert({
      ...manutPayload,
      cliente_id: clienteId,
    });
  }

  const valorAnual = valorMensal * 12;
  const valorBoleto = valorAnual / qtdParcelas;

  for (let i = 0; i < qtdParcelas; i++) {
    const monthOffset = i * intervaloMeses;
    const mesRef = ((hoje.getMonth() + monthOffset) % 12) + 1;
    const anoRef = hoje.getFullYear() + Math.floor((hoje.getMonth() + monthOffset) / 12);
    const dia = Math.min(dueDay, new Date(anoRef, mesRef, 0).getDate());
    const dataVenc = new Date(anoRef, mesRef - 1, dia);

    try {
      await db('manutencao_boletos').insert({
        manutencao_id: manutencaoId,
        cliente_id: clienteId,
        mes_referencia: mesRef,
        ano_referencia: anoRef,
        valor: valorBoleto,
        data_vencimento: dataVenc.toISOString().slice(0, 10),
        status: 'Pendente',
        created_at: db.fn.now(),
      });
    } catch (_) {}
  }

  try {
    await db('sicaf_cadastros').where('cliente_id', clienteId).update({ manutencao_ativa: 1 });
  } catch (_) {}

  return {
    ok: true,
    manutencaoId,
    diaVencimento: dueDay,
    message: 'Manutenção ativada com sucesso!',
  };
}

/**
 * Cancela o plano de manutenção: cancela cobranças abertas, remove todos os boletos e exclui o plano.
 */
async function cancelarManutencao({ clienteId, usuarioId, motivo, jwtTipo }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  const permitido = await assertClienteAcessivel(db, clienteId, usuarioId, jwtTipo);
  if (!permitido) return { ok: false, error: 'Sem permissão para cancelar a manutenção deste cliente' };

  const manut = await db('manutencoes')
    .where('cliente_id', clienteId)
    .whereIn('status', MANUTENCAO_STATUS_ATIVOS)
    .orderBy('created_at', 'desc')
    .first();

  if (!manut) {
    return { ok: false, error: 'Cliente já está sem manutenção ativa.' };
  }

  const manutId = manut.id;
  const motivoTxt = motivo ? String(motivo).trim() : '';
  let boletosRemovidos = 0;
  let pagamentosCancelados = 0;

  const todosBoletos = await db('manutencao_boletos').where('manutencao_id', manutId).select('id');
  const boletoIds = todosBoletos.map((b) => b.id).filter(Boolean);
  boletosRemovidos = boletoIds.length;

  if (boletoIds.length) {
    try {
      const hasPg = await db.schema.hasTable('pagamentos_gerencianet');
      if (hasPg) {
        pagamentosCancelados = await db('pagamentos_gerencianet')
          .where('origem', 'manutencao')
          .whereIn('origem_id', boletoIds)
          .whereNotIn('status', ['pago', 'Pago', 'aprovado', 'Aprovado'])
          .update({ status: 'cancelado', updated_at: db.fn.now() });
      }
    } catch (_) {}

    try {
      const hasPag = await db.schema.hasTable('pagamentos');
      if (hasPag) {
        await db('pagamentos')
          .where('origem', 'manutencao')
          .whereIn('origem_id', boletoIds)
          .whereNotIn('status', ['pago', 'Pago'])
          .update({ status: 'cancelado', updated_at: db.fn.now() });
      }
    } catch (_) {}
  }

  await db('manutencoes').where('id', manutId).delete();

  await db('manutencoes')
    .where('cliente_id', clienteId)
    .whereIn('status', MANUTENCAO_STATUS_ATIVOS)
    .delete();

  try {
    await db('sicaf_cadastros').where('cliente_id', clienteId).update({
      manutencao_ativa: 0,
      updated_at: db.fn.now(),
    });
  } catch (_) {}

  try {
    await db('historico_acoes').insert({
      cliente_id: clienteId,
      usuario_id: usuarioId,
      acao: `Cancelamento de manutenção — ${boletosRemovidos} boleto(s) cancelado(s) e plano removido${motivoTxt ? ` — Motivo: ${motivoTxt}` : ''}`,
      entidade: 'manutencoes',
      entidade_id: manutId,
      created_at: db.fn.now(),
    });
  } catch (_) {}

  return {
    ok: true,
    message: `Plano de manutenção cancelado. ${boletosRemovidos} boleto(s) removido(s).`,
    boletosRemovidos,
    pagamentosCancelados,
  };
}

module.exports = {
  getManutencaoCliente,
  ativarManutencao,
  cancelarManutencao,
};
