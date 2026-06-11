/**
 * Serviço centralizado de Pagamentos — CadBrasil.
 *
 * Integra com:
 *  - gerencianet.service.js (geração de boleto/PIX)
 *  - tabela pagamentos (v2 — provider-agnóstico)
 *  - tabelas de origem (taxas_sicaf, manutencao_boletos — atualiza status)
 *
 * Uso:
 *   const pagamentosService = require('./services/pagamentos.service');
 *   const result = await pagamentosService.gerarBoletoSicaf({ clienteId, taxaId, ... });
 *   const result = await pagamentosService.gerarPixManutencao({ clienteId, boletoId, ... });
 *   const list = await pagamentosService.listarPagamentos({ clienteId });
 */
const { getDb } = require('../database/connection');
const gerencianetService = require('./gerencianet.service');

const PAGAMENTOS_TABLE = 'pagamentos';
const PAYMENT_PROVIDER = 'gerencianet';

function pagamentosQuery(db) {
  return db(PAGAMENTOS_TABLE).whereNull('deleted_at');
}

function basePagamentoInsert(fields) {
  return { provider: PAYMENT_PROVIDER, ...fields };
}

function pagamentoErroUpdate(message) {
  return { status: 'erro', provider_error: message };
}

function pagamentoBoletoGeradoUpdate(chargeId, barcode, link, pdf, gnResponse) {
  return {
    status: 'gerado',
    provider_charge_id: chargeId != null ? String(chargeId) : null,
    barcode: barcode || null,
    link_boleto: link || null,
    link_pdf: pdf || null,
    provider_response: gnResponse ? JSON.stringify(gnResponse) : null,
  };
}

function pagamentoPixGeradoUpdate(txid, locId, qrcodeText, qrcodeImage, gnResponse) {
  return {
    status: 'gerado',
    provider_txid: txid || null,
    provider_loc_id: locId != null ? String(locId) : null,
    qrcode_text: qrcodeText || null,
    qrcode_image: qrcodeImage || null,
    provider_response: gnResponse ? JSON.stringify(gnResponse) : null,
  };
}

function mapPagamentoRowToApi(r) {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    origem: r.origem,
    origemId: r.origem_id,
    tipo: r.tipo,
    valor: parseFloat(r.valor),
    descricao: r.descricao,
    protocolo: r.protocolo,
    dataVencimento: r.data_vencimento,
    dataPagamento: r.data_pagamento,
    status: r.status,
    gnChargeId: r.provider_charge_id,
    gnBarcode: r.barcode,
    gnLink: r.link_boleto,
    gnPdf: r.link_pdf,
    gnTxid: r.provider_txid,
    gnQrcodeText: r.qrcode_text,
    gnQrcodeImage: r.qrcode_image,
    gnError: r.provider_error,
    clienteNome: r.cliente_nome,
    clienteDocumento: r.cliente_documento,
    createdAt: r.created_at,
  };
}

function toIsoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function todayIsoDate() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate()).toISOString().slice(0, 10);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Multa 2% + juros de mora 1% ao mês (proporcional aos dias de atraso). */
const MULTA_PERCENT_VENCIDO = 2;
const JUROS_MENSAL_PERCENT_VENCIDO = 1;

function extractValorPrincipalBoleto(boleto) {
  const num = String(boleto?.numero_boleto || '');
  const match = num.match(/@VB([\d]+(?:\.[\d]{1,2})?)$/);
  if (match) return roundMoney(parseFloat(match[1]));
  return roundMoney(parseFloat(boleto?.valor) || 0);
}

function withValorPrincipalMarker(numeroBoleto, valorPrincipal) {
  const base = String(numeroBoleto || '').replace(/@VB[\d.]+$/, '');
  return `${base}@VB${roundMoney(valorPrincipal).toFixed(2)}`;
}

function isBoletoManutencaoVencido(boleto) {
  const st = String(boleto?.status || '').trim();
  if (['Pago', 'pago', 'Cancelado', 'cancelado'].includes(st)) return false;
  if (['Atrasado', 'atrasado', 'Vencido', 'vencido'].includes(st)) return true;
  const due = toIsoDate(boleto?.data_vencimento);
  if (!due) return false;
  return due < todayIsoDate();
}

