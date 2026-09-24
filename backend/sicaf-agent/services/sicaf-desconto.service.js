/**
 * Desconto comercial na taxa SICAF.
 *
 * O desconto fica gravado na própria taxa (taxas_sicaf.desconto_*) porque o sistema
 * realinha o valor da taxa ao preço da configuração antes de cada emissão; sem isso
 * o boleto voltaria ao valor cheio na próxima reemissão ou na página /pay.
 */
const { getDb } = require('../database/connection');

const LOG_PREFIX = '[Desconto SICAF]';

/** Valor mínimo aceito pela Efí para boleto. */
const VALOR_MINIMO_BOLETO = 5;

const TIPOS_VALIDOS = ['percentual', 'valor', 'valor_final'];

let colunasGarantidas = false;

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

async function ensureDescontoColumns(db) {
  if (colunasGarantidas) return;
  const colunas = [
    ['desconto_tipo', 'desconto_tipo VARCHAR(12) NULL'],
    ['desconto_input', 'desconto_input DECIMAL(12,2) NULL'],
    ['desconto_valor', 'desconto_valor DECIMAL(12,2) NULL'],
    ['valor_cheio', 'valor_cheio DECIMAL(12,2) NULL'],
    ['desconto_motivo', 'desconto_motivo VARCHAR(255) NULL'],
    ['desconto_autorizado_por', 'desconto_autorizado_por VARCHAR(120) NULL'],
    ['desconto_por', 'desconto_por INT NULL'],
    ['desconto_em', 'desconto_em DATETIME NULL'],
  ];
  for (const [nome, ddl] of colunas) {
    try {
      const existe = await db.schema.hasColumn('taxas_sicaf', nome);
      if (!existe) await db.raw(`ALTER TABLE taxas_sicaf ADD COLUMN ${ddl}`);
    } catch (e) {
      console.warn(`${LOG_PREFIX} Falha ao criar coluna ${nome}:`, e.message);
    }
  }
  colunasGarantidas = true;
}

/**
 * Calcula o valor final a partir do valor cheio.
 * - percentual: input = % de desconto
 * - valor: input = R$ de desconto
 * - valor_final: input = valor que o cliente vai pagar
 */
function calcularDesconto(valorCheio, tipo, input) {
  const cheio = round2(valorCheio);
  const n = round2(input);
  let valorFinal = cheio;

  if (tipo === 'percentual') valorFinal = cheio - (cheio * n) / 100;
  else if (tipo === 'valor') valorFinal = cheio - n;
  else if (tipo === 'valor_final') valorFinal = n;

  valorFinal = round2(Math.min(cheio, Math.max(0, valorFinal)));
  const desconto = round2(cheio - valorFinal);
  const percentual = cheio > 0 ? round2((desconto / cheio) * 100) : 0;
  return { valorCheio: cheio, valorFinal, desconto, percentual };
}

function temDesconto(taxa) {
  return Boolean(taxa && TIPOS_VALIDOS.includes(taxa.desconto_tipo) && taxa.desconto_input != null);
}

/**
 * Valor que deve ser cobrado da taxa considerando o desconto gravado.
 * Usado por todos os pontos que realinham a taxa ao preço da configuração.
 */
function valorComDesconto(taxa, valorCheio) {
  if (!temDesconto(taxa)) return round2(valorCheio);
  const { valorFinal } = calcularDesconto(valorCheio, taxa.desconto_tipo, taxa.desconto_input);
  return Math.max(VALOR_MINIMO_BOLETO, valorFinal);
}

function descontoInfo(taxa) {
  if (!temDesconto(taxa)) return null;
  return {
    tipo: taxa.desconto_tipo,
    input: Number(taxa.desconto_input),
    valorDesconto: taxa.desconto_valor != null ? Number(taxa.desconto_valor) : null,
    valorCheio: taxa.valor_cheio != null ? Number(taxa.valor_cheio) : null,
    motivo: taxa.desconto_motivo || null,
    autorizadoPor: taxa.desconto_autorizado_por || null,
    aplicadoPor: taxa.desconto_por || null,
    aplicadoEm: taxa.desconto_em || null,
  };
}

const fmtBrl = (n) => `R$ ${round2(n).toFixed(2).replace('.', ',')}`;

