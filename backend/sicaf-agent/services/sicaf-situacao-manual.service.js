/**
 * Processamento manual da Situação do Fornecedor (painel /clients),
 * mesma pipeline do Assistente: PDF → texto → IA → saveCertidoesToDB.
 */
const { getDb } = require('../database/connection');
const {
  assertClienteAcessivel,
  normalizeDocumento,
  formatCnpj,
  extractCnpjFromText,
  findClienteByDocumentoForUsuario,
} = require('./client-access.service');
const iaService = require('./ia.service');
const { saveCertidoesToDB } = require('../modules/sicaf-assistant/services/certidoes.service');
const { extractPdfText } = require('../utils/pdf-text');

async function readPdfText(fileBuffer, pdfParse) {
  if (pdfParse) {
    const pdfData = await pdfParse(fileBuffer);
    return pdfData.text || '';
  }
  return extractPdfText(fileBuffer);
}

function buildResultPayload(result, jsonData) {
  const niveisResumo = [];
  if (result.sicafStatus?.niveis) {
    for (const [nivel, info] of Object.entries(result.sicafStatus.niveis)) {
      const st = typeof info === 'object' ? (info.status || '—') : info;
      niveisResumo.push({ nivel, status: st });
    }
  }

  return {
    ok: true,
    message: 'PDF processado e níveis SICAF atualizados com sucesso.',
    clienteId: result.clienteId,
    clienteNome: result.clienteNome,
    cnpj: result.cnpj,
    certidoesInserted: result.certidoesInserted,
    certidoesUpdated: result.certidoesUpdated,
    certidoesCount: result.certidoesCount,
    niveisAfetados: result.niveisAfetados || [],
    sicafStatus: result.sicafStatus,
    niveisResumo,
    tipoDocumento: jsonData.tipo_documento || null,
  };
}

/**
 * Pipeline compartilhada com POST /api/sicaf-assistant/upload (extração + persistência).
 */
async function processarTextoExtracao({ clienteId, extractedText, fileName, usuarioId }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  if (!extractedText || extractedText.trim().length < 20) {
    return {
      ok: false,
      error: 'Não foi possível extrair texto do PDF. O arquivo pode ser imagem escaneada sem OCR.',
    };
  }

  if (!(await iaService.isReady())) {
    return { ok: false, error: 'Serviço de IA não configurado. Configure em Admin → Configurações → IA.' };
  }

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
  if (!sicaf) {
    return {
      ok: false,
      error: 'Este cliente ainda não possui cadastro SICAF. Cadastre o SICAF antes de enviar o documento.',
    };
  }

  const truncatedText = extractedText.substring(0, 12000);
  const isSituacaoFornecedor = /Situa[çc][ãa]o do Fornecedor/i.test(truncatedText);

  console.log(
    `  [SicafManual] Extraindo IA — cliente #${clienteId} (${cliente.razao_social}) | arquivo: ${fileName || 'documento.pdf'}`
  );

  const jsonData = await iaService.extractCertidoesJSON(truncatedText);
  if (!jsonData) {
    return {
      ok: false,
      error: 'A IA não conseguiu estruturar os dados do PDF. Verifique se é a Situação do Fornecedor completa.',
    };
  }

  const cnpjPdf = jsonData.cnpj || extractCnpjFromText(truncatedText);
  if (!cnpjPdf) {
    return {
      ok: false,
      error: 'Não foi possível identificar o CNPJ no PDF. Envie a Situação do Fornecedor completa.',
    };
  }
  if (normalizeDocumento(cnpjPdf) !== normalizeDocumento(cliente.documento)) {
    return {
      ok: false,
      error: `O CNPJ do PDF (${formatCnpj(cnpjPdf)}) não corresponde ao cadastro selecionado (${formatCnpj(cliente.documento)}).`,
    };
  }
  jsonData.cnpj = formatCnpj(cnpjPdf);
  jsonData.razao_social = jsonData.razao_social || cliente.razao_social;
  if (isSituacaoFornecedor || /situa[çc][ãa]o do fornecedor/i.test(truncatedText)) {
    jsonData.tipo_documento = 'Situação do Fornecedor';
  }

  const result = await saveCertidoesToDB(jsonData);
  if (!result.saved) {
    return { ok: false, error: result.reason || 'Não foi possível salvar os dados no banco.' };
  }

  if (Number(result.clienteId) !== Number(clienteId)) {
    return {
      ok: false,
      error: 'O CNPJ do PDF não corresponde a este cliente. Envie o documento da empresa correta.',
    };
  }

  console.log(
    `  [SicafManual] ✔ Cliente #${clienteId}: ${result.certidoesCount} certidões | SICAF ${result.sicafStatus?.status || '?'} (${result.sicafStatus?.completude || 0}%)`
  );

  return buildResultPayload(result, jsonData);
}

