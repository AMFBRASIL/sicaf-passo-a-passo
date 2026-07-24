/**
 * Fluxos de automação (/admin/automacoes) — persistência + execução de gatilhos.
 */
const { getDb } = require('../database/connection');
const { renovarManutencao, isCicloManutencaoCompleto } = require('./manutencao.service');

/** Catálogo inicial — mesmos fluxos que existiam na tela antes da persistência. */
const SEED_FLUXOS = [
  {
    id: 'renovar-manutencao',
    nome: 'Renovar Manutenção Cliente',
    descricao: 'Renova a manutenção do cliente de forma automática ao quitar o ciclo.',
    gatilho_tipo: 'manutencao_ciclo_completo',
    gatilho_label: 'Ciclo de manutenção quitado',
    acoes: [
      {
        tipo: 'renovar_manutencao',
        label: 'Renovar manutenção (novo ciclo de boletos)',
        delay: 'imediato',
      },
      { tipo: 'email', label: 'E-mail avisando renovação', delay: 'imediato' },
    ],
    ativo: 1,
    rodou: 0,
  },
  {
    id: '1',
    nome: 'Boas-vindas ao pagar',
    descricao: 'Onboarding automático após confirmação do pagamento',
    gatilho_tipo: 'pagamento_recebido',
    gatilho_label: 'Cliente pagou fatura',
    acoes: [
      { tipo: 'ticket', label: 'Criar ticket de onboarding', delay: 'imediato' },
      { tipo: 'email', label: 'Enviar e-mail de boas-vindas', delay: 'imediato' },
      { tipo: 'acesso', label: 'Liberar acesso ao SICAF', delay: 'imediato' },
    ],
    ativo: 1,
    rodou: 142,
  },
  {
    id: '2',
    nome: 'E-mail ao ativar SICAF',
    descricao: 'Notifica o cliente quando o cadastro SICAF é ativado',
    gatilho_tipo: 'sicaf_ativado',
    gatilho_label: 'Cliente SICAF ativado',
    acoes: [
      { tipo: 'email', label: 'E-mail de SICAF ativo', delay: 'imediato' },
      { tipo: 'whatsapp', label: 'WhatsApp de confirmação', delay: 'imediato' },
    ],
    ativo: 1,
    rodou: 89,
  },
  {
    id: '3',
    nome: 'E-mail ao cancelar SICAF',
    descricao: 'Envia template de cancelamento quando status muda para Cancelado',
    gatilho_tipo: 'sicaf_cancelado',
    gatilho_label: 'Cliente SICAF cancelado',
    acoes: [
      { tipo: 'email', label: 'E-mail de cancelamento (template)', delay: 'imediato' },
      { tipo: 'alerta', label: 'Alertar gerente da conta', delay: 'imediato' },
    ],
    ativo: 1,
    rodou: 23,
  },
  {
    id: '4',
    nome: 'Renovação SICAF vencendo',
    descricao: null,
    gatilho_tipo: 'sicaf_vencendo',
    gatilho_label: 'SICAF entrando em vencimento',
    acoes: [
      { tipo: 'email', label: 'E-mail de renovação', delay: 'imediato' },
      { tipo: 'whatsapp', label: 'Lembrete WhatsApp', delay: '1 dia depois' },
      { tipo: 'cobranca', label: 'Gerar taxa de renovação', delay: '3 dias depois' },
    ],
    ativo: 1,
    rodou: 156,
  },
  {
    id: '5',
    nome: 'Aviso de certidão vencendo',
    descricao: null,
    gatilho_tipo: 'certidao_vencendo',
    gatilho_label: 'Certidão vence em X dias',
    acoes: [
      { tipo: 'whatsapp', label: 'WhatsApp para responsável', delay: 'imediato' },
      { tipo: 'email', label: 'E-mail com checklist', delay: '1 dia depois' },
      { tipo: 'tarefa', label: 'Criar tarefa para operador', delay: 'imediato' },
    ],
    ativo: 1,
    rodou: 68,
  },
  {
    id: '6',
    nome: 'Cobrança automática',
    descricao: null,
    gatilho_tipo: 'boleto_vencendo',
    gatilho_label: 'Boleto vence em X dias',
    acoes: [
      { tipo: 'whatsapp', label: 'Lembrete WhatsApp', delay: '3 dias antes' },
      { tipo: 'cobranca', label: 'Gerar 2ª via PIX', delay: 'no vencimento' },
    ],
    ativo: 1,
    rodou: 231,
  },
  {
    id: '7',
    nome: 'SICAF suspenso — alerta equipe',
    descricao: null,
    gatilho_tipo: 'sicaf_suspenso',
    gatilho_label: 'Cliente SICAF suspenso',
    acoes: [
      { tipo: 'email', label: 'E-mail de suspensão ao cliente', delay: 'imediato' },
      { tipo: 'alerta', label: 'Notificar operador responsável', delay: 'imediato' },
      { tipo: 'ticket', label: 'Abrir ticket de regularização', delay: 'imediato' },
    ],
    ativo: 1,
    rodou: 11,
  },
  {
    id: '8',
    nome: 'Recuperar cliente em risco',
    descricao: null,
    gatilho_tipo: 'score_risco',
    gatilho_label: 'Score de cancelamento alto',
    acoes: [
      { tipo: 'alerta', label: 'Alertar gerente da conta', delay: 'imediato' },
      { tipo: 'email', label: 'Oferta de retenção', delay: '1 dia depois' },
    ],
    ativo: 0,
    rodou: 14,
  },
  {
    id: '9',
    nome: 'Novo cliente — sequência de boas-vindas',
    descricao: null,
    gatilho_tipo: 'novo_cliente',
    gatilho_label: 'Novo cliente cadastrado',
    acoes: [
      { tipo: 'email', label: 'E-mail de boas-vindas', delay: 'imediato' },
      { tipo: 'agendar', label: 'Follow-up em 3 dias', delay: '3 dias depois' },
      { tipo: 'ticket', label: 'Ticket de onboarding', delay: 'imediato' },
    ],
    ativo: 1,
    rodou: 47,
  },
  {
    id: '10',
    nome: 'Documento reprovado',
    descricao: null,
    gatilho_tipo: 'certidao_reprovada',
    gatilho_label: 'Certidão reprovada',
    acoes: [
      { tipo: 'email', label: 'E-mail com motivo da reprovação', delay: 'imediato' },
      { tipo: 'whatsapp', label: 'WhatsApp solicitando reenvio', delay: '1 dia depois' },
    ],
    ativo: 1,
    rodou: 34,
  },
];