function calcularAcrescimosBoletoVencido(valorPrincipal, dataVencimentoOriginal) {
  const principal = roundMoney(valorPrincipal);
  const due = toIsoDate(dataVencimentoOriginal);
  const hoje = todayIsoDate();

  if (!due || due >= hoje) {
    return {
      valorPrincipal: principal,
      multa: 0,
      juros: 0,
      valorTotal: principal,
      diasAtraso: 0,
      vencimentoNovo: hoje,
    };
  }

  const d1 = new Date(`${due}T12:00:00`);
  const d2 = new Date(`${hoje}T12:00:00`);
  const diasAtraso = Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  const multa = roundMoney(principal * (MULTA_PERCENT_VENCIDO / 100));
  const juros = roundMoney(principal * (JUROS_MENSAL_PERCENT_VENCIDO / 100) * (diasAtraso / 30));
  const valorTotal = roundMoney(principal + multa + juros);

  return {
    valorPrincipal: principal,
    multa,
    juros,
    valorTotal,
    diasAtraso,
    vencimentoNovo: hoje,
  };
}

function resolveValorEVencimentoManutencao(boleto) {
  const vencido = isBoletoManutencaoVencido(boleto);
  const vencimentoOriginal = toIsoDate(boleto.data_vencimento);

  if (vencido) {
    const principal = extractValorPrincipalBoleto(boleto);
    const acrescimos = calcularAcrescimosBoletoVencido(principal, vencimentoOriginal);
    return {
      vencido: true,
      valorReais: acrescimos.valorTotal,
      vencimentoStr: acrescimos.vencimentoNovo,
      acrescimos,
      numeroBoleto: withValorPrincipalMarker(boleto.numero_boleto, principal),
      descricaoExtra: acrescimos.multa > 0
        ? ` (multa ${acrescimos.multa.toFixed(2)} + juros ${acrescimos.juros.toFixed(2)})`
        : '',
    };
  }

  return {
    vencido: false,
    valorReais: roundMoney(parseFloat(boleto.valor)),
    vencimentoStr: ensureFutureExpireDate(vencimentoOriginal),
    acrescimos: null,
    numeroBoleto: boleto.numero_boleto,
    descricaoExtra: '',
  };
}

function ensureFutureExpireDate(rawDate) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const parsed = rawDate ? new Date(rawDate) : null;

  if (parsed && !Number.isNaN(parsed.getTime())) {
    const parsedStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    if (parsedStart > todayStart) {
      return parsedStart.toISOString().slice(0, 10);
    }
  }

  // Gateway rejeita expire_at inválida/expirada: usar fallback de +3 dias.
  const fallback = new Date(todayStart);
  fallback.setDate(fallback.getDate() + 3);
  return fallback.toISOString().slice(0, 10);
}

/** Vencimento do boleto SICAF para perfil cliente: sempre o dia seguinte. */
function getSicafBoletoDueDate() {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

/** Vencimento customizado (equipe): hoje em diante; inválido → null. */
function normalizeSicafDueDateCustom(rawDate) {
  if (!rawDate) return null;
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (start < todayStart) return null;
  return start.toISOString().slice(0, 10);
}

function resolveSicafBoletoVencimento(opts) {
  if (!opts.allowCustomDueDate) {
    return getSicafBoletoDueDate();
  }
  const custom = normalizeSicafDueDateCustom(opts.dataVencimento);
  if (custom) return custom;
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 30);
  return fallback.toISOString().slice(0, 10);
}

function extractValidDoc(documento) {
  const digits = String(documento || '').replace(/\D/g, '');
  if (digits.length === 11) return { cpf: digits, cnpj: null };
  if (digits.length === 14) return { cpf: null, cnpj: digits };
  return { cpf: null, cnpj: null };
}

// ══════════════════════════════════════════════════════════════════════════════
// GERAR BOLETO — SICAF
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gera boleto para taxa SICAF e registra na tabela centralizada.
 * @param {Object} opts
 * @param {number} opts.taxaId - ID da taxa_sicaf
 * @param {number} opts.clienteId - ID do cliente
 * @param {number} [opts.geradoPor] - ID do usuário que solicitou
 * @returns {Promise<Object>}
 */