/**
 * Processa buffer PDF já extraído do upload (multer / parseMultipart).
 */
async function processarPdfBufferForCliente({
  clienteId,
  fileBuffer,
  fileName,
  usuarioId,
  pdfParse,
}) {
  if (!fileBuffer || fileBuffer.length < 100) {
    return { ok: false, error: 'Arquivo PDF inválido ou vazio.' };
  }

  const ext = (fileName || '').toLowerCase().split('.').pop();
  if (ext !== 'pdf') {
    return { ok: false, error: 'Envie o documento em formato PDF.' };
  }

  let extractedText = '';
  try {
    extractedText = await readPdfText(fileBuffer, pdfParse);
  } catch (pdfErr) {
    return { ok: false, error: 'Erro ao ler PDF: ' + pdfErr.message };
  }

  try {
    return await processarTextoExtracao({
      clienteId,
      extractedText,
      fileName: fileName || 'situacao-fornecedor.pdf',
      usuarioId,
    });
  } catch (e) {
    console.error('[SicafManual] Erro:', e.message);
    return { ok: false, error: 'Erro ao processar: ' + e.message };
  }
}

function buildAnaliseFallback(jsonData, pdfText = '') {
  const enriched = iaService.enrichSicafJsonFromText(
    { ...jsonData, certidoes: [...(jsonData?.certidoes || [])] },
    pdfText,
  );
  const pendencias = [];
  const niveis = enriched?.niveis_sicaf || {};
  const niveisStatus = [];

  const NIVEL_NOMES = {
    I: 'Credenciamento',
    II: 'Habilitação Jurídica',
    III: 'Regularidade Fiscal e Trabalhista Federal',
    IV: 'Regularidade Fiscal Estadual/Distrital e Municipal',
    V: 'Qualificação Técnica',
    VI: 'Qualificação Econômico-Financeira',
  };

  for (const nivel of ['I', 'II', 'III', 'IV', 'V', 'VI']) {
    const info = niveis[nivel];
    const nome = info?.descricao || NIVEL_NOMES[nivel] || `Nível ${nivel}`;
    if (!info) {
      niveisStatus.push({
        nivel,
        nome: NIVEL_NOMES[nivel] || `Nível ${nivel}`,
        status: 'Não habilitado',
        observacao: null,
      });
      continue;
    }

    const sit = String(info.situacao || 'Regular');
    niveisStatus.push({
      nivel,
      nome: info.descricao || `Nível ${nivel}`,
      status: sit,
      observacao: sit === 'Regular' ? null : info.descricao,
    });

    const sitLower = sit.toLowerCase();
    if (sitLower === 'regular' || sitLower === 'não habilitado' || sitLower === 'nao habilitado') continue;

    pendencias.push({
      nivel,
      titulo: info.descricao || `Nível ${nivel}`,
      tipo: 'nivel',
      problema:
        sitLower.includes('vencido') || sitLower.includes('pendente')
          ? `${info.descricao || `Nível ${nivel}`}: situação "${info.situacao}"${info.validade ? ` (validade ${info.validade})` : ''}.`
          : `Nível ${nivel} com situação: ${info.situacao}`,
      prioridade: sitLower.includes('venc') ? 'alta' : 'media',
      solucao:
        nivel === 'IV'
          ? 'Renovar certidões estadual e municipal nos órgãos emissores e reenviar no portal SICAF, nível IV.'
          : nivel === 'VI'
            ? 'Atualizar balanço patrimonial, DRE e certidão negativa de falência via contador e reenviar no SICAF, nível VI.'
            : 'Regularize os documentos deste nível no portal SICAF ou envie certidões atualizadas.',
      onde_resolver: nivel === 'VI' ? 'Contador / Portal SICAF' : 'Portal SICAF',
    });
  }

  for (const cert of enriched?.certidoes || []) {
    const sit = String(cert?.situacao || '').toLowerCase();
    if (!sit.includes('pend') && !sit.includes('venc') && !sit.includes('positiva')) continue;
    if (pendencias.some((p) => p.tipo === 'certidao' && p.titulo === cert.nome)) continue;
    pendencias.push({
      nivel: cert.nivel_sicaf || null,
      titulo: cert.nome || 'Certidão',
      tipo: 'certidao',
      problema: `${cert.nome}${cert.data_validade ? ` — validade ${cert.data_validade}` : ''}: ${cert.situacao}`,
      prioridade: sit.includes('venc') ? 'alta' : 'media',
      solucao: cert.orgao_emissor
        ? `Renovar junto a ${cert.orgao_emissor} e atualizar no SICAF (nível ${cert.nivel_sicaf || 'correspondente'}).`
        : 'Renovar a certidão no órgão emissor e reenviar no SICAF.',
      onde_resolver: cert.orgao_emissor || 'Órgão emissor',
    });
  }

  const niveisOk = niveisStatus.filter((n) => n.status === 'Regular').map((n) => n.nivel);
  const niveisProblema = niveisStatus.filter((n) => ['Pendente', 'Vencido'].includes(n.status)).map((n) => n.nivel);

  return {
    resumo:
      pendencias.length > 0
        ? `CNPJ ${jsonData?.cnpj || '—'}: foram identificadas ${pendencias.length} pendência(s). Níveis regulares: ${niveisOk.join(', ') || '—'}. Com problema: ${niveisProblema.join(', ') || '—'}.`
        : `CNPJ ${jsonData?.cnpj || '—'}: todos os níveis habilitados estão regulares (${niveisOk.join(', ') || 'I a VI'}).`,
    status_geral: pendencias.length > 0 ? (niveisProblema.length > 1 ? 'Misto' : 'Pendente') : 'Regular',
    cnpj: jsonData?.cnpj || null,
    razao_social: jsonData?.razao_social || null,
    niveis_status: niveisStatus,
    pendencias,
    proximos_passos:
      pendencias.length > 0
        ? [
            'Priorize certidões vencidas (marcadas com * no PDF).',
            'Renove nos órgãos emissores e atualize no portal SICAF.',
            'Emita nova Situação do Fornecedor após regularizar.',
          ]
        : ['Mantenha as certidões monitoradas.', 'Agende renovação antes do vencimento.'],
    observacoes: null,
  };
}