/** Valida o pedido de desconto contra o valor cheio e devolve o cálculo. */
function validarDesconto(valorCheio, desconto = {}) {
  const tipo = String(desconto.tipo || '').trim();
  if (!TIPOS_VALIDOS.includes(tipo)) return { ok: false, error: 'Tipo de desconto inválido' };

  const motivo = String(desconto.motivo || '').trim();
  if (motivo.length < 3) return { ok: false, error: 'Informe o motivo do desconto' };

  const input = round2(desconto.valor);
  if (!Number.isFinite(input) || input <= 0) {
    return { ok: false, error: 'Informe um valor de desconto maior que zero' };
  }
  if (tipo === 'percentual' && input >= 100) {
    return { ok: false, error: 'O percentual deve ser menor que 100%' };
  }

  const calc = calcularDesconto(valorCheio, tipo, input);
  if (calc.desconto <= 0) return { ok: false, error: 'O desconto não altera o valor da taxa' };
  if (calc.valorFinal < VALOR_MINIMO_BOLETO) {
    return {
      ok: false,
      error: `O valor final não pode ser menor que ${fmtBrl(VALOR_MINIMO_BOLETO)} (mínimo da Efí).`,
    };
  }

  const autorizadoPor = String(desconto.autorizadoPor || '').trim().slice(0, 120) || null;
  return { ok: true, tipo, input, motivo: motivo.slice(0, 255), autorizadoPor, calc };
}

/** Campos de taxas_sicaf para gravar (ou limpar, com validado = null) o desconto. */
function camposDesconto(db, valorCheio, validado, usuarioId) {
  if (!validado) {
    return {
      valor: round2(valorCheio),
      desconto_tipo: null,
      desconto_input: null,
      desconto_valor: null,
      valor_cheio: null,
      desconto_motivo: null,
      desconto_autorizado_por: null,
      desconto_por: usuarioId || null,
      desconto_em: db.fn.now(),
    };
  }
  return {
    valor: validado.calc.valorFinal,
    desconto_tipo: validado.tipo,
    desconto_input: validado.input,
    desconto_valor: validado.calc.desconto,
    valor_cheio: validado.calc.valorCheio,
    desconto_motivo: validado.motivo,
    desconto_autorizado_por: validado.autorizadoPor,
    desconto_por: usuarioId || null,
    desconto_em: db.fn.now(),
  };
}

function textoHistoricoDesconto(taxaId, validado) {
  const { calc } = validado;
  const autorizacao = validado.autorizadoPor ? ` Autorizado por: ${validado.autorizadoPor}.` : '';
  return `Desconto na taxa SICAF #${taxaId}: ${fmtBrl(calc.valorCheio)} − ${fmtBrl(calc.desconto)} (${calc.percentual}%) = ${fmtBrl(calc.valorFinal)}.${autorizacao} Motivo: ${validado.motivo}`;
}

async function resolveValorCheio(taxa) {
  const planosService = require('./planos.service');
  const planoCodigo = planosService.inferPlanoCodigoFromDescricao(taxa.descricao);
  return round2(await planosService.resolveValorTaxaSicaf(planoCodigo));
}

function isTaxaAberta(taxa) {
  const st = String(taxa?.status || '').trim().toLowerCase();
  return !['pago', 'aprovado', 'cancelado', 'cancelada', 'removido'].includes(st);
}

async function carregarTaxa(db, taxaId, clienteId) {
  const id = parseInt(taxaId, 10);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Taxa inválida' };
  const taxa = await db('taxas_sicaf').where('id', id).first();
  if (!taxa) return { ok: false, error: 'Taxa SICAF não encontrada' };
  if (clienteId != null && Number(taxa.cliente_id) !== Number(clienteId)) {
    return { ok: false, error: 'Taxa não pertence a este cliente' };
  }
  return { ok: true, taxa };
}

/** Dados para o modal: valor cheio atual + desconto já aplicado. */
async function getDescontoTaxa(taxaId, clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureDescontoColumns(db);

  const res = await carregarTaxa(db, taxaId, clienteId);
  if (!res.ok) return res;
  const { taxa } = res;

  const valorCheio = await resolveValorCheio(taxa);
  const abertos = await db('pagamentos')
    .where({ origem: 'sicaf', origem_id: taxa.id })
    .whereNull('deleted_at')
    .whereNotIn('status', ['pago', 'cancelado', 'estornado', 'removido', 'erro'])
    .select('id', 'tipo', 'valor', 'data_vencimento');

  return {
    ok: true,
    taxaId: taxa.id,
    aberta: isTaxaAberta(taxa),
    descricao: taxa.descricao,
    valorCheio,
    valorAtual: round2(taxa.valor),
    valorMinimo: VALOR_MINIMO_BOLETO,
    desconto: descontoInfo(taxa),
    cobrancasAbertas: abertos.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      valor: round2(p.valor),
      vencimento: p.data_vencimento,
    })),
  };
}

