/**
 * Disparo em massa e execução da régua de cobrança.
 */
const { getDb } = require('../database/connection');
const { loadAllClientesCobrancaPendentes, enviarCobrancaTaxa } = require('./cobranca-taxa.service');
const {
  ensureReguaTables,
  ensureDisparoMassaTable,
  ensureCobrancaHistoricoColumns,
  getReguaCobranca,
} = require('./cobranca-regua.service');

const MODELOS_MENSAGEM = {
  lembrete_amigavel:
    '{nome}, lembramos que o pagamento de {valor} referente a {servico} está pendente. Acesse: {link}',
  segunda_cobranca:
    '{nome}, sua pendência de {valor} segue em aberto há {dias} dias. Para evitar bloqueio, regularize pelo link: {link}',
  aviso_final:
    '{nome}, aviso final: pendência de {valor} ({servico}) em aberto há {dias} dias. Regularize imediatamente: {link}',
};

function formatMoneyBr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderMensagem(template, cliente) {
  const nome = cliente.responsavel || cliente.company || 'Cliente';
  const map = {
    nome,
    servico: cliente.descricao || 'Taxa SICAF CADBRASIL',
    valor: formatMoneyBr(cliente.valor),
    dias: String(cliente.diasPendente ?? 0),
    link: cliente.payLink || '',
    empresa: cliente.company || '',
    cnpj: cliente.cnpj || '',
  };
  let out = String(template || '');
  for (const [key, val] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'gi'), val);
  }
  return out;
}

async function getResumoPublicoAlvo() {
  await processarDisparosAgendados().catch(() => null);
  await processarReguaCobranca({ usuarioId: null }).catch(() => null);

  const all = await loadAllClientesCobrancaPendentes();
  return {
    ok: true,
    publico: {
      todos: all.length,
      critica: all.filter((c) => c.severidade === 'critica').length,
      media: all.filter((c) => c.severidade === 'media').length,
      leve: all.filter((c) => c.severidade === 'leve').length,
    },
    valorTotal: Math.round(all.reduce((acc, c) => acc + c.valor, 0) * 100) / 100,
  };
}

function filtrarPublicoAlvo(all, publicoAlvo) {
  const p = String(publicoAlvo || 'todos').toLowerCase();
  if (p === 'critica') return all.filter((c) => c.severidade === 'critica');
  if (p === 'media') return all.filter((c) => c.severidade === 'media');
  if (p === 'leve') return all.filter((c) => c.severidade === 'leve');
  return all;
}

function proximoDiaUtilAs9h() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  d.setHours(9, 0, 0, 0);
  return d;
}

async function registrarCobrancaCanal(db, {
  clienteId,
  taxaId,
  pagamentoId,
  emailDestino,
  canal,
  mensagem,
  modelo,
  sucesso,
  erro,
  usuarioId,
  disparoMassaId,
  reguaEtapaId,
}) {
  await ensureCobrancaHistoricoColumns(db);
  const payload = {
    taxa_sicaf_id: taxaId || null,
    pagamento_id: pagamentoId || null,
    cliente_id: clienteId,
    email_destino: emailDestino || '',
    canal: canal || 'email',
    mensagem: mensagem ? String(mensagem).slice(0, 5000) : null,
    modelo: modelo || null,
    disparo_massa_id: disparoMassaId || null,
    regua_etapa_id: reguaEtapaId || null,
    enviado_por: usuarioId || null,
    sucesso: sucesso ? 1 : 0,
    erro: erro ? String(erro).slice(0, 2000) : null,
    enviado_em: new Date(),
  };
  try {
    await db('cobrancas_taxa_sicaf').insert(payload);
  } catch (e) {
    console.warn('[CobrancaDisparo] Falha histórico:', e.message);
  }
}

