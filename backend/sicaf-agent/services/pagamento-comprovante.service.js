/**
 * Registro de comprovantes na autorização manual de pagamentos (admin).
 */
const { getDb } = require('../database/connection');
const sicafTaxaService = require('./sicaf-taxa.service');

const FORMAS_VALIDAS = new Set(['pix', 'boleto', 'transferencia', 'outro']);

function normForma(raw) {
  const s = String(raw || 'pix').toLowerCase().trim();
  return FORMAS_VALIDAS.has(s) ? s : 'outro';
}

/**
 * Autoriza pagamento SICAF e persiste o comprovante enviado pelo admin.
 */
async function autorizarComComprovante({
  taxaId,
  pagamentoId,
  clienteId,
  formaPagamento,
  valor,
  arquivoUrl,
  arquivoNome,
  arquivoTipo,
  arquivoTamanhoBytes,
  observacoes,
  autorizadoPor,
}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const taxa = await db('taxas_sicaf').where('id', taxaId).first();
  if (!taxa) return { ok: false, error: 'Taxa SICAF não encontrada' };

  const clienteIdFinal = clienteId || taxa.cliente_id;
  if (!clienteIdFinal) return { ok: false, error: 'Cliente não informado' };
  if (Number(taxa.cliente_id) !== Number(clienteIdFinal)) {
    return { ok: false, error: 'Taxa não pertence a este cliente' };
  }

  if (!arquivoUrl || !String(arquivoUrl).trim()) {
    return { ok: false, error: 'Comprovante de pagamento é obrigatório' };
  }

  const confirm = await sicafTaxaService.confirmarPagamento(taxaId, autorizadoPor, {
    formaPagamento,
    observacoes,
    autorizacaoManual: true,
    pagamentoId: pagamentoId || undefined,
  });
  if (!confirm.ok) return confirm;

  let comprovanteId = null;
  try {
    const hasTable = await db.schema.hasTable('pagamento_comprovantes');
    if (hasTable) {
      [comprovanteId] = await db('pagamento_comprovantes').insert({
        cliente_id: clienteIdFinal,
        taxa_sicaf_id: taxaId,
        pagamento_id: pagamentoId || null,
        forma_pagamento: normForma(formaPagamento || taxa.forma_pagamento),
        valor: valor != null ? valor : taxa.valor,
        arquivo_url: arquivoUrl,
        arquivo_nome: arquivoNome || null,
        arquivo_tipo: arquivoTipo || null,
        arquivo_tamanho_bytes: arquivoTamanhoBytes || null,
        observacoes: observacoes || null,
        autorizado_por: autorizadoPor || null,
        autorizado_em: db.fn.now(),
      });
    }
  } catch (e) {
    console.error('[PagamentoComprovante] Erro ao salvar comprovante:', e.message);
    return {
      ok: false,
      error: 'Pagamento autorizado, mas falhou ao salvar o comprovante. Contate o suporte.',
      sicafConfirmado: true,
    };
  }

  try {
    await db('historico_acoes').insert({
      cliente_id: clienteIdFinal,
      usuario_id: autorizadoPor || null,
      acao: `Pagamento autorizado manualmente (taxa #${taxaId}) com comprovante`,
      entidade: 'pagamento_comprovantes',
      entidade_id: comprovanteId,
      created_at: db.fn.now(),
    });
  } catch (_) {}

  return {
    ok: true,
    message: confirm.message || 'Pagamento autorizado com sucesso.',
    comprovanteId,
    novaValidade: confirm.novaValidade,
    diasValidade: confirm.diasValidade,
    emailNotificacao: confirm.emailNotificacao || null,
  };
}

/**
 * Autoriza manualmente cobranças de serviços (CAUFESP, BLL, módulos mensais) a partir
 * do registro em `pagamentos` e libera o serviço correspondente pela origem.
 */
