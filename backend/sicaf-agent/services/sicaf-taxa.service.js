/**
 * Serviço de Geração de Taxa SICAF — CadBrasil.
 *
 * Regras de negócio:
 *  1) Cliente SEM SICAF → cria sicaf_cadastros (Pendente) + taxa + boleto/PIX
 *  2) Cliente COM SICAF, sem renovação pendente → cria renovação (Pendente) + taxa + boleto/PIX
 *  3) Cliente COM SICAF e JÁ tem renovação pendente → NÃO duplica, gera novo boleto/PIX vinculado
 *  4) Pagamento confirmado → baixa automática (taxa → Pago, renovação → Concluída, SICAF → Ativo)
 */
const { getDb } = require('../database/connection');
const pagamentosService = require('./pagamentos.service');
const planosService = require('./planos.service');

/**
 * Gerar taxa SICAF para um cliente.
 *
 * @param {Object} opts
 * @param {number} opts.clienteId - ID do cliente
 * @param {number} opts.ano - Ano de referência (ex: 2026)
 * @param {string} opts.formaPagamento - 'boleto' ou 'pix'
 * @param {number} [opts.geradoPor] - ID do usuário logado
 * @returns {Promise<Object>}
 */
async function gerarTaxa(opts) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const { clienteId, ano, formaPagamento, dataVencimento, allowCustomDueDate, geradoPor, planoCodigo } = opts;

  if (!clienteId) return { ok: false, error: 'clienteId é obrigatório' };
  if (!ano) return { ok: false, error: 'ano é obrigatório' };
  if (!['boleto', 'pix'].includes(formaPagamento)) return { ok: false, error: 'formaPagamento deve ser "boleto" ou "pix"' };

  try {
    // ── 1. Buscar cliente ──
    const cliente = await db('clientes').where('id', clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    // ── 2. Valor da taxa (plano escolhido ou configuração) ──
    const valorTaxa = await planosService.resolveValorTaxaSicaf(planoCodigo);
    const planoInfo = planoCodigo ? await planosService.getPlanoByCodigo(planoCodigo) : null;

    // ── 3. Verificar se já tem sicaf_cadastros ──
    let sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
    let sicafId;
    let isNovoCadastro = false;

    if (!sicaf) {
      // ══ CASO 1: Cliente NÃO tem SICAF → criar cadastro Pendente ══
      console.log(`[Taxa SICAF] Cliente ${clienteId} não tem SICAF → criando cadastro Pendente`);
      [sicafId] = await db('sicaf_cadastros').insert({
        cliente_id: clienteId,
        status: 'Pendente',
        data_ultima_atualizacao: db.fn.now(),
        completude: 0,
        credenciamento_anual: 0,
        manutencao_ativa: 0,
        dias_validade: 0,
      });
      isNovoCadastro = true;

      // Criar nível I como padrão
      await db('sicaf_niveis').insert({ sicaf_id: sicafId, nivel: 'I', habilitado: 0 });
    } else {
      sicafId = sicaf.id;
    }

    // ── 4. Verificar renovação pendente existente ──
    let renovacaoPendente = null;
    if (!isNovoCadastro) {
      renovacaoPendente = await db('sicaf_renovacoes')
        .where({ sicaf_id: sicafId, cliente_id: clienteId, status: 'Pendente' })
        .orderBy('id', 'desc')
        .first();
    }

    let renovacaoId;

    if (renovacaoPendente) {
      // ══ CASO 4: Já tem renovação pendente → reutilizar ══
      console.log(`[Taxa SICAF] Renovação pendente já existe (id=${renovacaoPendente.id}) → gerar novo boleto/PIX vinculado`);
      renovacaoId = renovacaoPendente.id;
    } else if (!isNovoCadastro) {
      // ══ CASO 2/3: Tem SICAF mas sem renovação pendente → criar renovação Pendente ══
      console.log(`[Taxa SICAF] Criando renovação Pendente para SICAF id=${sicafId}, ano=${ano}`);
      [renovacaoId] = await db('sicaf_renovacoes').insert({
        sicaf_id: sicafId,
        cliente_id: clienteId,
        ano_referencia: ano,
        data_renovacao: db.fn.now(),
        status: 'Pendente',
        renovado_por: geradoPor || null,
        observacoes: `Renovação ${ano} — aguardando pagamento`,
      });
    }

    // ── 5. Verificar se já existe taxa pendente para o mesmo ano ──
    let taxa = await db('taxas_sicaf')
      .where({ sicaf_id: sicafId, cliente_id: clienteId, ano_referencia: ano })
      .whereIn('status', ['Pendente'])
      .first();

    let taxaId;

    if (taxa) {
      // Reutilizar taxa existente (evitar duplicatas) — atualiza valor se plano mudou
      taxaId = taxa.id;
      if (parseFloat(taxa.valor) !== valorTaxa) {
        await db('taxas_sicaf').where('id', taxaId).update({ valor: valorTaxa });
      }
      console.log(`[Taxa SICAF] Taxa pendente já existe (id=${taxaId}) → gerando novo boleto/PIX`);
    } else {
      // Criar nova taxa
      const descricaoBase = isNovoCadastro
        ? `Cadastro SICAF ${ano} — ${cliente.razao_social || cliente.nome_fantasia}`
        : `Renovação SICAF ${ano} — ${cliente.razao_social || cliente.nome_fantasia}`;
      const descricao = planoInfo?.nome ? `${descricaoBase} (${planoInfo.nome})` : descricaoBase;

      [taxaId] = await db('taxas_sicaf').insert({
        sicaf_id: sicafId,
        cliente_id: clienteId,
        descricao,
        valor: valorTaxa,
        ano_referencia: ano,
        forma_pagamento: formaPagamento === 'pix' ? 'PIX' : 'Boleto',
        status: 'Pendente',
      });
      console.log(`[Taxa SICAF] Taxa criada (id=${taxaId}), valor R$ ${valorTaxa.toFixed(2)}`);
    }

    // ── 6. Gerar Boleto ou PIX via Gerencianet ──
    let pagamentoResult;

    if (formaPagamento === 'boleto') {
      pagamentoResult = await pagamentosService.gerarBoletoSicaf({
        taxaId,
        clienteId,
        dataVencimento,
        allowCustomDueDate: !!allowCustomDueDate,
        geradoPor,
      });
    } else {
      pagamentoResult = await pagamentosService.gerarPixSicaf({
        taxaId,
        clienteId,
        geradoPor,
      });
    }

    if (!pagamentoResult.ok) {
      return {
        ok: false,
        error: pagamentoResult.error || 'Erro ao gerar pagamento',
        taxaId,
        sicafId,
        renovacaoId: renovacaoId || null,
      };
    }

    // ── 7. Registrar no histórico quem gerou a taxa ──
    if (geradoPor) {
      const acaoDesc = isNovoCadastro
        ? `Taxa de cadastro SICAF ${ano} gerada (R$ ${valorTaxa.toFixed(2)}, ${formaPagamento.toUpperCase()})`
        : renovacaoPendente
          ? `Novo ${formaPagamento.toUpperCase()} gerado para renovação pendente SICAF ${ano} (R$ ${valorTaxa.toFixed(2)})`
          : `Taxa de renovação SICAF ${ano} gerada (R$ ${valorTaxa.toFixed(2)}, ${formaPagamento.toUpperCase()})`;
      try {
        await db('historico_acoes').insert({
          cliente_id: clienteId,
          usuario_id: geradoPor,
          acao: acaoDesc,
          entidade: 'taxas_sicaf',
          entidade_id: taxaId,
          created_at: db.fn.now(),
        });
      } catch (_) {}
    }

    // ── 8. Montar resposta ──
    return {
      ok: true,
      message: renovacaoPendente
        ? 'Novo boleto/PIX gerado para renovação pendente'
        : isNovoCadastro
          ? 'Cadastro SICAF criado e pagamento gerado'
          : 'Renovação criada e pagamento gerado',
      dados: {
        sicafId,
        taxaId,
        renovacaoId: renovacaoId || null,
        isNovoCadastro,
        isRenovacaoPendente: !!renovacaoPendente,
        ano,
        valor: valorTaxa,
        formaPagamento,
        pagamento: pagamentoResult,
      },
    };
  } catch (e) {
    console.error('[Taxa SICAF] Erro gerarTaxa:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Confirmar pagamento de uma taxa SICAF.
 * Atualiza taxa → Pago, renovação → Concluída, SICAF → Ativo + nova validade.
 *
 * @param {number} taxaId
 * @returns {Promise<Object>}
 */
async function confirmarPagamento(taxaId, usuarioId, extra = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const taxa = await db('taxas_sicaf').where('id', taxaId).first();
    if (!taxa) return { ok: false, error: 'Taxa não encontrada' };
    if (taxa.status === 'Pago' || taxa.status === 'Aprovado') {
      return { ok: false, error: 'Esta taxa já foi paga/aprovada' };
    }

    // 1. Marcar taxa como Paga
    await db('taxas_sicaf').where('id', taxaId).update({
      status: 'Pago',
      data_pagamento: db.fn.now(),
    });

    // 1b. Sincronizar registros de pagamento (PIX/boleto) vinculados à taxa
    try {
      await db('pagamentos')
        .where({ origem: 'sicaf', origem_id: taxaId })
        .whereNotIn('status', ['pago', 'cancelado', 'estornado'])
        .update({ status: 'pago', data_pagamento: db.fn.now() });
    } catch (_) {}
    try {
      await db('pagamentos_gerencianet')
        .where({ origem: 'sicaf', origem_id: taxaId })
        .whereNotIn('status', ['pago', 'cancelado', 'estornado'])
        .update({ status: 'pago', data_pagamento: db.fn.now() });
    } catch (_) {}

    // 2. Marcar renovação(ões) pendente(s) como Concluída
    await db('sicaf_renovacoes')
      .where({ sicaf_id: taxa.sicaf_id, cliente_id: taxa.cliente_id, status: 'Pendente' })
      .update({ status: 'Concluída' });

    // 3. Atualizar SICAF → Ativo com nova validade (1 ano a partir de hoje)
    const novaValidade = new Date();
    novaValidade.setFullYear(novaValidade.getFullYear() + 1);
    const validadeStr = novaValidade.toISOString().slice(0, 10);

    const now = new Date();
    const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const valUtc = Date.UTC(novaValidade.getFullYear(), novaValidade.getMonth(), novaValidade.getDate());
    const diasValidade = Math.ceil((valUtc - nowUtc) / (1000 * 60 * 60 * 24));

    try {
      const [cols] = await db.raw("SHOW COLUMNS FROM sicaf_cadastros LIKE 'atualizacoes_usadas'");
      if (!cols || cols.length === 0) {
        await db.raw("ALTER TABLE sicaf_cadastros ADD COLUMN atualizacoes_usadas INT DEFAULT 0");
        await db.raw("ALTER TABLE sicaf_cadastros ADD COLUMN atualizacoes_reset_em DATE NULL");
      }
    } catch (_) {}

    await db('sicaf_cadastros').where('id', taxa.sicaf_id).update({
      status: 'Ativo',
      data_validade: validadeStr,
      data_ultima_atualizacao: db.fn.now(),
      dias_validade: diasValidade,
      credenciamento_anual: 1,
      atualizacoes_usadas: 0,
      atualizacoes_reset_em: db.fn.now(),
    });

    // 4. Registrar no histórico quem confirmou o pagamento
    if (usuarioId) {
      try {
        await db('historico_acoes').insert({
          cliente_id: taxa.cliente_id,
          usuario_id: usuarioId,
          acao: `Pagamento confirmado: Taxa #${taxaId} (R$ ${parseFloat(taxa.valor).toFixed(2)}) — SICAF ativado até ${validadeStr}`,
          entidade: 'taxas_sicaf',
          entidade_id: taxaId,
          created_at: db.fn.now(),
        });
      } catch (_) {}
    }

    console.log(`[Taxa SICAF] Pagamento confirmado: taxa=${taxaId}, SICAF=${taxa.sicaf_id} → Ativo até ${validadeStr} (por usuário ${usuarioId || 'sistema'})`);

    let emailNotificacao = { enviado: false, motivo: 'skip_email' };
    if (!extra.skipEmail) {
      try {
        const pagamentoEmail = require('./pagamento-confirmado-email.service');
        emailNotificacao = await pagamentoEmail.enviarAposConfirmacao({
          clienteId: taxa.cliente_id,
          taxa,
          novaValidade: validadeStr,
          formaPagamento: extra.formaPagamento || taxa.forma_pagamento,
          observacoes: extra.observacoes,
          usuarioId,
        });
        if (emailNotificacao.enviado) {
          console.log(`[Taxa SICAF] E-mail processo iniciado enviado para cliente ${taxa.cliente_id}`);
        } else if (emailNotificacao.motivo !== 'sem_email_destino') {
          console.warn('[Taxa SICAF] E-mail processo iniciado não enviado:', emailNotificacao.motivo, emailNotificacao.erro || '');
        }
      } catch (emailErr) {
        emailNotificacao = { enviado: false, motivo: 'erro_envio', erro: emailErr.message };
        console.error('[Taxa SICAF] Erro ao enviar e-mail pós-pagamento:', emailErr.message);
      }
    }

    return {
      ok: true,
      message: 'Pagamento confirmado! SICAF ativado com sucesso.',
      sicafId: taxa.sicaf_id,
      novaValidade: validadeStr,
      diasValidade,
      emailNotificacao,
    };
  } catch (e) {
    console.error('[Taxa SICAF] Erro confirmarPagamento:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Busca o status de taxa/renovação de um cliente para um ano.
 */
async function getStatusTaxa(clienteId, ano) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
    if (!sicaf) return { ok: true, hasSicaf: false, taxaPendente: null, renovacaoPendente: null };

    const taxaPendente = await db('taxas_sicaf')
      .where({ sicaf_id: sicaf.id, cliente_id: clienteId, ano_referencia: ano })
      .whereIn('status', ['Pendente'])
      .first();

    const renovacaoPendente = await db('sicaf_renovacoes')
      .where({ sicaf_id: sicaf.id, cliente_id: clienteId, status: 'Pendente' })
      .first();

    // Buscar último pagamento gerado para essa taxa (se houver)
    let ultimoPagamento = null;
    if (taxaPendente) {
      ultimoPagamento = await db('pagamentos')
        .whereNull('deleted_at')
        .where({ origem: 'sicaf', origem_id: taxaPendente.id })
        .whereIn('status', ['gerado', 'aguardando'])
        .orderBy('created_at', 'desc')
        .first();
    }

    return {
      ok: true,
      hasSicaf: true,
      sicafStatus: sicaf.status,
      taxaPendente: taxaPendente ? {
        id: taxaPendente.id,
        valor: parseFloat(taxaPendente.valor),
        status: taxaPendente.status,
        formaPagamento: taxaPendente.forma_pagamento,
      } : null,
      renovacaoPendente: renovacaoPendente ? {
        id: renovacaoPendente.id,
        ano: renovacaoPendente.ano_referencia,
        status: renovacaoPendente.status,
      } : null,
      ultimoPagamento: ultimoPagamento ? {
        id: ultimoPagamento.id,
        tipo: ultimoPagamento.tipo,
        status: ultimoPagamento.status,
        gnChargeId: ultimoPagamento.provider_charge_id,
        gnBarcode: ultimoPagamento.barcode,
        gnLink: ultimoPagamento.link_boleto,
        gnPdf: ultimoPagamento.link_pdf,
        gnTxid: ultimoPagamento.provider_txid,
        gnQrcodeText: ultimoPagamento.qrcode_text,
        gnQrcodeImage: ultimoPagamento.qrcode_image,
      } : null,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  gerarTaxa,
  confirmarPagamento,
  getStatusTaxa,
};