function parseAcoes(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw == null) return [];
  if (typeof raw === 'object') return Array.isArray(raw) ? raw : [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapFluxo(row) {
  return {
    id: String(row.id),
    nome: row.nome,
    descricao: row.descricao || '',
    gatilho: row.gatilho_label || row.gatilho_tipo,
    gatilhoTipo: row.gatilho_tipo,
    condicoes: row.condicoes || '',
    acoes: parseAcoes(row.acoes_json),
    ativo: !!Number(row.ativo),
    rodou: Number(row.rodou) || 0,
  };
}

async function ensureTable(db) {
  const has = await db.schema.hasTable('automacao_fluxos');
  if (has) return true;
  try {
    await db.schema.createTable('automacao_fluxos', (t) => {
      t.string('id', 64).primary();
      t.string('nome', 180).notNullable();
      t.text('descricao').nullable();
      t.string('gatilho_tipo', 80).notNullable();
      t.string('gatilho_label', 180).nullable();
      t.text('condicoes').nullable();
      t.json('acoes_json').notNullable();
      t.boolean('ativo').notNullable().defaultTo(true);
      t.integer('rodou').notNullable().defaultTo(0);
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
      t.index(['gatilho_tipo', 'ativo']);
    });
    return true;
  } catch (e) {
    console.error('[Automacoes] Falha ao criar tabela automacao_fluxos:', e.message);
    return false;
  }
}

async function ensureSeed(db) {
  for (const seed of SEED_FLUXOS) {
    const existing = await db('automacao_fluxos').where('id', seed.id).first();
    if (existing) continue;
    await db('automacao_fluxos').insert({
      id: seed.id,
      nome: seed.nome,
      descricao: seed.descricao,
      gatilho_tipo: seed.gatilho_tipo,
      gatilho_label: seed.gatilho_label,
      acoes_json: JSON.stringify(seed.acoes),
      ativo: seed.ativo ? 1 : 0,
      rodou: Number(seed.rodou) || 0,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }
}

async function listFluxos() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const ready = await ensureTable(db);
  if (!ready) return { ok: false, error: 'Tabela automacao_fluxos indisponível' };
  await ensureSeed(db);
  const rows = await db('automacao_fluxos').orderBy('updated_at', 'desc');
  return { ok: true, fluxos: rows.map(mapFluxo) };
}

async function salvarFluxo(fluxo) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const ready = await ensureTable(db);
  if (!ready) return { ok: false, error: 'Tabela automacao_fluxos indisponível' };

  const id = String(fluxo.id || '').trim() || `fluxo-${Date.now()}`;
  const nome = String(fluxo.nome || '').trim();
  if (!nome) return { ok: false, error: 'Nome do fluxo é obrigatório' };
  const gatilhoTipo = String(fluxo.gatilhoTipo || fluxo.gatilho_tipo || '').trim();
  if (!gatilhoTipo) return { ok: false, error: 'Gatilho é obrigatório' };

  const acoes = Array.isArray(fluxo.acoes) ? fluxo.acoes : [];
  const payload = {
    id,
    nome,
    descricao: fluxo.descricao != null ? String(fluxo.descricao) : null,
    gatilho_tipo: gatilhoTipo,
    gatilho_label: String(fluxo.gatilho || '').trim() || gatilhoTipo,
    condicoes: fluxo.condicoes != null ? String(fluxo.condicoes) : null,
    acoes_json: JSON.stringify(acoes),
    ativo: fluxo.ativo === false || fluxo.ativo === 0 ? 0 : 1,
    updated_at: db.fn.now(),
  };

  const exists = await db('automacao_fluxos').where('id', id).first();
  if (exists) {
    await db('automacao_fluxos').where('id', id).update(payload);
  } else {
    await db('automacao_fluxos').insert({
      ...payload,
      rodou: Number(fluxo.rodou) || 0,
      created_at: db.fn.now(),
    });
  }

  const row = await db('automacao_fluxos').where('id', id).first();
  return { ok: true, fluxo: mapFluxo(row), message: 'Fluxo salvo com sucesso' };
}

async function toggleFluxo(id, ativo) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const ready = await ensureTable(db);
  if (!ready) return { ok: false, error: 'Tabela automacao_fluxos indisponível' };

  const row = await db('automacao_fluxos').where('id', String(id)).first();
  if (!row) return { ok: false, error: 'Fluxo não encontrado' };

  const next = typeof ativo === 'boolean' ? (ativo ? 1 : 0) : Number(row.ativo) ? 0 : 1;
  await db('automacao_fluxos').where('id', String(id)).update({
    ativo: next,
    updated_at: db.fn.now(),
  });
  const updated = await db('automacao_fluxos').where('id', String(id)).first();
  return {
    ok: true,
    fluxo: mapFluxo(updated),
    message: next ? 'Fluxo ativado' : 'Fluxo pausado',
  };
}

