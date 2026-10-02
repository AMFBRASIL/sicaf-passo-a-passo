/**
 * Motor genérico das assessorias CADBRASIL por portal (CAUFESP, BLL…).
 *
 * Fluxo: pagamento da assessoria → envio dos documentos → conferência CADBRASIL
 * → cadastro/protocolo no portal → análise do portal → aprovado.
 * Cada portal define tabelas, preço, catálogo de documentos e opções em um config.
 */
const { getDb } = require('../database/connection');

const STATUS = {
  AGUARDANDO_PAGAMENTO: 'aguardando_pagamento',
  DOCUMENTACAO: 'documentacao',
  CONFERENCIA: 'conferencia_cadbrasil',
  PENDENCIA_DOCUMENTOS: 'pendencia_documentos',
  PROTOCOLADO: 'protocolado',
  ANALISE_GOVERNO: 'analise_governo',
  EXIGENCIA_GOVERNO: 'exigencia_governo',
  APROVADO: 'aprovado',
  INDEFERIDO: 'indeferido',
};

const STATUS_VALIDOS = Object.values(STATUS);
const STATUS_EDITAVEIS = [STATUS.DOCUMENTACAO, STATUS.PENDENCIA_DOCUMENTOS, STATUS.EXIGENCIA_GOVERNO];

/** Origem do pagamento (pagamentos.origem) → serviço com `confirmarPagamento(origemId)`. */
const SERVICOS_POR_ORIGEM = {
  caufesp: () => require('./caufesp.service'),
  bll: () => require('./bll.service'),
  modulo_licitacoes_e: () => require('./modulos-assinatura.service').porModulo('licitacoes_e'),
  modulo_pncp: () => require('./modulos-assinatura.service').porModulo('pncp'),
};

function servicoPorOrigem(origem) {
  const fabrica = SERVICOS_POR_ORIGEM[origem];
  return fabrica ? fabrica() : null;
}

function toIsoDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/**
 * @param {object} cfg
 * @param {string} cfg.nome - Nome exibido (ex.: 'CAUFESP')
 * @param {string} cfg.origem - pagamentos.origem (ex.: 'caufesp')
 * @param {string} cfg.tabelaProcessos
 * @param {string} cfg.tabelaDocumentos
 * @param {string} cfg.chaveValor - chave em configuracoes_sistema
 * @param {number} cfg.valorPadrao
 * @param {string} cfg.descricaoCobranca
 * @param {string} cfg.protocoloPrefixo
 * @param {Array} cfg.documentos - catálogo { codigo, grupo, nome, descricao, obrigatorio, validade?, exigidoPara? }
 * @param {string[]} cfg.opcoes - valores aceitos na escolha do cliente (gravada em `atividade`)
 * @param {string} cfg.mensagemOpcaoPendente
 */
