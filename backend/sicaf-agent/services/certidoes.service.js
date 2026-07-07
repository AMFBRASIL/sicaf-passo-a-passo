/**
 * Certidões / tipos SICAF — portado do clients.service.js (legado).
 */
const { getDb } = require('../database/connection');
const { assertClienteAcessivel } = require('./client-access.service');
const { getDiasAvisoAntecedencia } = require('./sicaf-config.service');
const {
  buildNiveisDetailFromRows,
  nivelValidadoComValidadePdf,
  extractValidadeFromObservacao,
} = require('../utils/nivel-status');

const ROMAN_TO_NUM = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

const SICAF_TIPO_DEFAULTS = {
  contrato_social: { nome: 'Contrato Social / Ato Constitutivo', descricao: 'Ato constitutivo ou contrato social', nivel_sicaf: 'I', orgao_emissor: 'Junta Comercial / Cartório' },
  documento_identidade: { nome: 'Documento de Identidade do Representante', descricao: 'RG ou documento equivalente do representante legal', nivel_sicaf: 'I', orgao_emissor: 'Órgão emissor' },
  estatuto_consolidado: { nome: 'Estatuto / Contrato Social Consolidado', descricao: 'Estatuto ou contrato social consolidado', nivel_sicaf: 'II', orgao_emissor: 'Junta Comercial' },
  certidao_junta_comercial: { nome: 'Certidão Simplificada da Junta Comercial', descricao: 'Certidão simplificada da Junta Comercial', nivel_sicaf: 'II', orgao_emissor: 'Junta Comercial' },
  cnd_federal: { nome: 'CND Federal', descricao: 'Certidão Negativa de Débitos Federais', nivel_sicaf: 'III', orgao_emissor: 'Receita Federal' },
  crf_fgts: { nome: 'Certificado de Regularidade FGTS (CRF)', descricao: 'Certificado de Regularidade do FGTS', nivel_sicaf: 'III', orgao_emissor: 'Caixa Econômica Federal' },
  cndt_trabalhista: { nome: 'CNDT Trabalhista', descricao: 'Certidão Negativa de Débitos Trabalhistas', nivel_sicaf: 'III', orgao_emissor: 'Tribunal Superior do Trabalho' },
  inscricao_municipal: { nome: 'Inscrição Municipal', descricao: 'Comprovante de inscrição municipal (ISS)', nivel_sicaf: 'IV', orgao_emissor: 'Prefeitura Municipal' },
  inscricao_estadual: { nome: 'Inscrição Estadual', descricao: 'Comprovante de inscrição estadual (ICMS)', nivel_sicaf: 'IV', orgao_emissor: 'Secretaria da Fazenda Estadual' },
  cnd_estadual: { nome: 'Certidão Negativa Estadual', descricao: 'CND Estadual (ICMS)', nivel_sicaf: 'IV', orgao_emissor: 'Secretaria da Fazenda Estadual' },
  cnd_municipal: { nome: 'Certidão Negativa Municipal', descricao: 'CND Municipal (ISS)', nivel_sicaf: 'IV', orgao_emissor: 'Prefeitura Municipal' },
  atestado_tecnico: { nome: 'Atestado de Qualificação Técnica', descricao: 'Atestado de capacidade técnica', nivel_sicaf: 'V', orgao_emissor: 'Contratante / Órgão emissor' },
  balanco_patrimonial: { nome: 'Balanço Patrimonial', descricao: 'Balanço patrimonial da empresa', nivel_sicaf: 'VI', orgao_emissor: 'Contabilidade / Empresa' },
};

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getDocUploadRules(codigo, nivel) {
  if (nivel === 'III') {
    return { requerCodigo: false, requerValidade: false, uploadManual: false };
  }
  if (['inscricao_municipal', 'inscricao_estadual'].includes(codigo)) {
    return { requerCodigo: true, requerValidade: false, uploadManual: true };
  }
  if (['cnd_municipal', 'cnd_estadual'].includes(codigo)) {
    return { requerCodigo: true, requerValidade: true, uploadManual: true };
  }
  return { requerCodigo: false, requerValidade: false, uploadManual: true };
}

