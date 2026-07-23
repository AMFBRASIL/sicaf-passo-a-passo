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

    const boletoIds = boletosRaw.map((b) => b.id);
    const pagamentosByBoleto = new Map();
    if (boletoIds.length) {
      const pgtos = await db('pagamentos')
        .where('origem', 'manutencao')
        .whereIn('origem_id', boletoIds)
        .orderBy('id', 'desc');
      for (const p of pgtos) {
        const key = Number(p.origem_id);
        if (!pagamentosByBoleto.has(key)) pagamentosByBoleto.set(key, p);
      }
    }

    boletos = boletosRaw.map((b) => mapBoletoDetalhe(b, pagamentosByBoleto.get(Number(b.id)) || null));
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

function formatMoneyBr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBr(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch (_) {
    return String(d);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mapBoletoDetalhe(b, pg) {
  const formaRaw = String(b.forma_pagamento || pg?.tipo || pg?.forma_pagamento || '').trim();
  const linkPdf = pg?.gn_pdf || pg?.link_pdf || null;
  const linkBoleto = pg?.gn_link || pg?.link_boleto || null;
  return {
    id: b.id,
    mes: b.mes_referencia,
    ano: b.ano_referencia,
    valor: parseFloat(b.valor),
    vencimento: b.data_vencimento,
    status: b.status,
    dataPagamento: b.data_pagamento || pg?.data_pagamento || null,
    formaPagamento: formaRaw || null,
    pagamentoId: pg?.id || null,
    protocolo: pg?.protocolo || null,
    linkPdf,
    linkBoleto,
    barcode: pg?.gn_barcode || pg?.barcode || null,
    txid: pg?.provider_txid || pg?.gn_txid || pg?.txid || null,
    chargeId: pg?.provider_charge_id || pg?.gn_charge_id || null,
    referencia:
      b.mes_referencia && b.ano_referencia
        ? `${String(b.mes_referencia).padStart(2, '0')}/${b.ano_referencia}`
        : null,
  };
}

/**
 * Detalhe de um boleto de manutenção (com dados do pagamento vinculado).
 */
async function getBoletoManutencaoDetalhe(boletoId, usuarioId, jwtTipo) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const row = await db('manutencao_boletos as mb')
    .join('manutencoes as m', 'mb.manutencao_id', 'm.id')
    .where('mb.id', boletoId)
    .select('mb.*', 'm.cliente_id', 'm.valor as plano_valor', 'm.status as plano_status')
    .first();

  if (!row) return { ok: false, error: 'Boleto de manutenção não encontrado' };

  const cliente = await assertClienteAcessivel(db, row.cliente_id, usuarioId, jwtTipo);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  const pg = await db('pagamentos')
    .where({ origem: 'manutencao', origem_id: boletoId })
    .orderBy('id', 'desc')
    .first()
    .catch(() => null);

  return {
    ok: true,
    boleto: mapBoletoDetalhe(row, pg),
    cliente: {
      id: cliente.id,
      nome: cliente.razao_social || cliente.responsavel_nome || null,
      email: cliente.email || null,
      cnpj: cliente.documento || null,
      responsavel: cliente.responsavel_nome || null,
    },
  };
}

function buildComprovanteManutencaoHtml({ cliente, boleto }) {
  const nome = cliente.responsavel || cliente.nome || 'Cliente';
  const empresa = cliente.nome || 'sua empresa';
  const cnpj = cliente.cnpj || '';
  const ref = boleto.referencia || '—';
  const valor = formatMoneyBr(boleto.valor);
  const pagoEm = formatDateBr(boleto.dataPagamento);
  const vencimento = formatDateBr(boleto.vencimento);
  const forma = boleto.formaPagamento || 'Pagamento confirmado';
  const protocolo = boleto.protocolo || `MANUT-${boleto.id}`;
  const linkPdf = boleto.linkPdf || boleto.linkBoleto || '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Comprovante de pagamento — Manutenção</title></head>
<body style="margin:0;padding:24px;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:36px 32px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">✓</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Comprovante de pagamento</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:14px">Plano de manutenção CADBRASIL</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">Olá, <strong>${escapeHtml(nome)}</strong>,</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569">
        Segue o comprovante do pagamento da mensalidade de manutenção de
        <strong>${escapeHtml(empresa)}</strong>.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 24px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Empresa</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0">${escapeHtml(empresa)}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">CNPJ</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;font-family:monospace;border-bottom:1px solid #e2e8f0">${escapeHtml(cnpj)}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Referência</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0">${escapeHtml(ref)}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Valor</td><td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;color:#0f766e;border-bottom:1px solid #e2e8f0">${escapeHtml(valor)}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Pago em</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0">${escapeHtml(pagoEm)}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Vencimento</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0">${escapeHtml(vencimento)}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">Forma</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0">${escapeHtml(forma)}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#64748b">Protocolo</td><td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;font-family:monospace">${escapeHtml(protocolo)}</td></tr>
        </table>
      </div>
      ${
        linkPdf
          ? `<div style="text-align:center;margin:8px 0 20px">
        <a href="${escapeHtml(linkPdf)}" style="display:inline-block;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff!important;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">Abrir comprovante / boleto PDF</a>
      </div>`
          : ''
      }
      <p style="margin:0;font-size:13px;line-height:1.7;color:#94a3b8">Este comprovante foi enviado pela equipe CADBRASIL. Em caso de dúvidas, responda este e-mail ou fale conosco pelo portal.</p>
    </div>
    <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #f1f5f9">
      <p style="margin:0;font-size:12px;color:#94a3b8"><strong>CADBRASIL</strong> · Manutenção SICAF</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Envia por e-mail o comprovante de um boleto de manutenção pago.
 * @param {{ boletoId: number, usuarioId: number, jwtTipo?: string, emailDestino?: string }} opts
 */
async function enviarComprovanteManutencao({ boletoId, usuarioId, jwtTipo, emailDestino }) {
  const detalhe = await getBoletoManutencaoDetalhe(boletoId, usuarioId, jwtTipo);
  if (!detalhe.ok) return detalhe;

  const { boleto, cliente } = detalhe;
  const status = String(boleto.status || '').toLowerCase();
  const pago =
    ['pago', 'paga', 'aprovado', 'aprovada', 'paid', 'quitado', 'liberado', 'liberada'].includes(status) ||
    Boolean(boleto.dataPagamento);
  if (!pago) {
    return { ok: false, error: 'Só é possível enviar comprovante de boletos já pagos.' };
  }

  const para = String(emailDestino || cliente.email || '').trim();
  if (!para) {
    return { ok: false, error: 'Cliente sem e-mail cadastrado. Informe um destinatário.' };
  }

  const emailService = require('./email.service');
  const html = buildComprovanteManutencaoHtml({ cliente, boleto });
  const ref = boleto.referencia || `#${boleto.id}`;
  const assunto = `Comprovante de pagamento — Manutenção ${ref} · ${cliente.nome || 'CADBRASIL'}`;
  const texto = [
    `Comprovante de pagamento da manutenção ${ref}.`,
    `Empresa: ${cliente.nome || '—'}`,
    `Valor: ${formatMoneyBr(boleto.valor)}`,
    `Pago em: ${formatDateBr(boleto.dataPagamento)}`,
    boleto.linkPdf || boleto.linkBoleto
      ? `PDF: ${boleto.linkPdf || boleto.linkBoleto}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const envio = await emailService.send({
      to: para,
      subject: assunto,
      html,
      text: texto,
    });

    if (!envio.ok && !envio.skipped) {
      return { ok: false, error: envio.error || 'Falha ao enviar e-mail' };
    }

    const db = getDb();
    if (db && usuarioId) {
      try {
        await db('historico_acoes').insert({
          cliente_id: cliente.id,
          usuario_id: usuarioId,
          acao: `Comprovante de manutenção #${boletoId} enviado por e-mail para ${para}`,
          entidade: 'manutencao_boletos',
          entidade_id: boletoId,
          created_at: db.fn.now(),
        });
      } catch (_) {}
    }

    return {
      ok: true,
      message: envio.skipped
        ? `E-mail simulado (SMTP não configurado) para ${para}`
        : `Comprovante enviado para ${para}`,
      emailNotificacao: {
        enviado: Boolean(envio.sent),
        simulado: Boolean(envio.skipped),
        para,
      },
      boleto,
      cliente,
    };
  } catch (e) {
    console.error('[Manutencao] enviarComprovante:', e.message);
    return { ok: false, error: e.message || 'Falha ao enviar comprovante' };
  }
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
  getBoletoManutencaoDetalhe,
  enviarComprovanteManutencao,
  ativarManutencao,
  cancelarManutencao,
};