async function executarAcao(acao, payload) {
  const tipo = String(acao?.tipo || '').trim();
  if (tipo === 'renovar_manutencao') {
    const clienteId = Number(payload.clienteId);
    if (!clienteId) return { ok: false, error: 'clienteId ausente' };
    return renovarManutencao({
      clienteId,
      system: true,
      diaVencimento: payload.diaVencimento,
      parcelamento: payload.parcelamento,
    });
  }
  // Demais ações ainda são catalogadas no wizard; execução específica virá depois.
  return { ok: true, skipped: true, tipo };
}

/**
 * Dispara fluxos ativos com o gatilho informado.
 */
async function emitGatilho(gatilhoTipo, payload = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível', executados: 0 };

  const ready = await ensureTable(db);
  if (!ready) return { ok: false, error: 'Tabela automacao_fluxos indisponível', executados: 0 };
  await ensureSeed(db);

  const fluxos = await db('automacao_fluxos')
    .where({ gatilho_tipo: String(gatilhoTipo), ativo: 1 })
    .select('*');

  const resultados = [];
  for (const row of fluxos) {
    const acoes = parseAcoes(row.acoes_json);
    const acaoResults = [];
    for (const acao of acoes) {
      try {
        const r = await executarAcao(acao, payload);
        acaoResults.push({ tipo: acao.tipo, ...r });
      } catch (e) {
        acaoResults.push({ tipo: acao.tipo, ok: false, error: e.message });
      }
    }
    const teveSucesso = acaoResults.some((r) => r.ok && !r.skipped);
    if (teveSucesso) {
      await db('automacao_fluxos')
        .where('id', row.id)
        .update({ rodou: Number(row.rodou || 0) + 1, updated_at: db.fn.now() });
    }
    resultados.push({ fluxoId: row.id, nome: row.nome, acoes: acaoResults });
  }

  return {
    ok: true,
    gatilhoTipo,
    executados: resultados.length,
    resultados,
  };
}

/**
 * Após marcar boleto de manutenção como pago: se o ciclo ficou completo, emite o gatilho.
 */
async function onManutencaoBoletoPago({ clienteId, manutencaoId, boletoId }) {
  try {
    const idCliente = Number(clienteId);
    if (!idCliente) return { ok: false, skipped: true, reason: 'clienteId inválido' };

    const completo = await isCicloManutencaoCompleto(idCliente, manutencaoId || null);
    if (!completo) {
      return { ok: true, skipped: true, reason: 'ciclo ainda incompleto' };
    }

    console.log(
      `[Automacoes] Ciclo completo cliente=${idCliente} boleto=${boletoId || '-'} → emitindo manutencao_ciclo_completo`,
    );
    return emitGatilho('manutencao_ciclo_completo', {
      clienteId: idCliente,
      manutencaoId: manutencaoId || null,
      boletoId: boletoId || null,
    });
  } catch (e) {
    console.error('[Automacoes] onManutencaoBoletoPago:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  listFluxos,
  salvarFluxo,
  toggleFluxo,
  emitGatilho,
  onManutencaoBoletoPago,
};