function resolveTipoUploadRules(tipo) {
  const fromDb = {
    requerCodigo: tipo.requer_codigo != null ? !!tipo.requer_codigo : null,
    requerValidade: tipo.requer_validade != null ? !!tipo.requer_validade : null,
    uploadManual: tipo.upload_manual != null ? !!tipo.upload_manual : null,
  };
  const computed = getDocUploadRules(tipo.codigo, tipo.nivel_sicaf);
  return {
    requerCodigo: fromDb.requerCodigo ?? computed.requerCodigo,
    requerValidade: fromDb.requerValidade ?? computed.requerValidade,
    uploadManual: fromDb.uploadManual ?? computed.uploadManual,
  };
}

async function ensureSicafTipoCertidoes() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco não disponível' };

  for (const codigo of Object.keys(SICAF_TIPO_DEFAULTS)) {
    const meta = SICAF_TIPO_DEFAULTS[codigo];
    const existing = await db('tipo_certidoes').where('codigo', codigo).first();
    if (!existing) {
      await db('tipo_certidoes').insert({
        codigo,
        nome: meta.nome,
        descricao: meta.descricao,
        nivel_sicaf: meta.nivel_sicaf,
        orgao_emissor: meta.orgao_emissor,
        ativo: 1,
      });
      continue;
    }
    const patch = {};
    if (existing.nivel_sicaf !== meta.nivel_sicaf) patch.nivel_sicaf = meta.nivel_sicaf;
    if (existing.ativo !== 1) patch.ativo = 1;
    if (Object.keys(patch).length > 0) {
      patch.updated_at = db.fn.now();
      await db('tipo_certidoes').where('id', existing.id).update(patch);
    }
  }
  return { ok: true };
}