function resolveCnpjFromPdf(jsonData, pdfText) {
  const fromIa = jsonData?.cnpj ? formatCnpj(jsonData.cnpj) : null;
  const fromText = extractCnpjFromText(pdfText);
  const cnpjFinal = fromIa || fromText;
  if (!cnpjFinal) return { cnpj: null, metodo: null };

  const metodo =
    fromIa && fromText && normalizeDocumento(fromIa) === normalizeDocumento(fromText)
      ? 'IA + texto do PDF (conferidos)'
      : fromIa
        ? 'extração via IA do PDF'
        : 'regex no texto do PDF';

  return { cnpj: formatCnpj(cnpjFinal), metodo };
}

async function runAnaliseProblemaCore({
  clienteId,
  cliente,
  fileBuffer,
  fileName,
  usuarioId,
  pdfParse,
  preExtractedText,
  preJsonData,
}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  if (!(await iaService.isReady())) {
    return { ok: false, error: 'Serviço de IA não configurado. Configure em Admin → Configurações → IA.' };
  }

  let extractedText = preExtractedText || '';
  if (!extractedText) {
    if (!fileBuffer || fileBuffer.length < 100) {
      return { ok: false, error: 'Arquivo PDF inválido ou vazio.' };
    }
    const ext = (fileName || '').toLowerCase().split('.').pop();
    if (ext !== 'pdf') {
      return { ok: false, error: 'Envie o documento em formato PDF.' };
    }
    try {
      extractedText = await readPdfText(fileBuffer, pdfParse);
    } catch (pdfErr) {
      return { ok: false, error: 'Erro ao ler PDF: ' + pdfErr.message };
    }
  }

  if (!extractedText || extractedText.trim().length < 20) {
    return {
      ok: false,
      error: 'Não foi possível extrair texto do PDF. O arquivo pode ser imagem escaneada sem OCR.',
    };
  }

  const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
  if (!sicaf) {
    return {
      ok: false,
      error: 'Este cliente ainda não possui cadastro SICAF. Cadastre o SICAF antes de analisar o documento.',
    };
  }

  const truncatedText = extractedText.substring(0, 12000);
  let jsonData = preJsonData;
  if (!jsonData) {
    jsonData = await iaService.extractCertidoesJSON(truncatedText);
    if (!jsonData) {
      return {
        ok: false,
        error: 'A IA não conseguiu estruturar os dados do PDF. Verifique se é a Situação do Fornecedor completa.',
      };
    }
  }

  const { cnpj: cnpjPdf, metodo: metodoExtracao } = resolveCnpjFromPdf(jsonData, truncatedText);
  if (!cnpjPdf) {
    return {
      ok: false,
      error: 'Não foi possível identificar o CNPJ no PDF. Envie a Situação do Fornecedor completa.',
    };
  }
  if (normalizeDocumento(cnpjPdf) !== normalizeDocumento(cliente.documento)) {
    return {
      ok: false,
      error: `O CNPJ do PDF (${cnpjPdf}) não corresponde ao cadastro selecionado (${formatCnpj(cliente.documento)}).`,
    };
  }

  jsonData.cnpj = cnpjPdf;
  jsonData.razao_social = jsonData.razao_social || cliente.razao_social;
  if (/situa[çc][ãa]o do fornecedor/i.test(truncatedText)) {
    jsonData.tipo_documento = 'Situação do Fornecedor';
  }

  let analise = await iaService.analyzeSicafProblema(jsonData, truncatedText);
  if (!analise) {
    analise = buildAnaliseFallback(jsonData, truncatedText);
  }

  const cnpjAnalisado = cnpjPdf;
  const razaoSocial = jsonData.razao_social || cliente.razao_social;
  const validacao = {
    processo: 'CNPJ identificado no PDF e conferido com seus cadastros',
    metodo_extracao: metodoExtracao,
    cnpj_identificado: cnpjAnalisado,
    cnpj_cadastro: formatCnpj(cliente.documento),
    empresa: razaoSocial,
    status: 'conferido',
  };

  analise = {
    ...analise,
    cnpj: cnpjAnalisado,
    razao_social: razaoSocial,
    cliente_id: clienteId,
    tipo_documento: jsonData.tipo_documento || 'Situação do Fornecedor',
    arquivo_nome: fileName || 'situacao-fornecedor.pdf',
    analisado_em: new Date().toISOString(),
    validacao,
  };

  let savePayload = null;
  let saveWarning = null;
  try {
    const result = await saveCertidoesToDB(jsonData);
    if (result.saved && Number(result.clienteId) === Number(clienteId)) {
      savePayload = buildResultPayload(result, jsonData);
    } else if (result.saved && Number(result.clienteId) !== Number(clienteId)) {
      saveWarning =
        'Análise concluída, mas o CNPJ do PDF não corresponde a este cliente — níveis não foram atualizados no cadastro.';
    } else {
      saveWarning = result.reason || 'Análise concluída, porém não foi possível atualizar o cadastro automaticamente.';
    }
  } catch (saveErr) {
    saveWarning = 'Análise concluída, mas houve erro ao salvar no cadastro: ' + saveErr.message;
  }

  console.log(
    `  [SicafAnalise] Cliente #${clienteId}: ${analise.pendencias?.length || 0} pendência(s) | save=${!!savePayload}`
  );

  const sicafAnalisesService = require('./sicaf-analises.service');
  const analiseSalva = await sicafAnalisesService.saveAnalise({
    clienteId,
    usuarioId,
    fileName: fileName || 'situacao-fornecedor.pdf',
    analise,
    savePayload,
    saveWarning,
  });

  return {
    ok: true,
    message: savePayload
      ? 'Análise concluída e níveis SICAF atualizados.'
      : 'Análise concluída.',
    cnpj: cnpjAnalisado,
    razaoSocial,
    clienteId,
    validacao,
    analise,
    analiseId: analiseSalva?.id || null,
    saveWarning,
    ...(savePayload || {
      certidoesInserted: 0,
      certidoesUpdated: 0,
      certidoesCount: jsonData.certidoes?.length || 0,
      niveisResumo: Object.entries(jsonData.niveis_sicaf || {}).map(([nivel, info]) => ({
        nivel,
        status: info?.situacao || '—',
      })),
    }),
  };
}