async function cancelarCobrancasAbertas(db, taxaId) {
  const abertos = await db('pagamentos')
    .where({ origem: 'sicaf', origem_id: taxaId })
    .whereNull('deleted_at')
    .whereNotIn('status', ['pago', 'cancelado', 'estornado', 'removido', 'erro']);

  for (const p of abertos) {
    if (p.tipo === 'boleto' && p.provider_charge_id) {
      try {
        await require('./gerencianet.service').cancelarCobranca(Number(p.provider_charge_id));
      } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        if (!msg.includes('cancel')) {
          console.warn(`${LOG_PREFIX} Falha ao cancelar boleto ${p.id} na Efí:`, e.message);
        }
      }
    }
    await db('pagamentos').where('id', p.id).update({
      status: 'cancelado',
      deleted_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }

  return {
    cancelados: abertos.length,
    tinhaPix: abertos.some((p) => p.tipo === 'pix' && p.qrcode_text),
  };
}

/**
 * Aplica (ou remove, com tipo = 'remover') o desconto na taxa e reemite a cobrança
 * com o valor final.
 */
async function aplicarDescontoTaxa(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureDescontoColumns(db);

  const res = await carregarTaxa(db, opts.taxaId, opts.clienteId);
  if (!res.ok) return res;
  const { taxa } = res;

  if (!isTaxaAberta(taxa)) {
    return { ok: false, error: 'Só é possível dar desconto em taxa em aberto.' };
  }

  const remover = opts.tipo === 'remover';
  const valorCheio = await resolveValorCheio(taxa);

  let validado = null;
  if (!remover) {
    validado = validarDesconto(valorCheio, opts);
    if (!validado.ok) return validado;
  }
  const calc = validado
    ? validado.calc
    : { valorCheio, valorFinal: valorCheio, desconto: 0, percentual: 0 };

  const valorAnterior = round2(taxa.valor);

  await db('taxas_sicaf').where('id', taxa.id).update(
    camposDesconto(db, valorCheio, validado, opts.usuarioId),
  );

  const { cancelados, tinhaPix } = await cancelarCobrancasAbertas(db, taxa.id);

  const pagamentosService = require('./pagamentos.service');
  const boleto = await pagamentosService.gerarBoletoSicaf({
    taxaId: taxa.id,
    clienteId: taxa.cliente_id,
    geradoPor: opts.usuarioId || null,
    skipValorSync: true,
  });

  let pix = null;
  if (tinhaPix) {
    pix = await pagamentosService.gerarPixSicaf({
      taxaId: taxa.id,
      clienteId: taxa.cliente_id,
      geradoPor: opts.usuarioId || null,
      skipValorSync: true,
    });
  }

  const fmt = fmtBrl;
  const acao = remover
    ? `Desconto removido da taxa SICAF #${taxa.id}: ${fmt(valorAnterior)} → ${fmt(valorCheio)}`
    : textoHistoricoDesconto(taxa.id, validado);

  try {
    await db('historico_acoes').insert({
      cliente_id: taxa.cliente_id,
      usuario_id: opts.usuarioId || null,
      acao,
      entidade: 'taxas_sicaf',
      entidade_id: taxa.id,
      created_at: db.fn.now(),
    });
  } catch (_) {}

  console.log(`${LOG_PREFIX} ${acao} (cobranças canceladas: ${cancelados})`);

  if (!boleto?.ok) {
    return {
      ok: false,
      error: `Desconto salvo, mas o novo boleto não foi emitido: ${boleto?.error || 'erro na Efí'}. Gere o boleto novamente.`,
      descontoSalvo: true,
      valorFinal: remover ? valorCheio : calc.valorFinal,
    };
  }

  return {
    ok: true,
    message: remover
      ? `Desconto removido. Novo boleto emitido de ${fmt(valorCheio)}.`
      : `Desconto aplicado. Novo boleto emitido de ${fmt(calc.valorFinal)}.`,
    taxaId: taxa.id,
    valorCheio,
    valorAnterior,
    valorFinal: remover ? valorCheio : calc.valorFinal,
    desconto: remover ? 0 : calc.desconto,
    percentual: remover ? 0 : calc.percentual,
    cobrancasCanceladas: cancelados,
    boleto: {
      pagamentoId: boleto.pagamentoId,
      link: boleto.link,
      pdf: boleto.pdf,
      vencimento: boleto.vencimento,
      valor: boleto.valor,
    },
    pix: pix?.ok ? { pagamentoId: pix.pagamentoId } : null,
  };
}

module.exports = {
  VALOR_MINIMO_BOLETO,
  ensureDescontoColumns,
  calcularDesconto,
  valorComDesconto,
  validarDesconto,
  camposDesconto,
  textoHistoricoDesconto,
  descontoInfo,
  getDescontoTaxa,
  aplicarDescontoTaxa,
};