async function getTipoCertidoes() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    await ensureSicafTipoCertidoes();
    const tipos = await db('tipo_certidoes').where('ativo', 1).orderBy('nivel_sicaf', 'asc').orderBy('nome', 'asc');
    const porNivel = {};
    for (const tipo of tipos) {
      const nivel = tipo.nivel_sicaf || 'Geral';
      if (!porNivel[nivel]) porNivel[nivel] = [];
      const uploadRules = resolveTipoUploadRules(tipo);
      porNivel[nivel].push({
        id: tipo.id,
        codigo: tipo.codigo,
        nome: tipo.nome,
        descricao: tipo.descricao,
        nivelSicaf: tipo.nivel_sicaf,
        orgaoEmissor: tipo.orgao_emissor,
        ...uploadRules,
        hasExpiry: uploadRules.requerValidade,
      });
    }
    return { ok: true, tipos, porNivel };
  } catch (e) {
    console.error('[Certidoes] Erro getTipoCertidoes:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

async function insertCertidao({ clienteId, tipoCertidaoId, numero, dataEmissao, dataValidade, arquivoUrl, arquivoNome, arquivoTamanho }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const cliente = await db('clientes').where('id', clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    const tipo = await db('tipo_certidoes').where('id', tipoCertidaoId).first();
    if (!tipo) return { ok: false, error: 'Tipo de certidão não encontrado' };

    const uploadRules = resolveTipoUploadRules(tipo);
    if (!uploadRules.uploadManual) {
      return { ok: false, error: 'Este documento é atualizado automaticamente pelo Assistente SICAF.' };
    }
    if (uploadRules.requerCodigo && !String(numero || '').trim()) {
      return { ok: false, error: 'Informe o código da certidão' };
    }
    if (uploadRules.requerValidade && !dataValidade) {
      return { ok: false, error: 'Informe a data de validade da certidão' };
    }
    if (!arquivoUrl) {
      return { ok: false, error: 'Envie o PDF da certidão' };
    }

    const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();

    let status = 'Válida';
    let diasRestantes = 0;
    if (dataValidade) {
      const now = new Date();
      const validade = new Date(dataValidade);
      const diffMs = validade.getTime() - now.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diasRestantes < 0) status = 'Vencida';
      else if (diasRestantes <= 30) status = 'Vencendo';
    }

    const existente = await db('certidoes')
      .where('cliente_id', clienteId)
      .where('tipo_certidao_id', tipoCertidaoId)
      .first();

    let certidaoId;
    if (existente) {
      await db('certidoes').where('id', existente.id).update({
        numero: numero || existente.numero,
        nivel_sicaf: tipo.nivel_sicaf || existente.nivel_sicaf,
        data_emissao: dataEmissao || new Date().toISOString().slice(0, 10),
        data_validade: dataValidade || null,
        status,
        dias_restantes: diasRestantes,
        arquivo_url: arquivoUrl || existente.arquivo_url,
        arquivo_nome: arquivoNome || existente.arquivo_nome,
        arquivo_tamanho: arquivoTamanho || existente.arquivo_tamanho,
        updated_at: db.fn.now(),
      });
      certidaoId = existente.id;
    } else {
      [certidaoId] = await db('certidoes').insert({
        cliente_id: clienteId,
        sicaf_id: sicaf ? sicaf.id : null,
        tipo_certidao_id: tipoCertidaoId,
        numero: numero || null,
        nivel_sicaf: tipo.nivel_sicaf || null,
        data_emissao: dataEmissao || new Date().toISOString().slice(0, 10),
        data_validade: dataValidade || null,
        status,
        dias_restantes: diasRestantes,
        auto_renovar: 0,
        arquivo_url: arquivoUrl || null,
        arquivo_nome: arquivoNome || null,
        arquivo_tamanho: arquivoTamanho || null,
      });
    }

    return {
      ok: true,
      certidaoId,
      updated: !!existente,
      message: existente ? 'Certidão atualizada com sucesso' : 'Certidão inserida com sucesso',
    };
  } catch (e) {
    console.error('[Certidoes] Erro insertCertidao:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

function statusFromValidadeDate(dataValidade, now, msAviso) {
  if (!dataValidade) return null;
  const validadeDt = new Date(dataValidade);
  if (Number.isNaN(validadeDt.getTime())) return null;
  if (validadeDt < now) return 'vencida';
  if (validadeDt.getTime() - now.getTime() <= msAviso) return 'vencendo';
  return 'ok';
}

/** Alinha com /certidoes: usa registro em certidoes mesmo sem PDF anexado. */
function resolveChecklistItemStatus(cert, docMatch, now, msAviso) {
  if (cert) {
    const fromDate = statusFromValidadeDate(cert.data_validade, now, msAviso);
    if (fromDate) return fromDate;
    const certSt = String(cert.status || '').toLowerCase();
    if (certSt.includes('vencid')) return 'vencida';
    if (certSt.includes('vencendo') || certSt.includes('a vencer')) return 'vencendo';
    if (cert.arquivo_url || certSt.includes('valid') || certSt.includes('válid')) return 'ok';
    if (cert.data_emissao || cert.numero) return 'ok';
  }
  if (docMatch?.arquivo_url) {
    const fromDate = statusFromValidadeDate(docMatch.data_validade, now, msAviso);
    if (fromDate) return fromDate;
    return 'ok';
  }
  return 'pendente';
}

async function buildChecklistDocumentos(db, cliente) {
  const clienteId = cliente.id;
  await ensureSicafTipoCertidoes();
  const diasAviso = await getDiasAvisoAntecedencia();
  const msAviso = diasAviso * 24 * 60 * 60 * 1000;

  const tipos = await db('tipo_certidoes').where('ativo', 1).orderBy('nivel_sicaf', 'asc').orderBy('nome', 'asc');
  const certidoes = await db('certidoes').where('cliente_id', clienteId);
  const certByTipo = {};
  for (const c of certidoes) {
    if (c.tipo_certidao_id) certByTipo[c.tipo_certidao_id] = c;
  }

  const documentos = await db('documentos')
    .where('cliente_id', clienteId)
    .whereNull('deleted_at')
    .orderBy('data_upload', 'desc');

  const docsPorNivel = {};
  const now = new Date();

  const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();

  let niveisDetail = {};
  if (sicaf?.id) {
    try {
      const nivelRows = await db('sicaf_niveis')
        .where('sicaf_id', sicaf.id)
        .select('nivel', 'habilitado', 'status', 'observacao');
      niveisDetail = buildNiveisDetailFromRows(nivelRows);
    } catch (_) {}
  }

  for (const tipo of tipos) {
    const rules = resolveTipoUploadRules(tipo);

    const num = ROMAN_TO_NUM[tipo.nivel_sicaf];
    if (!num) continue;

    const cert = certByTipo[tipo.id];
    const docMatch = documentos.find(
      (d) =>
        d.nivel_sicaf === tipo.nivel_sicaf &&
        (d.nome === tipo.nome ||
          String(d.nome || '')
            .toLowerCase()
            .includes(String(tipo.codigo || '').replace(/_/g, ' '))),
    );

    const status = resolveChecklistItemStatus(cert, docMatch, now, msAviso);
    let dataValidadeRaw = cert?.data_validade || docMatch?.data_validade || null;
    let resolvedStatus = status;

    if (
      tipo.codigo === 'balanco_patrimonial' &&
      nivelValidadoComValidadePdf(niveisDetail, 'VI')
    ) {
      resolvedStatus = 'ok';
      if (!dataValidadeRaw) {
        const validadePdf = extractValidadeFromObservacao(niveisDetail.VI?.observacao);
        if (validadePdf) {
          const [dd, mm, yyyy] = validadePdf.split('/');
          dataValidadeRaw = `${yyyy}-${mm}-${dd}`;
        }
      }
    }

    const validade = dataValidadeRaw ? fmtDate(dataValidadeRaw) : resolvedStatus === 'pendente' ? undefined : '—';
    const arquivoUrl = cert?.arquivo_url || docMatch?.arquivo_url || null;
    const codigoCertidao = cert?.numero || null;

    if (!docsPorNivel[num]) docsPorNivel[num] = [];
    docsPorNivel[num].push({
      id: String(tipo.id),
      tipoCertidaoId: tipo.id,
      codigo: tipo.codigo,
      nome: tipo.nome,
      descricao: tipo.descricao || '',
      nivelSicaf: tipo.nivel_sicaf,
      orgaoEmissor: tipo.orgao_emissor || null,
      status: resolvedStatus,
      validade,
      dataValidade: dataValidadeRaw,
      codigoCertidao,
      arquivoUrl,
      requerValidade: rules.requerValidade,
      requerCodigo: rules.requerCodigo,
      uploadManual: rules.uploadManual,
    });
  }

  return {
    ok: true,
    cliente: {
      id: cliente.id,
      razaoSocial: cliente.razao_social,
      documento: cliente.documento,
      email: cliente.email,
      telefone: cliente.telefone,
      endereco: cliente.endereco,
      cidade: cliente.cidade,
      estado: cliente.estado,
      inscricaoEstadual: cliente.inscricao_estadual,
      inscricaoMunicipal: cliente.inscricao_municipal,
      ramoAtividade: cliente.ramo_atividade,
    },
    sicafStatus: sicaf?.status || 'Sem SICAF',
    docsPorNivel,
  };
}

async function getChecklistDocumentos(clienteId, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  return buildChecklistDocumentos(db, cliente);
}

async function getChecklistDocumentosAdmin(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  return buildChecklistDocumentos(db, cliente);
}

module.exports = {
  getTipoCertidoes,
  insertCertidao,
  getChecklistDocumentos,
  getChecklistDocumentosAdmin,
  ensureSicafTipoCertidoes,
};
