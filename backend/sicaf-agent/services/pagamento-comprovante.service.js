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

  const confirm = await sicafTaxaService.confirmarPagamento(taxaId, autorizadoPor);
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
  listarPorCliente,
};