async function enviarCanalCliente({
  db,
  cliente,
  canal,
  mensagem,
  modelo,
  usuarioId,
  disparoMassaId,
  reguaEtapaId,
}) {
  const texto = renderMensagem(mensagem, cliente);

  if (canal === 'email') {
    if (!cliente.email) {
      await registrarCobrancaCanal(db, {
        clienteId: cliente.clienteId,
        taxaId: cliente.taxaId,
        pagamentoId: cliente.pagamentoId,
        emailDestino: '',
        canal: 'email',
        mensagem: texto,
        modelo,
        sucesso: false,
        erro: 'Sem e-mail',
        usuarioId,
        disparoMassaId,
        reguaEtapaId,
      });
      return { ok: false, error: 'Sem e-mail' };
    }
    const res = await enviarCobrancaTaxa({
      clienteId: cliente.clienteId,
      taxaId: cliente.taxaId,
      pagamentoId: cliente.pagamentoId,
      usuarioId,
      mensagemCustom: texto,
      modelo,
      canal: 'email',
      disparoMassaId,
      reguaEtapaId,
      skipHistoricoDuplicado: true,
    });
    if (!res.ok) {
      await registrarCobrancaCanal(db, {
        clienteId: cliente.clienteId,
        taxaId: cliente.taxaId,
        pagamentoId: cliente.pagamentoId,
        emailDestino: cliente.email,
        canal: 'email',
        mensagem: texto,
        modelo,
        sucesso: false,
        erro: res.error,
        usuarioId,
        disparoMassaId,
        reguaEtapaId,
      });
      return res;
    }
    await registrarCobrancaCanal(db, {
      clienteId: cliente.clienteId,
      taxaId: cliente.taxaId,
      pagamentoId: cliente.pagamentoId,
      emailDestino: cliente.email,
      canal: 'email',
      mensagem: texto,
      modelo,
      sucesso: true,
      usuarioId,
      disparoMassaId,
      reguaEtapaId,
    });
    return { ok: true };
  }

  if (canal === 'whatsapp' || canal === 'sms' || canal === 'ligacao') {
    await registrarCobrancaCanal(db, {
      clienteId: cliente.clienteId,
      taxaId: cliente.taxaId,
      pagamentoId: cliente.pagamentoId,
      emailDestino: cliente.email || cliente.telefone || '',
      canal,
      mensagem: texto,
      modelo,
      sucesso: true,
      usuarioId,
      disparoMassaId,
      reguaEtapaId,
    });
    return { ok: true, registrado: true };
  }

  return { ok: false, error: 'Canal inválido' };
}

async function processarDisparoMassaInterno(db, disparoId, usuarioId) {
  const disparo = await db('cobranca_disparos_massa').where('id', disparoId).first();
  if (!disparo) return { ok: false, error: 'Disparo não encontrado' };

  let canais = [];
  try {
    canais = typeof disparo.canais === 'string' ? JSON.parse(disparo.canais) : disparo.canais || [];
  } catch (_) {
    canais = ['email'];
  }
  if (!canais.length) canais = ['email'];

  const all = filtrarPublicoAlvo(await loadAllClientesCobrancaPendentes(), disparo.publico_alvo);
  let enviados = 0;
  let erros = 0;

  await db('cobranca_disparos_massa').where('id', disparoId).update({
    status: 'processando',
    total_destinatarios: all.length,
  });

  for (const cliente of all) {
    let clienteOk = false;
    for (const canal of canais) {
      if (canal === 'nenhum') continue;
      const res = await enviarCanalCliente({
        db,
        cliente,
        canal,
        mensagem: disparo.mensagem,
        modelo: disparo.modelo,
        usuarioId,
        disparoMassaId: disparoId,
      });
      if (res.ok) clienteOk = true;
    }
    if (clienteOk) enviados += 1;
    else erros += 1;
  }

  await db('cobranca_disparos_massa').where('id', disparoId).update({
    status: 'concluido',
    total_enviados: enviados,
    total_erros: erros,
    concluido_em: new Date(),
  });

  return {
    ok: true,
    disparoId,
    totalDestinatarios: all.length,
    totalEnviados: enviados,
    totalErros: erros,
    message: `Disparo concluído: ${enviados} de ${all.length} clientes processados`,
  };
}

async function processarDisparosAgendados() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureDisparoMassaTable(db);

  const pendentes = await db('cobranca_disparos_massa')
    .where('status', 'agendado')
    .where('agendado_para', '<=', new Date())
    .limit(5);

  const results = [];
  for (const d of pendentes) {
    results.push(await processarDisparoMassaInterno(db, d.id, d.criado_por));
  }

  return { ok: true, processados: results.length, results };
}