function criarServicoAssessoria(cfg) {
  const LOG_PREFIX = `[${cfg.nome}]`;
  const CODIGOS_VALIDOS = new Set(cfg.documentos.map((d) => d.codigo));
  let ensurePromise = null;

  function ensureTables(db) {
    if (!ensurePromise) {
      ensurePromise = (async () => {
        if (!(await db.schema.hasTable(cfg.tabelaProcessos))) {
          await db.schema.createTable(cfg.tabelaProcessos, (t) => {
            t.increments('id').primary();
            t.integer('cliente_id').unsigned().notNullable().index();
            t.string('status', 30).notNullable().defaultTo(STATUS.AGUARDANDO_PAGAMENTO);
            t.string('atividade', 20).nullable();
            t.decimal('valor', 12, 2).notNullable();
            t.boolean('pago').notNullable().defaultTo(false);
            t.dateTime('data_pagamento').nullable();
            t.text('observacao_cliente').nullable();
            t.text('observacao_cadbrasil').nullable();
            t.string('protocolo_caufesp', 60).nullable();
            t.date('crc_validade').nullable();
            t.dateTime('enviado_analise_em').nullable();
            t.timestamps(true, true);
          });
        }
        if (!(await db.schema.hasTable(cfg.tabelaDocumentos))) {
          await db.schema.createTable(cfg.tabelaDocumentos, (t) => {
            t.increments('id').primary();
            t.integer('processo_id').unsigned().notNullable().index();
            t.integer('cliente_id').unsigned().notNullable().index();
            t.string('codigo', 40).notNullable();
            t.string('arquivo_url', 500).notNullable();
            t.string('arquivo_nome', 255).nullable();
            t.date('data_validade').nullable();
            t.string('status', 12).notNullable().defaultTo('enviado');
            t.string('observacao', 255).nullable();
            t.integer('enviado_por').unsigned().nullable();
            t.timestamps(true, true);
            t.unique(['processo_id', 'codigo']);
          });
        }
      })().catch((e) => {
        ensurePromise = null;
        throw e;
      });
    }
    return ensurePromise;
  }

  async function getValor(db) {
    try {
      const row = await db('configuracoes_sistema').where('chave', cfg.chaveValor).first();
      const v = row ? parseFloat(String(row.valor).replace(',', '.')) : NaN;
      if (Number.isFinite(v) && v > 0) return v;
    } catch (_) {}
    return cfg.valorPadrao;
  }

  async function registrarHistorico(db, processo, acao, usuarioId) {
    try {
      await db('historico_acoes').insert({
        cliente_id: processo.cliente_id,
        usuario_id: usuarioId || null,
        acao,
        entidade: cfg.tabelaProcessos,
        entidade_id: processo.id,
        created_at: db.fn.now(),
      });
    } catch (_) {}
  }

  async function obterOuCriarProcesso(db, clienteId) {
    await ensureTables(db);
    const atual = await db(cfg.tabelaProcessos).where('cliente_id', clienteId).orderBy('id', 'desc').first();
    if (atual) return atual;

    const valor = await getValor(db);
    const [id] = await db(cfg.tabelaProcessos).insert({
      cliente_id: clienteId,
      status: STATUS.AGUARDANDO_PAGAMENTO,
      valor,
    });
    return db(cfg.tabelaProcessos).where('id', id).first();
  }

  function docExigido(doc, opcao) {
    if (!doc.obrigatorio) return false;
    if (!doc.exigidoPara) return true;
    if (!opcao || opcao === 'ambos') return true;
    return doc.exigidoPara.includes(opcao);
  }

  async function ultimoPagamento(db, processoId) {
    const pgto = await db('pagamentos')
      .whereNull('deleted_at')
      .where({ origem: cfg.origem, origem_id: processoId })
      .whereIn('status', ['aguardando', 'gerado', 'pago'])
      .orderBy('id', 'desc')
      .first();
    if (!pgto) return null;
    return {
      id: pgto.id,
      tipo: pgto.tipo,
      status: pgto.status,
      valor: Number(pgto.valor),
      vencimento: toIsoDate(pgto.data_vencimento),
      protocolo: pgto.protocolo,
      barcode: pgto.barcode || '',
      link: pgto.link_boleto || '',
      pdf: pgto.link_pdf || '',
      txid: pgto.provider_txid || '',
      qrcodeText: pgto.qrcode_text || '',
      qrcodeImage: pgto.qrcode_image || '',
      criadoEm: pgto.created_at || null,
    };
  }

  async function montarPainel(db, processo) {
    const enviados = await db(cfg.tabelaDocumentos).where('processo_id', processo.id);
    const porCodigo = new Map(enviados.map((d) => [d.codigo, d]));
    const opcao = processo.atividade || null;

    const documentos = cfg.documentos.map((doc) => {
      const env = porCodigo.get(doc.codigo);
      return {
        codigo: doc.codigo,
        grupo: doc.grupo,
        nome: doc.nome,
        descricao: doc.descricao,
        obrigatorio: docExigido(doc, opcao),
        condicional: Boolean(doc.exigidoPara) && !opcao,
        pedeValidade: Boolean(doc.validade),
        enviado: env
          ? {
              arquivoUrl: env.arquivo_url,
              arquivoNome: env.arquivo_nome,
              dataValidade: toIsoDate(env.data_validade),
              status: env.status,
              observacao: env.observacao,
              enviadoEm: env.updated_at || env.created_at,
            }
          : null,
      };
    });

    const obrigatorios = documentos.filter((d) => d.obrigatorio);
    const pendentes = obrigatorios.filter((d) => !d.enviado || d.enviado.status === 'recusado');

    return {
      processo: {
        id: processo.id,
        status: processo.status,
        atividade: opcao,
        valor: Number(processo.valor),
        pago: Boolean(processo.pago),
        dataPagamento: processo.data_pagamento,
        observacaoCliente: processo.observacao_cliente,
        observacaoCadbrasil: processo.observacao_cadbrasil,
        protocoloPortal: processo.protocolo_caufesp,
        cadastroValidade: toIsoDate(processo.crc_validade),
        enviadoAnaliseEm: processo.enviado_analise_em,
        editavel: STATUS_EDITAVEIS.includes(processo.status),
      },
      pagamento: await ultimoPagamento(db, processo.id),
      documentos,
      resumo: {
        obrigatoriosTotal: obrigatorios.length,
        obrigatoriosEnviados: obrigatorios.length - pendentes.length,
        podeEnviarAnalise:
          Boolean(processo.pago) &&
          Boolean(opcao) &&
          STATUS_EDITAVEIS.includes(processo.status) &&
          pendentes.length === 0,
      },
    };
  }

  async function getPainel(clienteId) {
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco de dados não disponível' };
    try {
      const processo = await obterOuCriarProcesso(db, Number(clienteId));
      return { ok: true, ...(await montarPainel(db, processo)) };
    } catch (e) {
      console.error(`${LOG_PREFIX} getPainel:`, e.message);
      return { ok: false, error: e.message };
    }
  }

  /** Visão do admin: não cria processo para quem nunca acessou a assessoria. */
  async function getResumo(clienteId) {
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco de dados não disponível' };
    try {
      await ensureTables(db);
      const processo = await db(cfg.tabelaProcessos)
        .where('cliente_id', Number(clienteId))
        .orderBy('id', 'desc')
        .first();
      if (!processo) return { ok: true, existe: false };
      const docs = await db(cfg.tabelaDocumentos).where('processo_id', processo.id).select('status');
      return {
        ok: true,
        existe: true,
        status: processo.status,
        pago: Boolean(processo.pago),
        dataPagamento: processo.data_pagamento,
        atividade: processo.atividade || null,
        documentosEnviados: docs.length,
        documentosAguardando: docs.filter((d) => d.status === 'enviado').length,
        documentosRecusados: docs.filter((d) => d.status === 'recusado').length,
        atualizadoEm: processo.updated_at,
      };
    } catch (e) {
      console.error(`${LOG_PREFIX} getResumo:`, e.message);
      return { ok: false, error: e.message };
    }
  }

  async function gerarCobranca({ clienteId, formaPagamento, geradoPor }) {
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco de dados não disponível' };
    try {
      const processo = await obterOuCriarProcesso(db, Number(clienteId));
      if (processo.pago) return { ok: false, error: `A assessoria ${cfg.nome} já está paga.` };

      const forma = String(formaPagamento || '').toLowerCase();
      if (!['boleto', 'pix'].includes(forma)) {
        return { ok: false, error: 'Forma de pagamento inválida. Use boleto ou pix.' };
      }

      const existente = await ultimoPagamento(db, processo.id);
      const hoje = new Date().toISOString().slice(0, 10);
      if (
        existente &&
        existente.tipo === forma &&
        existente.status !== 'pago' &&
        (!existente.vencimento || existente.vencimento >= hoje) &&
        (existente.barcode || existente.qrcodeText)
      ) {
        return { ok: true, reutilizado: true, pagamento: existente };
      }

      const valor = await getValor(db);
      if (Number(processo.valor) !== valor) {
        await db(cfg.tabelaProcessos).where('id', processo.id).update({ valor, updated_at: db.fn.now() });
      }

      const pagamentos = require('./pagamentos.service');
      const protocolo = `${cfg.protocoloPrefixo}-${processo.id}-${Date.now().toString().slice(-6)}`;
      const result = await pagamentos.gerarCobrancaPersonalizada({
        clienteId: processo.cliente_id,
        valor,
        formaPagamento: forma,
        descricao: cfg.descricaoCobranca,
        protocolo,
        origem: cfg.origem,
        origemId: processo.id,
        message: `${cfg.descricaoCobranca}\nServiços de assessoria para licitações\nReferência: ${protocolo}`,
        geradoPor: geradoPor || null,
      });
      if (!result.ok) return result;

      await registrarHistorico(
        db,
        processo,
        `Cobrança ${cfg.nome} gerada (${forma}) - R$ ${valor.toFixed(2)}`,
        geradoPor,
      );
      return { ok: true, pagamento: await ultimoPagamento(db, processo.id) };
    } catch (e) {
      console.error(`${LOG_PREFIX} gerarCobranca:`, e.message);
      return { ok: false, error: e.message };
    }
  }

  /** Chamado pela baixa de pagamentos com origem = cfg.origem. */
  async function confirmarPagamento(processoId) {
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco de dados não disponível' };
    try {
      await ensureTables(db);
      const processo = await db(cfg.tabelaProcessos).where('id', processoId).first();
      if (!processo) return { ok: false, error: `Processo ${cfg.nome} não encontrado` };
      if (processo.pago) return { ok: true };

      await db(cfg.tabelaProcessos)
        .where('id', processoId)
        .update({
          pago: true,
          data_pagamento: db.fn.now(),
          status: processo.status === STATUS.AGUARDANDO_PAGAMENTO ? STATUS.DOCUMENTACAO : processo.status,
          updated_at: db.fn.now(),
        });
      await registrarHistorico(db, processo, `Pagamento da assessoria ${cfg.nome} confirmado`);

      const emailNotificacao = await require('./servico-ativado-email.service').enviarServicoAtivado({
        clienteId: processo.cliente_id,
        servico: cfg.origem,
        origemId: processo.id,
      });
      return { ok: true, emailNotificacao };
    } catch (e) {
      console.error(`${LOG_PREFIX} confirmarPagamento:`, e.message);
      return { ok: false, error: e.message };
    }
  }

  async function definirAtividade({ clienteId, atividade }) {
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco de dados não disponível' };
    if (!cfg.opcoes.includes(atividade)) return { ok: false, error: 'Opção inválida.' };
    const processo = await obterOuCriarProcesso(db, Number(clienteId));
    if (processo.status !== STATUS.AGUARDANDO_PAGAMENTO && !STATUS_EDITAVEIS.includes(processo.status)) {
      return { ok: false, error: 'O processo já foi enviado para análise.' };
    }
    await db(cfg.tabelaProcessos).where('id', processo.id).update({ atividade, updated_at: db.fn.now() });
    return getPainel(clienteId);
  }

  async function salvarDocumento({ clienteId, codigo, arquivoUrl, arquivoNome, dataValidade, usuarioId }) {
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco de dados não disponível' };
    if (!CODIGOS_VALIDOS.has(codigo)) return { ok: false, error: 'Documento inválido.' };
    if (!arquivoUrl) return { ok: false, error: 'Arquivo não informado.' };

    const processo = await obterOuCriarProcesso(db, Number(clienteId));
    if (!processo.pago) {
      return { ok: false, error: 'Confirme o pagamento da assessoria para enviar os documentos.' };
    }
    if (!STATUS_EDITAVEIS.includes(processo.status)) {
      return { ok: false, error: 'O processo está em análise — aguarde o retorno da CADBRASIL.' };
    }

    const dados = {
      arquivo_url: String(arquivoUrl).slice(0, 500),
      arquivo_nome: arquivoNome ? String(arquivoNome).slice(0, 255) : null,
      data_validade: dataValidade || null,
      status: 'enviado',
      observacao: null,
      enviado_por: usuarioId || null,
      updated_at: db.fn.now(),
    };
    const existente = await db(cfg.tabelaDocumentos).where({ processo_id: processo.id, codigo }).first();
    if (existente) {
      await db(cfg.tabelaDocumentos).where('id', existente.id).update(dados);
    } else {
      await db(cfg.tabelaDocumentos).insert({
        ...dados,
        processo_id: processo.id,
        cliente_id: processo.cliente_id,
        codigo,
      });
    }
    return getPainel(clienteId);
  }

  async function removerDocumento({ clienteId, codigo }) {
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco de dados não disponível' };
    const processo = await obterOuCriarProcesso(db, Number(clienteId));
    if (!STATUS_EDITAVEIS.includes(processo.status)) {
      return { ok: false, error: 'O processo está em análise — não é possível remover documentos.' };
    }
    await db(cfg.tabelaDocumentos).where({ processo_id: processo.id, codigo }).delete();
    return getPainel(clienteId);
  }

  async function enviarParaAnalise({ clienteId, observacao, usuarioId }) {
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco de dados não disponível' };
    const processo = await obterOuCriarProcesso(db, Number(clienteId));
    const painel = await montarPainel(db, processo);
    if (!painel.resumo.podeEnviarAnalise) {
      return {
        ok: false,
        error: !processo.pago
          ? 'Confirme o pagamento da assessoria antes de enviar.'
          : !processo.atividade
            ? cfg.mensagemOpcaoPendente
            : 'Envie todos os documentos obrigatórios antes de solicitar a conferência.',
      };
    }

    await db(cfg.tabelaProcessos)
      .where('id', processo.id)
      .update({
        status: STATUS.CONFERENCIA,
        observacao_cliente: observacao ? String(observacao).slice(0, 2000) : processo.observacao_cliente,
        enviado_analise_em: db.fn.now(),
        updated_at: db.fn.now(),
      });
    await registrarHistorico(
      db,
      processo,
      `Documentação ${cfg.nome} enviada para conferência da CADBRASIL`,
      usuarioId,
    );
    return getPainel(clienteId);
  }

  /** Equipe CADBRASIL: avança o processo e/ou avalia documentos. */
  async function atualizarProcessoAdmin({
    clienteId,
    status,
    observacaoCadbrasil,
    protocoloPortal,
    cadastroValidade,
    documentos,
    usuarioId,
  }) {
    const db = getDb();
    if (!db) return { ok: false, error: 'Banco de dados não disponível' };
    const processo = await obterOuCriarProcesso(db, Number(clienteId));

    const update = { updated_at: db.fn.now() };
    if (status !== undefined) {
      if (!STATUS_VALIDOS.includes(status)) return { ok: false, error: 'Status inválido.' };
      update.status = status;
    }
    if (observacaoCadbrasil !== undefined) update.observacao_cadbrasil = observacaoCadbrasil || null;
    if (protocoloPortal !== undefined) update.protocolo_caufesp = protocoloPortal || null;
    if (cadastroValidade !== undefined) update.crc_validade = cadastroValidade || null;
    await db(cfg.tabelaProcessos).where('id', processo.id).update(update);

    if (Array.isArray(documentos)) {
      for (const d of documentos) {
        if (!CODIGOS_VALIDOS.has(d.codigo) || !['aprovado', 'recusado', 'enviado'].includes(d.status)) continue;
        await db(cfg.tabelaDocumentos)
          .where({ processo_id: processo.id, codigo: d.codigo })
          .update({
            status: d.status,
            observacao: d.observacao ? String(d.observacao).slice(0, 255) : null,
            updated_at: db.fn.now(),
          });
      }
    }

    if (status && status !== processo.status) {
      await registrarHistorico(db, processo, `Processo ${cfg.nome}: ${processo.status} → ${status}`, usuarioId);
    }
    return getPainel(clienteId);
  }

  return {
    STATUS,
    DOCUMENTOS: cfg.documentos,
    VALOR_PADRAO: cfg.valorPadrao,
    getPainel,
    getResumo,
    gerarCobranca,
    confirmarPagamento,
    definirAtividade,
    salvarDocumento,
    removerDocumento,
    enviarParaAnalise,
    atualizarProcessoAdmin,
  };
}

module.exports = { STATUS, criarServicoAssessoria, servicoPorOrigem };