async function analisarProblemaPdfForCliente({
  clienteId,
  fileBuffer,
  fileName,
  usuarioId,
  pdfParse,
}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  return runAnaliseProblemaCore({
    clienteId,
    cliente,
    fileBuffer,
    fileName,
    usuarioId,
    pdfParse,
  });
}

async function analisarProblemaPdfForUsuario({
  fileBuffer,
  fileName,
  usuarioId,
  pdfParse,
}) {
  if (!fileBuffer || fileBuffer.length < 100) {
    return { ok: false, error: 'Arquivo PDF inválido ou vazio.' };
  }

  const ext = (fileName || '').toLowerCase().split('.').pop();
  if (ext !== 'pdf') {
    return { ok: false, error: 'Envie o documento em formato PDF.' };
  }

  let extractedText = '';
  try {
    extractedText = await readPdfText(fileBuffer, pdfParse);
  } catch (pdfErr) {
    return { ok: false, error: 'Erro ao ler PDF: ' + pdfErr.message };
  }

  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  if (!extractedText || extractedText.trim().length < 20) {
    return {
      ok: false,
      error: 'Não foi possível extrair texto do PDF. O arquivo pode ser imagem escaneada sem OCR.',
    };
  }

  if (!(await iaService.isReady())) {
    return { ok: false, error: 'Serviço de IA não configurado. Configure em Admin → Configurações → IA.' };
  }

  const truncatedText = extractedText.substring(0, 12000);
  const jsonData = await iaService.extractCertidoesJSON(truncatedText);
  if (!jsonData) {
    return {
      ok: false,
      error: 'A IA não conseguiu estruturar os dados do PDF. Verifique se é a Situação do Fornecedor completa.',
    };
  }

  const { cnpj: cnpjPdf, metodo: metodoExtracao } = resolveCnpjFromPdf(jsonData, truncatedText);
  if (!cnpjPdf) {
    return {
      ok: false,
      error: 'Não foi possível identificar o CNPJ no PDF. Envie a Situação do Fornecedor completa.',
    };
  }

  const cliente = await findClienteByDocumentoForUsuario(db, cnpjPdf, usuarioId);
  if (!cliente) {
    return {
      ok: false,
      error: `O CNPJ ${cnpjPdf} identificado no PDF não está cadastrado nas suas empresas. Envie a Situação do Fornecedor de um CNPJ vinculado à sua conta.`,
      cnpjIdentificado: cnpjPdf,
      metodoExtracao,
    };
  }

  return runAnaliseProblemaCore({
    clienteId: cliente.id,
    cliente,
    fileBuffer,
    fileName,
    usuarioId,
    pdfParse,
    preExtractedText: extractedText,
    preJsonData: jsonData,
  });
}

module.exports = {
  processarPdfBufferForCliente,
  processarTextoExtracao,
  analisarProblemaPdfForCliente,
  analisarProblemaPdfForUsuario,
};