async function executarDisparoMassa({
  publicoAlvo,
  canais,
  modelo,
  mensagem,
  agendar,
  usuarioId,
}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureDisparoMassaTable(db);
  await processarDisparosAgendados();

  const publico = String(publicoAlvo || 'todos').toLowerCase();
  const canaisArr = Array.isArray(canais) ? canais.filter(Boolean) : ['email'];
  const texto =
    String(mensagem || '').trim() ||
    MODELOS_MENSAGEM[modelo] ||
    MODELOS_MENSAGEM.segunda_cobranca;

  const destinatarios = filtrarPublicoAlvo(await loadAllClientesCobrancaPendentes(), publico);
  if (!destinatarios.length) {
    return { ok: false, error: 'Nenhum destinatário encontrado para o público selecionado' };
  }

  const agendarFlag = agendar === true || agendar === 'true' || agendar === 1;
  const agendadoPara = agendarFlag ? proximoDiaUtilAs9h() : null;

  const [disparoId] = await db('cobranca_disparos_massa').insert({
    publico_alvo: publico,
    canais: JSON.stringify(canaisArr),
    modelo: modelo || null,
    mensagem: texto,
    agendar: agendarFlag ? 1 : 0,
    agendado_para: agendadoPara,
    status: agendarFlag ? 'agendado' : 'processando',
    total_destinatarios: destinatarios.length,
    criado_por: usuarioId || null,
    created_at: new Date(),
  });

  if (agendarFlag) {
    return {
      ok: true,
      agendado: true,
      disparoId,
      agendadoPara: agendadoPara.toISOString(),
      totalDestinatarios: destinatarios.length,
      message: `Disparo agendado para ${agendadoPara.toLocaleString('pt-BR')} — ${destinatarios.length} clientes`,
    };
  }

  return processarDisparoMassaInterno(db, disparoId, usuarioId);
}

function matchesReguaStep(cliente, diasRelativo) {
  const ref = cliente.dataVencimento || cliente.pendenteDesde;
  if (!ref) {
    return diasRelativo >= 0 && cliente.diasPendente === diasRelativo;
  }
  const refDate = new Date(ref);
  if (Number.isNaN(refDate.getTime())) return false;
  refDate.setHours(0, 0, 0, 0);
  const target = new Date(refDate);
  target.setDate(target.getDate() + diasRelativo);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target.getTime() === today.getTime();
}

async function jaExecutouReguaHoje(db, clienteId, etapaId) {
  const row = await db('cobrancas_taxa_sicaf')
    .where({ cliente_id: clienteId, regua_etapa_id: etapaId })
    .whereRaw('DATE(enviado_em) = CURDATE()')
    .first();
  return !!row;
}

async function processarReguaCobranca({ usuarioId, forcar } = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureReguaTables(db);
  await ensureCobrancaHistoricoColumns(db);

  const regua = await getReguaCobranca();
  if (!regua.ok) return regua;
  if (!regua.automacaoAtiva && !forcar) {
    return { ok: true, executado: false, motivo: 'automacao_desligada' };
  }

  const etapas = (regua.etapas || []).filter((e) => e.ativo && e.canal !== 'nenhum');
  const clientes = await loadAllClientesCobrancaPendentes();
  let totalAcoes = 0;

  for (const etapa of etapas) {
    for (const cliente of clientes) {
      if (!matchesReguaStep(cliente, etapa.diasRelativo)) continue;
      if (await jaExecutouReguaHoje(db, cliente.clienteId, etapa.id)) continue;

      const res = await enviarCanalCliente({
        db,
        cliente,
        canal: etapa.canal,
        mensagem: etapa.mensagem,
        modelo: `regua:${etapa.id}`,
        usuarioId,
        reguaEtapaId: etapa.id,
      });
      if (res.ok) totalAcoes += 1;
    }
  }

  await db('regua_cobranca_config').where('id', 1).update({
    ultima_execucao_em: new Date(),
  });

  return {
    ok: true,
    executado: true,
    totalAcoes,
    message: `Régua processada — ${totalAcoes} ação(ões) registradas`,
  };
}

module.exports = {
  MODELOS_MENSAGEM,
  getResumoPublicoAlvo,
  executarDisparoMassa,
  processarDisparosAgendados,
  processarReguaCobranca,
  renderMensagem,
};
