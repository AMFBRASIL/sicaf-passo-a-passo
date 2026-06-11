/**
 * Serviço de Leitura de Edital com IA — CadBrasil.
 *
 * Funcionalidades:
 *  - Gerenciamento de créditos (gratuitos + pacotes)
 *  - Upload e análise de editais com OpenAI
 *  - Chat contextual sobre edital analisado
 *  - Compra de pacotes com pagamento real (Gerencianet)
 *  - Histórico de leituras
 */
const { getDb } = require('../database/connection');
const iaService = require('./ia.service');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// ══════════════════════════════════════════════════════════════════════════════
// CRÉDITOS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Retorna os créditos do usuário. Se não existir registro, cria com 3 gratuitos.
 */
async function getCreditosUsuario(usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let creditos = await db('usuario_creditos_ia').where('usuario_id', usuarioId).first();

    if (!creditos) {
      // Criar registro com 3 créditos gratuitos
      await db('usuario_creditos_ia').insert({
        usuario_id: usuarioId,
        creditos_totais: 3,
        creditos_utilizados: 0,
      });
      creditos = { creditos_totais: 3, creditos_utilizados: 0 };
    }

    // Buscar compras pendentes de aprovação
    let comprasPendentes = [];
    try {
      comprasPendentes = await db('compras_pacotes_ia as c')
        .leftJoin('pacotes_leitura_ia as p', 'c.pacote_id', 'p.id')
        .where('c.usuario_id', usuarioId)
        .where('c.status', 'pendente')
        .select(
          'c.id', 'c.quantidade_creditos', 'c.valor', 'c.status', 'c.created_at',
          'p.nome as pacote_nome'
        )
        .orderBy('c.created_at', 'desc');
    } catch (_) {}

    return {
      ok: true,
      creditos: {
        totais: creditos.creditos_totais,
        utilizados: creditos.creditos_utilizados,
        disponiveis: creditos.creditos_totais - creditos.creditos_utilizados,
      },
      comprasPendentes,
    };
  } catch (e) {
    console.error('[AI Reader] Erro getCreditosUsuario:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Consome 1 crédito do usuário. Retorna false se sem créditos.
 */
async function consumirCredito(usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const creditos = await db('usuario_creditos_ia').where('usuario_id', usuarioId).first();
    if (!creditos) return { ok: false, error: 'Registro de créditos não encontrado' };

    const disponiveis = creditos.creditos_totais - creditos.creditos_utilizados;
    if (disponiveis <= 0) {
      return { ok: false, error: 'Sem créditos disponíveis. Adquira um pacote para continuar.' };
    }

    await db('usuario_creditos_ia')
      .where('usuario_id', usuarioId)
      .increment('creditos_utilizados', 1);

    return {
      ok: true,
      creditosRestantes: disponiveis - 1,
    };
  } catch (e) {
    console.error('[AI Reader] Erro consumirCredito:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PACOTES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Lista pacotes disponíveis.
 */
async function getPacotes() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const pacotes = await db('pacotes_leitura_ia')
      .where('ativo', 1)
      .orderBy('preco', 'asc');

    return {
      ok: true,
      pacotes: pacotes.map((p) => ({
        id: p.id,
        nome: p.nome,
        leituras: p.quantidade_leituras,
        preco: parseFloat(p.preco),
        precoFormatado: `R$ ${parseFloat(p.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        precoUnitario: `R$ ${(parseFloat(p.preco) / p.quantidade_leituras).toFixed(2)}/leitura`,
        descricao: p.descricao,
        recursos: typeof p.recursos === 'string' ? JSON.parse(p.recursos) : (p.recursos || []),
        destaque: !!p.destaque,
        economia: p.economia,
      })),
    };
  } catch (e) {
    console.error('[AI Reader] Erro getPacotes:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Inicia a compra de um pacote: cria registro + gera boleto/PIX.
 */
async function comprarPacote(opts) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const { usuarioId, pacoteId, formaPagamento } = opts;

  if (!usuarioId || !pacoteId) return { ok: false, error: 'usuarioId e pacoteId são obrigatórios' };
  if (!['boleto', 'pix'].includes(formaPagamento)) return { ok: false, error: 'formaPagamento deve ser "boleto" ou "pix"' };

  try {
    // 1. Buscar pacote
    const pacote = await db('pacotes_leitura_ia').where('id', pacoteId).where('ativo', 1).first();
    if (!pacote) return { ok: false, error: 'Pacote não encontrado ou inativo' };

    // 2. Buscar dados do usuário (para dados de pagamento)
    const usuario = await db('usuarios').where('id', usuarioId).first();
    if (!usuario) return { ok: false, error: 'Usuário não encontrado' };

    // Buscar primeiro cliente vinculado ao usuário (para dados de CPF/CNPJ)
    const clienteVinculado = await db('clientes')
      .where('usuario_id', usuarioId)
      .first();

    const valorReais = parseFloat(pacote.preco);
    const valorCentavos = Math.round(valorReais * 100);
    const protocolo = `IA-PKG-${pacote.id}-${Date.now()}`;

    // Resolver documento (CPF/CNPJ) — obrigatório para PIX
    const docRaw = clienteVinculado?.documento || '';
    const docLimpo = docRaw.replace(/\D/g, '');
    const isPJ = clienteVinculado?.tipo_documento === 'CNPJ' || docLimpo.length === 14;
    const nomeCompleto = clienteVinculado?.razao_social || clienteVinculado?.nome_fantasia || usuario.nome || 'Cliente';

    if (formaPagamento === 'pix' && docLimpo.length !== 11 && docLimpo.length !== 14) {
      return { ok: false, error: 'Para pagamento via PIX é necessário ter uma empresa cadastrada com CPF ou CNPJ válido. Cadastre uma empresa na tela SICAF ou utilize Boleto.' };
    }

    // 3. Criar registro de compra
    const [compraId] = await db('compras_pacotes_ia').insert({
      usuario_id: usuarioId,
      pacote_id: pacoteId,
      quantidade_creditos: pacote.quantidade_leituras,
      valor: valorReais,
      status: 'pendente',
    });

    // 4. Registrar pagamento na tabela centralizada
    const [pagamentoId] = await db('pagamentos_gerencianet').insert({
      cliente_id: clienteVinculado?.id || null,
      origem: 'pacote_ia',
      origem_id: compraId,
      tipo: formaPagamento,
      valor: valorReais,
      valor_centavos: valorCentavos,
      descricao: `Pacote IA "${pacote.nome}" — ${pacote.quantidade_leituras} leituras`,
      protocolo,
      data_vencimento: formaPagamento === 'boleto' ? _vencimento30dias() : null,
      status: 'aguardando',
      cliente_nome: nomeCompleto,
      cliente_documento: docRaw,
      cliente_email: clienteVinculado?.email || usuario.email,
      gerado_por: usuarioId,
    });

    // Vincular pagamento à compra
    await db('compras_pacotes_ia').where('id', compraId).update({ pagamento_id: pagamentoId });

    // 5. Gerar pagamento real via Gerencianet
    const gerencianetService = require('./gerencianet.service');
    const dadosGN = {
      valor: valorCentavos,
      protocolo,
      cliente: {
        nome: nomeCompleto,
        razaoSocial: isPJ ? nomeCompleto : undefined,
        email: clienteVinculado?.email || usuario.email || '',
        telefone: clienteVinculado?.telefone || '',
        cpf: !isPJ && docLimpo.length === 11 ? docLimpo : undefined,
        cnpj: isPJ && docLimpo.length === 14 ? docLimpo : undefined,
      },
    };

    let gnResponse;
    try {
      if (formaPagamento === 'boleto') {
        dadosGN.vencimento = _vencimento30dias();
        gnResponse = await gerencianetService.gerarBoleto(dadosGN);
      } else {
        gnResponse = await gerencianetService.gerarPix(dadosGN);
      }
    } catch (gnErr) {
      await db('pagamentos_gerencianet').where('id', pagamentoId).update({
        status: 'erro',
        gn_error: gnErr.message,
      });
      return { ok: false, error: gnErr.message, compraId, pagamentoId };
    }

    // 6. Atualizar pagamento com dados do gateway
    if (formaPagamento === 'boleto') {
      const chargeData = gnResponse?.data || gnResponse;
      await db('pagamentos_gerencianet').where('id', pagamentoId).update({
        status: 'gerado',
        gn_charge_id: chargeData?.charge_id || null,
        gn_barcode: chargeData?.barcode || null,
        gn_link: chargeData?.billet_link || chargeData?.link || null,
        gn_pdf: chargeData?.pdf?.charge || null,
        gn_response: JSON.stringify(gnResponse),
      });

      return {
        ok: true,
        compraId,
        pagamentoId,
        tipo: 'boleto',
        chargeId: chargeData?.charge_id,
        barcode: chargeData?.barcode || '',
        link: chargeData?.billet_link || chargeData?.link || '',
        pdf: chargeData?.pdf?.charge || '',
        valor: valorReais,
        vencimento: _vencimento30dias(),
        protocolo,
      };
    } else {
      const txid = gnResponse?.txid || '';
      const qrcodeText = gnResponse?.qrcode?.qrcode || '';
      const qrcodeImage = gnResponse?.qrcode?.imagemQrcode || '';

      await db('pagamentos_gerencianet').where('id', pagamentoId).update({
        status: 'gerado',
        gn_txid: txid || null,
        gn_loc_id: gnResponse?.loc?.id || null,
        gn_qrcode_text: qrcodeText || null,
        gn_qrcode_image: qrcodeImage || null,
        gn_response: JSON.stringify(gnResponse),
      });

      return {
        ok: true,
        compraId,
        pagamentoId,
        tipo: 'pix',
        txid,
        qrcodeText,
        qrcodeImage,
        valor: valorReais,
        protocolo,
      };
    }
  } catch (e) {
    console.error('[AI Reader] Erro comprarPacote:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Confirmar pagamento de pacote IA → adicionar créditos ao usuário.
 */
async function confirmarCompraPacote(compraId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const compra = await db('compras_pacotes_ia').where('id', compraId).first();
    if (!compra) return { ok: false, error: 'Compra não encontrada' };
    if (compra.status === 'pago') return { ok: false, error: 'Compra já confirmada' };

    // 1. Atualizar compra
    await db('compras_pacotes_ia').where('id', compraId).update({
      status: 'pago',
      data_pagamento: db.fn.now(),
    });

    // 2. Adicionar créditos ao usuário
    const creditos = await db('usuario_creditos_ia').where('usuario_id', compra.usuario_id).first();
    if (creditos) {
      await db('usuario_creditos_ia')
        .where('usuario_id', compra.usuario_id)
        .increment('creditos_totais', compra.quantidade_creditos);
    } else {
      await db('usuario_creditos_ia').insert({
        usuario_id: compra.usuario_id,
        creditos_totais: 3 + compra.quantidade_creditos,
        creditos_utilizados: 0,
      });
    }

    console.log(`[AI Reader] Compra ${compraId} confirmada: +${compra.quantidade_creditos} créditos para user ${compra.usuario_id}`);
    return { ok: true, creditosAdicionados: compra.quantidade_creditos };
  } catch (e) {
    console.error('[AI Reader] Erro confirmarCompraPacote:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISE DE EDITAL COM IA
// ══════════════════════════════════════════════════════════════════════════════

const EDITAL_ANALYSIS_PROMPT = `Você é um especialista em licitações públicas brasileiras. Analise o edital fornecido e extraia TODAS as informações relevantes no formato JSON abaixo.

INSTRUÇÕES:
- Extraia dados reais do texto do edital. Se uma informação NÃO estiver no texto, use null.
- Para campos de valor, use formato "R$ X.XXX,XX".
- Para datas, use formato "DD/MM/YYYY às HH:MM" quando aplicável.
- A lista de documentos deve conter TODOS os documentos exigidos no edital.
- Os pontos de atenção devem destacar cláusulas incomuns, prazos apertados, exigências especiais, penalidades severas, etc.
- Os requisitos de habilitação devem ser agrupados por categoria (Jurídica, Técnica, Econômico-Financeira, Fiscal).
- O cronograma deve incluir todas as datas/prazos mencionados no edital.

Retorne APENAS um JSON válido (sem markdown, sem texto extra) com esta estrutura:
{
  "orgao": "Nome do órgão licitante",
  "uasg": "Código UASG (se houver)",
  "modalidade": "Tipo da licitação (Pregão Eletrônico, Concorrência, etc.)",
  "numero": "Número do edital/pregão",
  "objeto": "Descrição completa do objeto",
  "valorEstimado": "R$ X.XXX,XX",
  "dataSessao": "DD/MM/YYYY às HH:MM",
  "localidade": "Cidade/UF",
  "criterioJulgamento": "Menor Preço, Melhor Técnica, etc.",
  "tipoLicitacao": "Aquisição, Serviço, Obra, etc.",
  "exclusivaME": true/false,
  "documentos": ["doc1", "doc2", ...],
  "pontosAtencao": ["ponto1", "ponto2", ...],
  "requisitosHabilitacao": [
    {
      "categoria": "Habilitação Jurídica",
      "itens": ["item1", "item2"]
    },
    {
      "categoria": "Qualificação Técnica",
      "itens": ["item1", "item2"]
    },
    {
      "categoria": "Qualificação Econômico-Financeira",
      "itens": ["item1", "item2"]
    },
    {
      "categoria": "Regularidade Fiscal",
      "itens": ["item1", "item2"]
    }
  ],
  "cronograma": [
    { "evento": "Publicação do Edital", "data": "DD/MM/YYYY", "status": "concluido|proximo|futuro" }
  ]
}`;

/**
 * Extrai texto de um arquivo PDF.
 */
async function extrairTextoPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (e) {
    console.error('[AI Reader] Erro ao extrair texto do PDF:', e.message);
    throw new Error('Não foi possível extrair texto do PDF. Verifique se o arquivo não está corrompido.');
  }
}

/**
 * Analisa um edital com IA.
 *
 * @param {number} usuarioId
 * @param {string} filePath - Caminho do arquivo no disco
 * @param {string} fileName - Nome original do arquivo
 * @param {number} fileSize - Tamanho em bytes
 * @returns {Promise<Object>}
 */
async function analisarEdital(usuarioId, filePath, fileName, fileSize) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    // 1. Verificar créditos
    const creditoResult = await consumirCredito(usuarioId);
    if (!creditoResult.ok) return creditoResult;

    // 2. Criar registro da leitura
    const [leituraId] = await db('leituras_edital_ia').insert({
      usuario_id: usuarioId,
      nome_arquivo: fileName,
      tamanho_arquivo: fileSize || 0,
      caminho_arquivo: filePath,
      status: 'processando',
    });

    console.log(`[AI Reader] Iniciando análise ${leituraId} para user ${usuarioId}: ${fileName}`);

    // 3. Extrair texto do PDF
    let texto;
    try {
      texto = await extrairTextoPDF(filePath);
    } catch (e) {
      await db('leituras_edital_ia').where('id', leituraId).update({
        status: 'erro',
        erro_mensagem: e.message,
      });
      // Devolver crédito
      await db('usuario_creditos_ia').where('usuario_id', usuarioId).decrement('creditos_utilizados', 1);
      return { ok: false, error: e.message, leituraId };
    }

    if (!texto || texto.trim().length < 100) {
      await db('leituras_edital_ia').where('id', leituraId).update({
        status: 'erro',
        erro_mensagem: 'Não foi possível extrair texto suficiente do documento. Verifique se o PDF contém texto selecionável (não é imagem).',
      });
      await db('usuario_creditos_ia').where('usuario_id', usuarioId).decrement('creditos_utilizados', 1);
      return { ok: false, error: 'Documento sem texto extraível', leituraId };
    }

    // Limitar texto para não estourar tokens (~ 120k chars ≈ ~30k tokens)
    const textoTruncado = texto.length > 120000 ? texto.substring(0, 120000) + '\n\n[... texto truncado para análise ...]' : texto;

    // Salvar texto extraído
    await db('leituras_edital_ia').where('id', leituraId).update({
      texto_extraido: textoTruncado,
    });

    // 4. Analisar com OpenAI
    let resultado;
    try {
      const openai = await iaService.ensureReady();
      const params = await iaService.getParams();

      console.log(`[AI Reader] Chamando OpenAI (${params.model}) para análise...`);
      const response = await openai.chat.completions.create({
        model: params.model,
        messages: [
          { role: 'system', content: EDITAL_ANALYSIS_PROMPT },
          { role: 'user', content: `Analise o seguinte edital de licitação:\n\n${textoTruncado}` },
        ],
        temperature: 0.1,
        max_tokens: Math.min(4000, params.maxTokens),
        response_format: { type: 'json_object' },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error('OpenAI não retornou conteúdo');

      resultado = JSON.parse(content);
      console.log(`[AI Reader] Análise ${leituraId} concluída com sucesso`);
    } catch (e) {
      console.error('[AI Reader] Erro OpenAI:', e.message);
      await db('leituras_edital_ia').where('id', leituraId).update({
        status: 'erro',
        erro_mensagem: `Erro na análise IA: ${e.message}`,
      });
      // Devolver crédito em caso de erro da IA
      await db('usuario_creditos_ia').where('usuario_id', usuarioId).decrement('creditos_utilizados', 1);
      return { ok: false, error: `Erro na análise: ${e.message}`, leituraId };
    }

    // 5. Salvar resultado
    await db('leituras_edital_ia').where('id', leituraId).update({
      status: 'concluido',
      resultado: JSON.stringify(resultado),
    });

    // Buscar créditos atualizados
    const creditosAtuais = await getCreditosUsuario(usuarioId);

    return {
      ok: true,
      leituraId,
      resultado,
      creditos: creditosAtuais.creditos || null,
    };
  } catch (e) {
    console.error('[AI Reader] Erro analisarEdital:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CHAT SOBRE EDITAL
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Chat com IA sobre um edital analisado.
 */
async function chatEdital(leituraId, mensagem, historico, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    // Buscar leitura
    const leitura = await db('leituras_edital_ia')
      .where('id', leituraId)
      .where('usuario_id', usuarioId)
      .first();

    if (!leitura) return { ok: false, error: 'Leitura não encontrada' };
    if (leitura.status !== 'concluido') return { ok: false, error: 'Análise ainda não concluída' };

    const resultado = typeof leitura.resultado === 'string' ? JSON.parse(leitura.resultado) : leitura.resultado;

    const systemPrompt = `Você é um especialista em licitações públicas brasileiras. O usuário fez uma pergunta sobre um edital que você já analisou.

DADOS DA ANÁLISE:
${JSON.stringify(resultado, null, 2)}

TEXTO DO EDITAL (resumido):
${(leitura.texto_extraido || '').substring(0, 30000)}

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja preciso e baseie suas respostas nos dados do edital
- Se a informação não está no edital, diga claramente
- Use formatação markdown para melhor legibilidade
- Seja objetivo mas completo`;

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Adicionar histórico
    if (historico && Array.isArray(historico)) {
      for (const msg of historico.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: mensagem });

    const openai = await iaService.ensureReady();
    const params = await iaService.getParams();

    const response = await openai.chat.completions.create({
      model: params.model,
      messages,
      temperature: params.temperature,
      max_tokens: Math.min(1500, params.maxTokens),
    });

    const content = response.choices?.[0]?.message?.content || 'Não foi possível gerar uma resposta.';

    return { ok: true, resposta: content };
  } catch (e) {
    console.error('[AI Reader] Erro chatEdital:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTÓRICO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Lista as leituras do usuário.
 */
async function listarLeituras(usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const leituras = await db('leituras_edital_ia')
      .where('usuario_id', usuarioId)
      .orderBy('created_at', 'desc')
      .limit(50);

    return {
      ok: true,
      leituras: leituras.map((l) => ({
        id: l.id,
        nomeArquivo: l.nome_arquivo,
        tamanhoArquivo: l.tamanho_arquivo,
        status: l.status,
        erroMensagem: l.erro_mensagem,
        resultado: l.resultado ? (typeof l.resultado === 'string' ? JSON.parse(l.resultado) : l.resultado) : null,
        createdAt: l.created_at,
      })),
    };
  } catch (e) {
    console.error('[AI Reader] Erro listarLeituras:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Busca uma leitura específica.
 */
async function getLeitura(leituraId, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const leitura = await db('leituras_edital_ia')
      .where('id', leituraId)
      .where('usuario_id', usuarioId)
      .first();

    if (!leitura) return { ok: false, error: 'Leitura não encontrada' };

    return {
      ok: true,
      leitura: {
        id: leitura.id,
        nomeArquivo: leitura.nome_arquivo,
        tamanhoArquivo: leitura.tamanho_arquivo,
        status: leitura.status,
        erroMensagem: leitura.erro_mensagem,
        resultado: leitura.resultado ? (typeof leitura.resultado === 'string' ? JSON.parse(leitura.resultado) : leitura.resultado) : null,
        createdAt: leitura.created_at,
      },
    };
  } catch (e) {
    console.error('[AI Reader] Erro getLeitura:', e.message);
    return { ok: false, error: e.message };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _vencimento30dias() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  getCreditosUsuario,
  consumirCredito,
  getPacotes,
  comprarPacote,
  confirmarCompraPacote,
  analisarEdital,
  chatEdital,
  listarLeituras,
  getLeitura,
};