async function autorizarServicoComComprovante({
  pagamentoId,
  clienteId,
  formaPagamento,
  arquivoUrl,
  arquivoNome,
  arquivoTipo,
  arquivoTamanhoBytes,
  observacoes,
  autorizadoPor,
}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const pgto = await db('pagamentos').whereNull('deleted_at').where('id', pagamentoId).first();
  if (!pgto) return { ok: false, error: 'Cobrança não encontrada' };
  if (clienteId && Number(pgto.cliente_id) !== Number(clienteId)) {
    return { ok: false, error: 'Cobrança não pertence a este cliente' };
  }
  if (pgto.status === 'pago') return { ok: false, error: 'Esta cobrança já está paga' };
  if (['cancelado', 'estornado'].includes(String(pgto.status))) {
    return { ok: false, error: 'Cobrança cancelada não pode ser autorizada' };
  }

  const { servicoPorOrigem } = require('./assessoria-portal.service');
  const servico = pgto.origem ? servicoPorOrigem(pgto.origem) : null;
  if (!servico || !pgto.origem_id) {
    return { ok: false, error: 'Esta cobrança não é de um serviço autorizável por aqui' };
  }
  if (!arquivoUrl || !String(arquivoUrl).trim()) {
    return { ok: false, error: 'Comprovante de pagamento é obrigatório' };
  }

  await db('pagamentos').where('id', pgto.id).update({
    status: 'pago',
    data_pagamento: db.fn.now(),
    updated_at: db.fn.now(),
  });

  const confirm = await servico.confirmarPagamento(pgto.origem_id);
  if (!confirm.ok) {
    await db('pagamentos').where('id', pgto.id).update({
      status: pgto.status,
      data_pagamento: pgto.data_pagamento || null,
    });
    return { ok: false, error: confirm.error || 'Falha ao liberar o serviço' };
  }

  let comprovanteId = null;
  try {
    [comprovanteId] = await db('pagamento_comprovantes').insert({
      cliente_id: pgto.cliente_id,
      taxa_sicaf_id: null,
      pagamento_id: pgto.id,
      forma_pagamento: normForma(formaPagamento || pgto.tipo),
      valor: pgto.valor,
      arquivo_url: arquivoUrl,
      arquivo_nome: arquivoNome || null,
      arquivo_tipo: arquivoTipo || null,
      arquivo_tamanho_bytes: arquivoTamanhoBytes || null,
      observacoes: observacoes || null,
      autorizado_por: autorizadoPor || null,
      autorizado_em: db.fn.now(),
    });
  } catch (e) {
    console.error('[PagamentoComprovante] Erro ao salvar comprovante de serviço:', e.message);
    return {
      ok: false,
      error: 'Pagamento autorizado, mas falhou ao salvar o comprovante. Contate o suporte.',
      servicoConfirmado: true,
    };
  }

  try {
    await db('historico_acoes').insert({
      cliente_id: pgto.cliente_id,
      usuario_id: autorizadoPor || null,
      acao: `Pagamento autorizado manualmente (${pgto.descricao || pgto.origem} · pagamento #${pgto.id}) com comprovante`,
      entidade: 'pagamento_comprovantes',
      entidade_id: comprovanteId,
      created_at: db.fn.now(),
    });
  } catch (_) {}

  return {
    ok: true,
    message: 'Pagamento autorizado e serviço liberado.',
    comprovanteId,
    validoAte: confirm.validoAte || null,
  };
}

async function listarPorCliente(clienteId, limit = 20) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const hasTable = await db.schema.hasTable('pagamento_comprovantes');
    if (!hasTable) return { ok: true, comprovantes: [] };

    const rows = await db('pagamento_comprovantes as c')
      .leftJoin('usuarios as u', 'u.id', 'c.autorizado_por')
      .where('c.cliente_id', clienteId)
      .orderBy('c.autorizado_em', 'desc')
      .limit(limit)
      .select(
        'c.id',
        'c.taxa_sicaf_id',
        'c.pagamento_id',
        'c.forma_pagamento',
        'c.valor',
        'c.arquivo_url',
        'c.arquivo_nome',
        'c.observacoes',
        'c.autorizado_em',
        'u.nome as autorizado_por_nome',
      );

    return { ok: true, comprovantes: rows };
  } catch (e) {
    console.error('[PagamentoComprovante] Erro listarPorCliente:', e.message);
    return { ok: false, error: 'Erro ao listar comprovantes' };
  }
}

module.exports = {
  autorizarComComprovante,
  autorizarServicoComComprovante,
  listarPorCliente,
};