async function gerarBoletoSicaf(opts) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    // 1. Buscar dados da taxa
    const taxa = await db('taxas_sicaf').where('id', opts.taxaId).first();
    if (!taxa) return { ok: false, error: 'Taxa SICAF não encontrada' };

    // 2. Buscar dados do cliente
    const cliente = await db('clientes').where('id', opts.clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    const valorReais = parseFloat(taxa.valor);
    const valorCentavos = Math.round(valorReais * 100);
    const protocolo = `SICAF-${taxa.ano_referencia}-${taxa.id}`;

    const vencimentoStr = resolveSicafBoletoVencimento(opts);

    // 3. Inserir registro aguardando
    const [pagamentoId] = await db('pagamentos').insert(basePagamentoInsert({
      cliente_id: opts.clienteId,
      origem: 'sicaf',
      origem_id: opts.taxaId,
      tipo: 'boleto',
      valor: valorReais,
      valor_centavos: valorCentavos,
      descricao: taxa.descricao || 'Taxa de Renovação SICAF Anual',
      protocolo,
      data_vencimento: vencimentoStr,
      status: 'aguardando',
      cliente_nome: cliente.razao_social || cliente.nome_fantasia,
      cliente_documento: cliente.documento,
      cliente_email: cliente.email,
      gerado_por: opts.geradoPor || null,
    }));

    // 4. Chamar Gerencianet
    const isPJ = (cliente.tipo_documento || 'CNPJ') === 'CNPJ';
    const dadosGN = {
      valor: valorCentavos,
      vencimento: vencimentoStr,
      protocolo,
      cliente: {
        nome: cliente.razao_social || cliente.nome_fantasia || 'Cliente',
        razaoSocial: isPJ ? (cliente.razao_social || cliente.nome_fantasia) : undefined,
        email: cliente.email || '',
        telefone: cliente.telefone || '',
        cpf: !isPJ ? cliente.documento : undefined,
        cnpj: isPJ ? cliente.documento : undefined,
      },
    };

    let gnResponse;
    try {
      gnResponse = await gerencianetService.gerarBoleto(dadosGN);
    } catch (gnErr) {
      // Registrar erro
      await db('pagamentos').where('id', pagamentoId).update(pagamentoErroUpdate(gnErr.message));
      return { ok: false, error: gnErr.message, pagamentoId };
    }

    // 5. Atualizar registro com dados do boleto
    const chargeData = gnResponse?.data || gnResponse;
    const chargeId = chargeData?.charge_id;
    const barcodeLink = chargeData?.billet_link || chargeData?.link || '';
    const barcode = chargeData?.barcode || '';
    const pdfLink = chargeData?.pdf?.charge || '';

    await db('pagamentos').where('id', pagamentoId).update(
      pagamentoBoletoGeradoUpdate(chargeId, barcode, barcodeLink, pdfLink, gnResponse),
    );

    // 6. Atualizar tabela de origem (taxas_sicaf)
    await db('taxas_sicaf').where('id', opts.taxaId).update({
      forma_pagamento: 'Boleto',
      status: 'Pendente',
      codigo_barras: barcode || null,
    });

    return {
      ok: true,
      pagamentoId,
      chargeId,
      barcode,
      link: barcodeLink,
      pdf: pdfLink,
      valor: valorReais,
      vencimento: vencimentoStr,
      protocolo,
    };
  } catch (e) {
    console.error('[Pagamentos] Erro gerarBoletoSicaf:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GERAR PIX — SICAF
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gera PIX para taxa SICAF e registra na tabela centralizada.
 */
async function gerarPixSicaf(opts) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const taxa = await db('taxas_sicaf').where('id', opts.taxaId).first();
    if (!taxa) return { ok: false, error: 'Taxa SICAF não encontrada' };

    const cliente = await db('clientes').where('id', opts.clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    const valorReais = parseFloat(taxa.valor);
    const valorCentavos = Math.round(valorReais * 100);
    const protocolo = `SICAF-PIX-${taxa.ano_referencia}-${taxa.id}`;

    // Inserir registro aguardando
    const [pagamentoId] = await db('pagamentos').insert(basePagamentoInsert({
      cliente_id: opts.clienteId,
      origem: 'sicaf',
      origem_id: opts.taxaId,
      tipo: 'pix',
      valor: valorReais,
      valor_centavos: valorCentavos,
      descricao: taxa.descricao || 'Taxa de Renovação SICAF Anual',
      protocolo,
      status: 'aguardando',
      cliente_nome: cliente.razao_social || cliente.nome_fantasia,
      cliente_documento: cliente.documento,
      cliente_email: cliente.email,
      gerado_por: opts.geradoPor || null,
    }));

    const isPJ = (cliente.tipo_documento || 'CNPJ') === 'CNPJ';
    const dadosGN = {
      valor: valorCentavos,
      protocolo,
      cliente: {
        nome: cliente.razao_social || cliente.nome_fantasia || 'Cliente',
        email: cliente.email || '',
        cpf: !isPJ ? cliente.documento : undefined,
        cnpj: isPJ ? cliente.documento : undefined,
      },
    };

    let gnResponse;
    try {
      gnResponse = await gerencianetService.gerarPix(dadosGN);
    } catch (gnErr) {
      await db('pagamentos').where('id', pagamentoId).update(pagamentoErroUpdate(gnErr.message));
      return { ok: false, error: gnErr.message, pagamentoId };
    }

    const txid = gnResponse?.txid || '';
    const locId = gnResponse?.loc?.id || null;
    const qrcodeText = gnResponse?.qrcode?.qrcode || '';
    const qrcodeImage = gnResponse?.qrcode?.imagemQrcode || '';

    await db('pagamentos').where('id', pagamentoId).update(
      pagamentoPixGeradoUpdate(txid, locId, qrcodeText, qrcodeImage, gnResponse),
    );

    // Atualizar tabela de origem
    await db('taxas_sicaf').where('id', opts.taxaId).update({
      forma_pagamento: 'PIX',
      status: 'Pendente',
      chave_pix: qrcodeText || null,
    });

    return {
      ok: true,
      pagamentoId,
      txid,
      qrcodeText,
      qrcodeImage,
      valor: valorReais,
      protocolo,
    };
  } catch (e) {
    console.error('[Pagamentos] Erro gerarPixSicaf:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GERAR BOLETO — MANUTENÇÃO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gera boleto para manutenção e registra na tabela centralizada.
 */
async function gerarBoletoManutencao(opts) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const boleto = await db('manutencao_boletos').where('id', opts.boletoId).first();
    if (!boleto) return { ok: false, error: 'Boleto de manutenção não encontrado' };

    const cliente = await db('clientes').where('id', opts.clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    const st = String(boleto.status || '').trim();
    if (['Pago', 'pago'].includes(st)) {
      return { ok: false, error: 'Este boleto já está pago.' };
    }

    const resolved = resolveValorEVencimentoManutencao(boleto);
    const valorReais = resolved.valorReais;
    const valorCentavos = Math.round(valorReais * 100);
    const protocolo = `MANUT-${boleto.ano_referencia}-${String(boleto.mes_referencia).padStart(2, '0')}-${boleto.id}`;

    let vencimentoStr = resolved.vencimentoStr;
    if (opts.allowCustomDueDate && opts.dataVencimento) {
      const custom = normalizeSicafDueDateCustom(opts.dataVencimento);
      if (!custom) {
        return { ok: false, error: 'Data de vencimento inválida. Informe uma data de hoje em diante.' };
      }
      vencimentoStr = custom;
    }

    const acrescimos = resolved.acrescimos;

    const [pagamentoId] = await db('pagamentos').insert(basePagamentoInsert({
      cliente_id: opts.clienteId,
      origem: 'manutencao',
      origem_id: opts.boletoId,
      tipo: 'boleto',
      valor: valorReais,
      valor_centavos: valorCentavos,
      descricao: `Manutenção CADBRASIL — ${String(boleto.mes_referencia).padStart(2, '0')}/${boleto.ano_referencia}${resolved.descricaoExtra}`,
      protocolo,
      data_vencimento: vencimentoStr,
      status: 'aguardando',
      cliente_nome: cliente.razao_social || cliente.nome_fantasia,
      cliente_documento: cliente.documento,
      cliente_email: cliente.email,
      gerado_por: opts.geradoPor || null,
    }));

    const doc = extractValidDoc(cliente.documento);
    if (!doc.cpf && !doc.cnpj) {
      return {
        ok: false,
        error: 'CPF/CNPJ do cliente inválido para gerar boleto. Atualize o cadastro do cliente.',
      };
    }
    const isPJ = !!doc.cnpj;
    const dadosGN = {
      valor: valorCentavos,
      vencimento: vencimentoStr,
      protocolo,
      cliente: {
        nome: cliente.razao_social || cliente.nome_fantasia || 'Cliente',
        razaoSocial: isPJ ? (cliente.razao_social || cliente.nome_fantasia) : undefined,
        email: cliente.email || '',
        telefone: cliente.telefone || '',
        cpf: !isPJ ? doc.cpf || undefined : undefined,
        cnpj: isPJ ? doc.cnpj || undefined : undefined,
      },
    };

    let gnResponse;
    try {
      gnResponse = await gerencianetService.gerarBoleto(dadosGN);
    } catch (gnErr) {
      await db('pagamentos').where('id', pagamentoId).update(pagamentoErroUpdate(gnErr.message));
      return { ok: false, error: gnErr.message, pagamentoId };
    }

    const chargeData = gnResponse?.data || gnResponse;
    const chargeId = chargeData?.charge_id;
    const barcode = chargeData?.barcode || '';
    const barcodeLink = chargeData?.billet_link || chargeData?.link || '';
    const pdfLink = chargeData?.pdf?.charge || '';

    await db('pagamentos').where('id', pagamentoId).update(
      pagamentoBoletoGeradoUpdate(chargeId, barcode, barcodeLink, pdfLink, gnResponse),
    );

    // Atualizar tabela de origem
    await db('manutencao_boletos').where('id', opts.boletoId).update({
      forma_pagamento: 'Boleto',
      status: 'Pendente',
      data_vencimento: vencimentoStr,
      valor: valorReais,
      numero_boleto: resolved.numeroBoleto || (chargeId ? String(chargeId) : null),
      codigo_barras: barcode || null,
    });

    return {
      ok: true,
      pagamentoId,
      chargeId,
      barcode,
      link: barcodeLink,
      pdf: pdfLink,
      valor: valorReais,
      vencimento: vencimentoStr,
      protocolo,
      regeneradoVencido: resolved.vencido,
      acrescimos,
    };
  } catch (e) {
    console.error('[Pagamentos] Erro gerarBoletoManutencao:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GERAR PIX — MANUTENÇÃO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gera PIX para manutenção e registra na tabela centralizada.
 */
async function gerarPixManutencao(opts) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const boleto = await db('manutencao_boletos').where('id', opts.boletoId).first();
    if (!boleto) return { ok: false, error: 'Boleto de manutenção não encontrado' };

    const cliente = await db('clientes').where('id', opts.clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    const st = String(boleto.status || '').trim();
    if (['Pago', 'pago'].includes(st)) {
      return { ok: false, error: 'Este boleto já está pago.' };
    }

    const resolved = resolveValorEVencimentoManutencao(boleto);
    const valorReais = resolved.valorReais;
    const valorCentavos = Math.round(valorReais * 100);
    const protocolo = `MANUT-PIX-${boleto.ano_referencia}-${String(boleto.mes_referencia).padStart(2, '0')}-${boleto.id}`;
    const acrescimos = resolved.acrescimos;

    const [pagamentoId] = await db('pagamentos').insert(basePagamentoInsert({
      cliente_id: opts.clienteId,
      origem: 'manutencao',
      origem_id: opts.boletoId,
      tipo: 'pix',
      valor: valorReais,
      valor_centavos: valorCentavos,
      descricao: `Manutenção CADBRASIL — ${String(boleto.mes_referencia).padStart(2, '0')}/${boleto.ano_referencia}${resolved.descricaoExtra}`,
      protocolo,
      status: 'aguardando',
      cliente_nome: cliente.razao_social || cliente.nome_fantasia,
      cliente_documento: cliente.documento,
      cliente_email: cliente.email,
      gerado_por: opts.geradoPor || null,
    }));

    const doc = extractValidDoc(cliente.documento);
    if (!doc.cpf && !doc.cnpj) {
      return {
        ok: false,
        error: 'CPF/CNPJ do cliente inválido para gerar PIX. Atualize o cadastro do cliente.',
      };
    }
    const isPJ = !!doc.cnpj;
    const dadosGN = {
      valor: valorCentavos,
      protocolo,
      cliente: {
        nome: cliente.razao_social || cliente.nome_fantasia || 'Cliente',
        email: cliente.email || '',
        cpf: !isPJ ? doc.cpf || undefined : undefined,
        cnpj: isPJ ? doc.cnpj || undefined : undefined,
      },
    };

    let gnResponse;
    try {
      gnResponse = await gerencianetService.gerarPix(dadosGN);
    } catch (gnErr) {
      await db('pagamentos').where('id', pagamentoId).update(pagamentoErroUpdate(gnErr.message));
      return { ok: false, error: gnErr.message, pagamentoId };
    }

    const txid = gnResponse?.txid || '';
    const locId = gnResponse?.loc?.id || null;
    const qrcodeText = gnResponse?.qrcode?.qrcode || '';
    const qrcodeImage = gnResponse?.qrcode?.imagemQrcode || '';

    await db('pagamentos').where('id', pagamentoId).update(
      pagamentoPixGeradoUpdate(txid, locId, qrcodeText, qrcodeImage, gnResponse),
    );

    // Atualizar tabela de origem
    const pixUpdate = {
      forma_pagamento: 'PIX',
      status: 'Pendente',
      chave_pix: qrcodeText || null,
      valor: valorReais,
    };
    if (resolved.vencido) {
      pixUpdate.data_vencimento = resolved.vencimentoStr;
      pixUpdate.numero_boleto = resolved.numeroBoleto;
    }
    await db('manutencao_boletos').where('id', opts.boletoId).update(pixUpdate);

    return {
      ok: true,
      pagamentoId,
      txid,
      qrcodeText,
      qrcodeImage,
      valor: valorReais,
      protocolo,
      regeneradoVencido: resolved.vencido,
      acrescimos,
    };
  } catch (e) {
    console.error('[Pagamentos] Erro gerarPixManutencao:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// COBRANÇA PERSONALIZADA (AVULSA)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gera boleto ou PIX personalizado (valor e vencimento definidos pelo operador).
 */
async function gerarCobrancaPersonalizada(opts) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const clienteId = Number(opts.clienteId);
    const valorReais = typeof opts.valor === 'number'
      ? opts.valor
      : parseFloat(String(opts.valor).replace(/\./g, '').replace(',', '.'));
    if (!clienteId || !Number.isFinite(valorReais) || valorReais <= 0) {
      return { ok: false, error: 'Informe um valor válido maior que zero.' };
    }

    const forma = String(opts.formaPagamento || 'boleto').toLowerCase();
    if (!['boleto', 'pix'].includes(forma)) {
      return { ok: false, error: 'Forma de pagamento inválida. Use boleto ou pix.' };
    }

    const vencimentoStr = ensureFutureExpireDate(opts.dataVencimento);
    const cliente = await db('clientes').where('id', clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    const valorCentavos = Math.round(valorReais * 100);
    const ts = Date.now();
    const protocolo = `PERS-${clienteId}-${ts}`;
    const descricao = (opts.descricao || 'Cobrança personalizada CadBrasil').slice(0, 200);

    // origem_id NOT NULL — usa o próprio id do pagamento após insert (cobrança avulsa sem taxa/boleto)
    const [pagamentoId] = await db('pagamentos').insert(basePagamentoInsert({
      cliente_id: clienteId,
      origem: 'avulso',
      origem_id: clienteId,
      tipo: forma,
      valor: valorReais,
      valor_centavos: valorCentavos,
      descricao,
      protocolo,
      data_vencimento: vencimentoStr,
      status: 'aguardando',
      cliente_nome: cliente.razao_social || cliente.nome_fantasia,
      cliente_documento: cliente.documento,
      cliente_email: cliente.email,
      gerado_por: opts.geradoPor || null,
    }));

    await db('pagamentos').where('id', pagamentoId).update({ origem_id: pagamentoId });

    const doc = extractValidDoc(cliente.documento);
    if (!doc.cpf && !doc.cnpj) {
      await db('pagamentos').where('id', pagamentoId).update(pagamentoErroUpdate('Documento inválido'));
      return { ok: false, error: 'CPF/CNPJ do cliente inválido. Atualize o cadastro.' };
    }

    const isPJ = !!doc.cnpj;
    const clienteGN = {
      nome: cliente.razao_social || cliente.nome_fantasia || 'Cliente',
      razaoSocial: isPJ ? (cliente.razao_social || cliente.nome_fantasia) : undefined,
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      cpf: !isPJ ? doc.cpf || undefined : undefined,
      cnpj: isPJ ? doc.cnpj || undefined : undefined,
    };

    if (forma === 'pix') {
      let gnResponse;
      try {
        gnResponse = await gerencianetService.gerarPix({
          valor: valorCentavos,
          protocolo,
          cliente: clienteGN,
        });
      } catch (gnErr) {
        await db('pagamentos').where('id', pagamentoId).update(pagamentoErroUpdate(gnErr.message));
        return { ok: false, error: gnErr.message, pagamentoId };
      }
      await db('pagamentos').where('id', pagamentoId).update(
        pagamentoPixGeradoUpdate(
          gnResponse?.txid,
          gnResponse?.loc?.id,
          gnResponse?.qrcode?.qrcode,
          gnResponse?.qrcode?.imagemQrcode,
          gnResponse,
        ),
      );
      return {
        ok: true,
        pagamentoId,
        tipo: 'pix',
        valor: valorReais,
        vencimento: vencimentoStr,
        protocolo,
        qrcodeText: gnResponse?.qrcode?.qrcode || '',
        qrcodeImage: gnResponse?.qrcode?.imagemQrcode || '',
      };
    }

    let gnResponse;
    try {
      gnResponse = await gerencianetService.gerarBoleto({
        valor: valorCentavos,
        vencimento: vencimentoStr,
        protocolo,
        cliente: clienteGN,
      });
    } catch (gnErr) {
      await db('pagamentos').where('id', pagamentoId).update(pagamentoErroUpdate(gnErr.message));
      return { ok: false, error: gnErr.message, pagamentoId };
    }

    const chargeData = gnResponse?.data || gnResponse;
    await db('pagamentos').where('id', pagamentoId).update(
      pagamentoBoletoGeradoUpdate(
        chargeData?.charge_id,
        chargeData?.barcode,
        chargeData?.billet_link || chargeData?.link,
        chargeData?.pdf?.charge,
        gnResponse,
      ),
    );

    return {
      ok: true,
      pagamentoId,
      tipo: 'boleto',
      valor: valorReais,
      vencimento: vencimentoStr,
      protocolo,
      barcode: chargeData?.barcode || '',
      link: chargeData?.billet_link || chargeData?.link || '',
      pdf: chargeData?.pdf?.charge || '',
    };
  } catch (e) {
    console.error('[Pagamentos] Erro gerarCobrancaPersonalizada:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONSULTAS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Lista pagamentos de um cliente.
 * @param {Object} opts
 * @param {number} [opts.clienteId] - Filtrar por cliente
 * @param {string} [opts.origem] - 'sicaf' ou 'manutencao'
 * @param {string} [opts.tipo] - 'boleto' ou 'pix'
 * @param {string} [opts.status] - Filtrar por status
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=50]
 */
async function listarPagamentos(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let query = pagamentosQuery(db).orderBy('created_at', 'desc');

    if (opts.clienteId) query = query.where('cliente_id', opts.clienteId);
    if (opts.origem) query = query.where('origem', opts.origem);
    if (opts.tipo) query = query.where('tipo', opts.tipo);
    if (opts.status) query = query.where('status', opts.status);

    const page = opts.page || 1;
    const limit = opts.limit || 50;
    const countResult = await query.clone().count('id as total').first();
    const total = countResult?.total || 0;

    const rows = await query.limit(limit).offset((page - 1) * limit);

    const pagamentos = rows.map(mapPagamentoRowToApi);

    return { ok: true, pagamentos, total, page, limit };
  } catch (e) {
    console.error('[Pagamentos] Erro listarPagamentos:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Busca um pagamento por ID.
 */
async function getPagamento(id) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const row = await pagamentosQuery(db).where('id', id).first();
    if (!row) return { ok: false, error: 'Pagamento não encontrado' };
    return { ok: true, pagamento: row };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function isPagamentoPagoStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return ['pago', 'paga', 'aprovado', 'aprovada', 'paid', 'liberado', 'liberada'].includes(s);
}

function isPagamentoCanceladoStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return ['cancelado', 'cancelada', 'cancelled', 'canceled'].includes(s);
}

/**
 * Cancela boleto na Gerencianet (Efí) e atualiza pagamentos.
 */
async function cancelarBoletoGerencianet(pagamentoId, opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const pgto = await pagamentosQuery(db).where('id', pagamentoId).first();
    if (!pgto) return { ok: false, error: 'Pagamento não encontrado' };

    if (opts.clienteId != null && Number(pgto.cliente_id) !== Number(opts.clienteId)) {
      return { ok: false, error: 'Pagamento não pertence a este cliente' };
    }

    const tipo = String(pgto.tipo || '').trim().toLowerCase();
    if (tipo !== 'boleto') {
      return { ok: false, error: 'Somente boletos podem ser cancelados por esta ação.' };
    }

    if (isPagamentoPagoStatus(pgto.status)) {
      return { ok: false, error: 'Não é possível cancelar um boleto já pago.' };
    }
    if (isPagamentoCanceladoStatus(pgto.status)) {
      return { ok: false, error: 'Este boleto já está cancelado.' };
    }

    const chargeId = pgto.provider_charge_id;
    if (!chargeId) {
      return { ok: false, error: 'Boleto sem identificador na Gerencianet (charge_id).' };
    }

    try {
      await gerencianetService.cancelarCobranca(Number(chargeId));
    } catch (e) {
      const msg = e?.message || String(e);
      const detail = e?.error_description || e?.nome || '';
      const full = `${msg} ${detail}`.toLowerCase();
      const jaCancelado =
        full.includes('cancel') ||
        full.includes('canceled') ||
        full.includes('cancelad');
      if (!jaCancelado) {
        return { ok: false, error: `Falha ao cancelar na Gerencianet: ${msg}` };
      }
    }

    const origem = String(pgto.origem || '').trim().toLowerCase();
    const origemId = pgto.origem_id;

    await db.transaction(async (trx) => {
      if (origem === 'sicaf' && origemId) {
        const taxa = await trx('taxas_sicaf').where('id', origemId).first();
        if (taxa && !isPagamentoPagoStatus(taxa.status)) {
          await trx('taxas_sicaf').where('id', origemId).update({
            status: 'Pendente',
            codigo_barras: null,
            forma_pagamento: null,
          });
        }
      } else if (origem === 'manutencao' && origemId) {
        const boleto = await trx('manutencao_boletos').where('id', origemId).first();
        if (boleto && !isPagamentoPagoStatus(boleto.status)) {
          await trx('manutencao_boletos').where('id', origemId).update({
            status: 'Cancelado',
            codigo_barras: null,
            numero_boleto: null,
          });
        }
      }

      await trx('pagamentos').where('id', pagamentoId).update({
        status: 'cancelado',
        deleted_at: trx.fn.now(),
      });
    });

    if (opts.usuarioId) {
      try {
        await db('historico_acoes').insert({
          cliente_id: pgto.cliente_id || null,
          usuario_id: opts.usuarioId,
          acao: `Boleto cancelado na Gerencianet e removido do portal (pagamento #${pagamentoId}, charge ${chargeId})`,
          entidade: 'pagamentos',
          entidade_id: pagamentoId,
          created_at: db.fn.now(),
        });
      } catch (_) {
        /* histórico opcional */
      }
    }

    return {
      ok: true,
      message: 'Boleto cancelado na Gerencianet e removido do portal CadBrasil.',
      removido: true,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Atualiza o status de um pagamento (ex: confirmar pagamento, cancelar).
 */
async function atualizarStatus(id, novoStatus, extras = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const update = { status: novoStatus };
    if (novoStatus === 'pago') update.data_pagamento = db.fn.now();
    if (extras.e2eid) update.provider_e2eid = extras.e2eid;

    await db('pagamentos').where('id', id).update(update);

    // Se pago, atualizar tabela de origem também
    if (novoStatus === 'pago') {
      const pgto = await db('pagamentos').where('id', id).first();
      if (pgto) {
        if (pgto.origem === 'sicaf') {
          await db('taxas_sicaf').where('id', pgto.origem_id).update({
            status: 'Pago',
            data_pagamento: db.fn.now(),
          });
        } else if (pgto.origem === 'manutencao') {
          await db('manutencao_boletos').where('id', pgto.origem_id).update({
            status: 'Pago',
            data_pagamento: db.fn.now(),
          });
        }
        // avulso: sem tabela de origem — apenas pagamentos
      }
    }

    return { ok: true, message: `Status atualizado para "${novoStatus}"` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Autoriza manualmente o pagamento de um boleto de manutenção (administrativo).
 * Atualiza manutencao_boletos e qualquer pagamentos vinculado (origem manutencao).
 */
async function autorizarPagamentoManutencao(boletoId, clienteIdEsperado, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const row = await db('manutencao_boletos as mb')
      .join('manutencoes as m', 'mb.manutencao_id', 'm.id')
      .where('mb.id', boletoId)
      .select('mb.id', 'm.cliente_id')
      .first();

    if (!row) return { ok: false, error: 'Boleto de manutenção não encontrado' };

    if (clienteIdEsperado != null && Number(clienteIdEsperado) > 0) {
      if (Number(row.cliente_id) !== Number(clienteIdEsperado)) {
        return { ok: false, error: 'Boleto não pertence a este cliente' };
      }
    }

    await db('manutencao_boletos').where('id', boletoId).update({
      status: 'Pago',
      data_pagamento: db.fn.now(),
    });

    const pagamentos = await db('pagamentos')
      .where({ origem: 'manutencao', origem_id: boletoId })
      .select('id');

    for (const p of pagamentos) {
      await db('pagamentos').where('id', p.id).update({
        status: 'pago',
        data_pagamento: db.fn.now(),
      });
    }

    if (usuarioId) {
      try {
        await db('historico_acoes').insert({
          cliente_id: row.cliente_id || null,
          usuario_id: usuarioId,
          acao: `Pagamento do boleto de manutenção #${boletoId} autorizado manualmente (admin).`,
          entidade: 'manutencao_boletos',
          entidade_id: boletoId,
          created_at: db.fn.now(),
        });
      } catch (_) {}
    }

    console.log(`[Pagamentos] Manutenção boleto ${boletoId} autorizado como pago (cliente ${row.cliente_id})`);
    return { ok: true, message: 'Pagamento do boleto autorizado com sucesso.' };
  } catch (e) {
    console.error('[Pagamentos] Erro autorizarPagamentoManutencao:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // SICAF
  gerarBoletoSicaf,
  gerarPixSicaf,

  // Manutenção
  gerarBoletoManutencao,
  gerarPixManutencao,
  isBoletoManutencaoVencido,
  calcularAcrescimosBoletoVencido,
  gerarCobrancaPersonalizada,
  autorizarPagamentoManutencao,

  // Consultas
  listarPagamentos,
  getPagamento,
  atualizarStatus,
  cancelarBoletoGerencianet,
};
