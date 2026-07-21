/**
 * CRM Clientes — funil kanban com cards, timeline e anexos.
 */
const { getDb } = require('../database/connection');

const STAGES_VALIDOS = new Set(['em_negociacao', 'boleto', 'liberado', 'em_uso', 'cancelado']);
const STAGE_LEGACY_MAP = {
  analise: 'em_negociacao',
  negociacao: 'em_uso',
};
const STAGE_LABELS = {
  em_negociacao: 'Em negociação',
  boleto: 'Boleto gerado',
  liberado: 'Financeiro liberado',
  em_uso: 'Em Uso',
  cancelado: 'Cancelado',
};

function normalizeStage(stage) {
  if (!stage) return 'em_negociacao';
  const mapped = STAGE_LEGACY_MAP[stage] || stage;
  return STAGES_VALIDOS.has(mapped) ? mapped : 'em_negociacao';
}
const PRIORIDADES_VALIDAS = new Set(['alta', 'media', 'baixa']);
const CANAIS_VALIDOS = new Set(['whatsapp', 'ligacao', 'email', 'presencial']);
const TL_TIPOS = new Set(['criacao', 'contato', 'mudanca', 'nota', 'financeiro']);
const ANEXO_TIPOS = new Set(['comprovante', 'conversa', 'outro']);

function fmtDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

function fmtDateIso(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function fmtRelative(d) {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  const diffMs = Date.now() - dt.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return fmtDate(dt);
}

function formatarReal(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const num = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'));
  if (Number.isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseValorInput(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw)
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((t) => String(t).trim()).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

async function nextCodigo(db) {
  const [row] = await db.raw('SELECT MAX(id) AS maxId FROM crm_cards');
  const nextId = (row[0]?.maxId || 0) + 1;
  return `CRM-${String(nextId).padStart(3, '0')}`;
}

async function migrateStageEnums(db) {
  try {
    const [cols] = await db.raw(
      `SELECT COLUMN_TYPE AS colType FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'crm_cards' AND COLUMN_NAME = 'stage'`,
    );
    const colType = cols[0]?.colType || cols[0]?.COLUMN_TYPE || '';
    const needsMigration = /'analise'/.test(colType) || /'negociacao'/.test(colType);
    if (!needsMigration) return;

    await db.raw(
      `ALTER TABLE crm_cards MODIFY stage ENUM(
        'analise','boleto','liberado','negociacao','cancelado',
        'em_negociacao','em_uso'
      ) NOT NULL DEFAULT 'analise'`,
    );
    await db('crm_cards').where('stage', 'analise').update({ stage: 'em_negociacao' });
    await db('crm_cards').where('stage', 'negociacao').update({ stage: 'em_uso' });
    await db.raw(
      `ALTER TABLE crm_cards MODIFY stage ENUM(
        'em_negociacao','boleto','liberado','em_uso','cancelado'
      ) NOT NULL DEFAULT 'em_negociacao'`,
    );
  } catch (e) {
    console.warn('[CRM] migrateStageEnums:', e.message);
  }
}

async function ensureTables(db) {
  const hasCards = await db.schema.hasTable('crm_cards');
  if (hasCards) {
    await migrateStageEnums(db);
    return { ok: true };
  }

  try {
    if (!(await db.schema.hasTable('crm_cards'))) {
      await db.schema.createTable('crm_cards', (t) => {
        t.bigIncrements('id').primary();
        t.string('codigo', 20).notNullable().unique();
        t.bigInteger('cliente_id').unsigned().notNullable();
        t.bigInteger('consultor_id').unsigned().nullable();
        t.enum('stage', ['em_negociacao', 'boleto', 'liberado', 'em_uso', 'cancelado']).notNullable().defaultTo('em_negociacao');
        t.enum('prioridade', ['alta', 'media', 'baixa']).notNullable().defaultTo('media');
        t.enum('canal', ['whatsapp', 'ligacao', 'email', 'presencial']).notNullable().defaultTo('whatsapp');
        t.decimal('valor', 12, 2).nullable();
        t.string('boleto', 100).nullable();
        t.text('proxima_acao').nullable();
        t.date('data_acao').nullable();
        t.text('notas').nullable();
        t.json('tags').nullable();
        t.integer('progresso_docs').unsigned().notNullable().defaultTo(0);
        t.bigInteger('criado_por').unsigned().nullable();
        t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        t.timestamp('updated_at').nullable().defaultTo(db.fn.now());
        t.index(['stage'], 'idx_crm_stage');
        t.index(['consultor_id'], 'idx_crm_consultor');
        t.index(['cliente_id'], 'idx_crm_cliente');
      });
    }

    if (!(await db.schema.hasTable('crm_timeline'))) {
      await db.schema.createTable('crm_timeline', (t) => {
        t.bigIncrements('id').primary();
        t.bigInteger('card_id').unsigned().notNullable().index('idx_crm_tl_card');
        t.enum('tipo', ['criacao', 'contato', 'mudanca', 'nota', 'financeiro']).notNullable().defaultTo('nota');
        t.string('titulo', 255).notNullable();
        t.text('descricao').nullable();
        t.bigInteger('autor_id').unsigned().nullable();
        t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      });
    }

    if (!(await db.schema.hasTable('crm_anexos'))) {
      await db.schema.createTable('crm_anexos', (t) => {
        t.bigIncrements('id').primary();
        t.bigInteger('card_id').unsigned().notNullable().index('idx_crm_anexo_card');
        t.string('nome_original', 255).notNullable();
        t.text('url').notNullable();
        t.integer('tamanho').unsigned().notNullable().defaultTo(0);
        t.string('mimetype', 120).nullable();
        t.enum('tipo', ['comprovante', 'conversa', 'outro']).notNullable().defaultTo('outro');
        t.text('descricao').nullable();
        t.bigInteger('enviado_por').unsigned().nullable();
        t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
      });
    }

    return { ok: true };
  } catch (e) {
    console.error('[CRM] ensureTables:', e.message);
    return {
      ok: false,
      error: 'Não foi possível preparar as tabelas CRM. Execute scripts/db/migrations/crm-clientes.sql',
    };
  }
}

function mapClienteRow(row) {
  if (!row) return null;
  const cidade =
    row.cidade && row.estado ? `${row.cidade} - ${row.estado}` : row.cidade || '';
  return {
    id: String(row.cliente_id || row.id),
    razao: row.razao_social || row.nome_fantasia || '',
    cnpj: row.documento || '',
    cidade,
    segmento: row.porte || row.segmento || 'Não informado',
    ticket: '',
  };
}

function mapAnexoRow(row) {
  return {
    id: String(row.id),
    nome: row.nome_original,
    tipo: row.tipo || 'outro',
    mime: row.mimetype || '',
    tamanho: row.tamanho || 0,
    url: row.url,
    descricao: row.descricao || '',
    criadoEm: fmtDate(row.created_at),
  };
}

function mapTimelineRow(row) {
  return {
    data: fmtDate(row.created_at),
    titulo: row.titulo,
    descricao: row.descricao || '',
    tipo: row.tipo,
  };
}

function mapCardRow(row, timeline = [], anexos = []) {
  const cliente = mapClienteRow({
    cliente_id: row.cliente_id,
    id: row.cliente_id,
    razao_social: row.razao_social,
    nome_fantasia: row.nome_fantasia,
    documento: row.documento,
    cidade: row.cidade,
    estado: row.estado,
    porte: row.porte,
  });

  const ultimoTl = timeline[0];
  const ultimoContato = ultimoTl ? fmtRelative(ultimoTl.created_at || ultimoTl.data) : fmtRelative(row.updated_at);
  const criadoEm = fmtDate(row.created_at);
  const atualizadoEm = fmtDate(row.updated_at || row.created_at) || criadoEm;

  return {
    id: row.codigo,
    dbId: row.id,
    cliente,
    stage: normalizeStage(row.stage),
    consultorId: row.consultor_id ? String(row.consultor_id) : '',
    prioridade: row.prioridade,
    canal: row.canal,
    valor: formatarReal(row.valor),
    boleto: row.boleto || '',
    proximaAcao: row.proxima_acao || '',
    dataAcao: row.data_acao ? fmtDateIso(row.data_acao) : '',
    notas: row.notas || '',
    tags: parseTags(row.tags),
    criadoEm,
    atualizadoEm,
    ultimoContato,
    progressoDocs: row.progresso_docs || 0,
    anexos: anexos.map(mapAnexoRow),
    timeline: timeline.map(mapTimelineRow),
    consultorNome: row.consultor_nome || '',
  };
}

async function loadTimelineForCards(db, cardIds) {
  const map = new Map();
  if (!cardIds.length) return map;
  const rows = await db('crm_timeline')
    .whereIn('card_id', cardIds)
    .orderBy('created_at', 'desc');
  for (const row of rows) {
    if (!map.has(row.card_id)) map.set(row.card_id, []);
    map.get(row.card_id).push(row);
  }
  return map;
}

async function loadAnexosForCards(db, cardIds) {
  const map = new Map();
  if (!cardIds.length) return map;
  const rows = await db('crm_anexos').whereIn('card_id', cardIds).orderBy('created_at', 'desc');
  for (const row of rows) {
    if (!map.has(row.card_id)) map.set(row.card_id, []);
    map.get(row.card_id).push(row);
  }
  return map;
}

async function resolveCard(db, cardRef) {
  let row;
  if (/^\d+$/.test(String(cardRef))) {
    row = await db('crm_cards as c')
      .leftJoin('clientes as cl', 'cl.id', 'c.cliente_id')
      .leftJoin('usuarios as u', 'u.id', 'c.consultor_id')
      .where('c.id', cardRef)
      .select('c.*', 'cl.razao_social', 'cl.nome_fantasia', 'cl.documento', 'cl.cidade', 'cl.estado', 'cl.porte', 'u.nome as consultor_nome')
      .first();
  } else {
    row = await db('crm_cards as c')
      .leftJoin('clientes as cl', 'cl.id', 'c.cliente_id')
      .leftJoin('usuarios as u', 'u.id', 'c.consultor_id')
      .where('c.codigo', cardRef)
      .select('c.*', 'cl.razao_social', 'cl.nome_fantasia', 'cl.documento', 'cl.cidade', 'cl.estado', 'cl.porte', 'u.nome as consultor_nome')
      .first();
  }
  return row;
}

async function listConsultores() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const rows = await db('usuarios as u')
      .innerJoin('perfis_acesso as p', 'p.id', 'u.perfil_id')
      .whereNull('u.deleted_at')
      .whereNot('p.tipo', 'cliente')
      .where('p.ativo', 1)
      .where('u.status', 'Ativo')
      .select('u.id', 'u.nome', 'u.departamento')
      .orderBy('u.nome');

    return {
      ok: true,
      consultores: rows.map((r) => ({
        id: String(r.id),
        nome: r.nome,
        papel: r.departamento || 'Consultor',
      })),
    };
  } catch (e) {
    console.error('[CRM] Erro listConsultores:', e.message);
    return { ok: false, error: e.message };
  }
}

async function searchClientes(search = '', limit = 30) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let query = db('clientes')
      .select('id', 'razao_social', 'nome_fantasia', 'documento', 'cidade', 'estado', 'porte')
      .orderBy('razao_social', 'asc')
      .limit(Math.min(50, Math.max(1, limit)));

    const term = String(search || '').trim();
    if (term) {
      const digits = term.replace(/\D/g, '');
      query = query.where(function () {
        this.where('razao_social', 'like', `%${term}%`)
          .orWhere('nome_fantasia', 'like', `%${term}%`);
        if (digits.length >= 4) {
          this.orWhereRaw(
            "REPLACE(REPLACE(REPLACE(REPLACE(documento, '.', ''), '/', ''), '-', ''), ' ', '') LIKE ?",
            [`%${digits}%`],
          );
        }
      });
    }

    const rows = await query;
    return {
      ok: true,
      clientes: rows.map((r) => mapClienteRow({ ...r, cliente_id: r.id })),
    };
  } catch (e) {
    console.error('[CRM] Erro searchClientes:', e.message);
    return { ok: false, error: e.message };
  }
}

async function listCrmCards(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const tables = await ensureTables(db);
  if (!tables.ok) return tables;

  try {
    let query = db('crm_cards as c')
      .leftJoin('clientes as cl', 'cl.id', 'c.cliente_id')
      .leftJoin('usuarios as u', 'u.id', 'c.consultor_id')
      .select('c.*', 'cl.razao_social', 'cl.nome_fantasia', 'cl.documento', 'cl.cidade', 'cl.estado', 'cl.porte', 'u.nome as consultor_nome')
      .orderBy('c.updated_at', 'desc');

    if (opts.consultorId && opts.consultorId !== 'todos') {
      query = query.where('c.consultor_id', opts.consultorId);
    }

    const term = String(opts.search || '').trim().toLowerCase();
    if (term) {
      query = query.where(function () {
        this.where('c.codigo', 'like', `%${term}%`)
          .orWhere('cl.razao_social', 'like', `%${term}%`)
          .orWhere('cl.documento', 'like', `%${term}%`);
      });
    }

    const rows = await query;
    const cardIds = rows.map((r) => r.id);
    const tlMap = await loadTimelineForCards(db, cardIds);
    const anMap = await loadAnexosForCards(db, cardIds);

    const cards = rows.map((r) =>
      mapCardRow(r, tlMap.get(r.id) || [], anMap.get(r.id) || []),
    );

    const kpis = {
      emFunil: cards.filter((c) => c.stage !== 'cancelado').length,
      pipeline: cards
        .filter((c) => c.stage !== 'cancelado')
        .reduce((acc, c) => acc + (parseValorInput(c.valor) || 0), 0),
      liberado: cards.filter((c) => c.stage === 'liberado').length,
      negociacao: cards.filter((c) => c.stage === 'em_uso').length,
    };

    return { ok: true, cards, kpis };
  } catch (e) {
    console.error('[CRM] Erro listCrmCards:', e.message);
    return { ok: false, error: e.message };
  }
}

async function getCrmCard(cardRef) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const tables = await ensureTables(db);
  if (!tables.ok) return tables;

  try {
    const row = await resolveCard(db, cardRef);
    if (!row) return { ok: false, error: 'Card não encontrado' };

    const timeline = await db('crm_timeline')
      .where('card_id', row.id)
      .orderBy('created_at', 'desc');
    const anexos = await db('crm_anexos').where('card_id', row.id).orderBy('created_at', 'desc');

    return { ok: true, card: mapCardRow(row, timeline, anexos) };
  } catch (e) {
    console.error('[CRM] Erro getCrmCard:', e.message);
    return { ok: false, error: e.message };
  }
}

async function addTimeline(db, cardId, event, autorId) {
  const tipo = TL_TIPOS.has(event.tipo) ? event.tipo : 'nota';
  await db('crm_timeline').insert({
    card_id: cardId,
    tipo,
    titulo: event.titulo || 'Atualização',
    descricao: event.descricao || '',
    autor_id: autorId || null,
  });
}

async function createCrmCard(usuarioId, dados) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const tables = await ensureTables(db);
  if (!tables.ok) return tables;

  try {
    const clienteId = parseInt(dados.clienteId, 10);
    if (!clienteId) return { ok: false, error: 'clienteId é obrigatório' };

    const cliente = await db('clientes').where('id', clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    const stage = normalizeStage(dados.stage);
    const prioridade = PRIORIDADES_VALIDAS.has(dados.prioridade) ? dados.prioridade : 'media';
    const canal = CANAIS_VALIDOS.has(dados.canal) ? dados.canal : 'whatsapp';
    const consultorId = dados.consultorId ? parseInt(dados.consultorId, 10) : null;
    const codigo = await nextCodigo(db);

    const [cardId] = await db('crm_cards').insert({
      codigo,
      cliente_id: clienteId,
      consultor_id: consultorId || null,
      stage,
      prioridade,
      canal,
      valor: parseValorInput(dados.valor),
      boleto: dados.boleto || null,
      proxima_acao: dados.proximaAcao || null,
      data_acao: dados.dataAcao || null,
      notas: dados.notas || null,
      tags: JSON.stringify(parseTags(dados.tags)),
      progresso_docs: parseInt(dados.progressoDocs, 10) || 10,
      criado_por: usuarioId || null,
    });

    let consultorNome = '';
    if (consultorId) {
      const u = await db('usuarios').where('id', consultorId).select('nome').first();
      consultorNome = u?.nome || '';
    }

    await addTimeline(
      db,
      cardId,
      {
        tipo: 'criacao',
        titulo: 'Card criado',
        descricao: `Cadastrado no CRM${consultorNome ? ` por ${consultorNome}` : ''}`,
      },
      usuarioId,
    );

    if (dados.boleto) {
      await addTimeline(
        db,
        cardId,
        {
          tipo: 'financeiro',
          titulo: 'Boleto informado',
          descricao: `Nº ${dados.boleto}${dados.valor ? ` — ${formatarReal(parseValorInput(dados.valor))}` : ''}`,
        },
        usuarioId,
      );
    }

    return await getCrmCard(cardId);
  } catch (e) {
    console.error('[CRM] Erro createCrmCard:', e.message);
    return { ok: false, error: e.message };
  }
}

async function updateCrmCard(cardRef, dados, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const tables = await ensureTables(db);
  if (!tables.ok) return tables;

  try {
    const row = await resolveCard(db, cardRef);
    if (!row) return { ok: false, error: 'Card não encontrado' };

    const updates = { updated_at: db.fn.now() };
    const etapaAnterior = row.stage;
    let mudouEtapa = false;

    if (dados.stage) {
      updates.stage = normalizeStage(dados.stage);
      mudouEtapa = updates.stage !== normalizeStage(etapaAnterior);
    }
    if (dados.consultorId !== undefined) {
      updates.consultor_id = dados.consultorId ? parseInt(dados.consultorId, 10) : null;
    }
    if (dados.prioridade && PRIORIDADES_VALIDAS.has(dados.prioridade)) {
      updates.prioridade = dados.prioridade;
    }
    if (dados.canal && CANAIS_VALIDOS.has(dados.canal)) {
      updates.canal = dados.canal;
    }
    if (dados.valor !== undefined) updates.valor = parseValorInput(dados.valor);
    if (dados.boleto !== undefined) updates.boleto = dados.boleto || null;
    if (dados.proximaAcao !== undefined) updates.proxima_acao = dados.proximaAcao || null;
    if (dados.dataAcao !== undefined) updates.data_acao = dados.dataAcao || null;
    if (dados.notas !== undefined) updates.notas = dados.notas || null;
    if (dados.tags !== undefined) updates.tags = JSON.stringify(parseTags(dados.tags));
    if (dados.progressoDocs !== undefined) {
      updates.progresso_docs = Math.min(100, Math.max(0, parseInt(dados.progressoDocs, 10) || 0));
    }

    await db('crm_cards').where('id', row.id).update(updates);

    if (mudouEtapa) {
      await addTimeline(
        db,
        row.id,
        {
          tipo: 'mudanca',
          titulo: 'Etapa alterada',
          descricao: `De "${STAGE_LABELS[normalizeStage(etapaAnterior)] || etapaAnterior}" para "${STAGE_LABELS[updates.stage] || updates.stage}"`,
        },
        usuarioId,
      );
    } else {
      await addTimeline(
        db,
        row.id,
        {
          tipo: 'nota',
          titulo: 'Card atualizado',
          descricao: 'Informações do atendimento revisadas pelo consultor.',
        },
        usuarioId,
      );
    }

    return await getCrmCard(row.id);
  } catch (e) {
    console.error('[CRM] Erro updateCrmCard:', e.message);
    return { ok: false, error: e.message };
  }
}

async function adicionarAnexo(cardRef, fileInfo, usuarioId, tipo = 'outro') {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const tables = await ensureTables(db);
  if (!tables.ok) return tables;

  try {
    const row = await resolveCard(db, cardRef);
    if (!row) return { ok: false, error: 'Card não encontrado' };

    const anexoTipo = ANEXO_TIPOS.has(tipo) ? tipo : 'outro';
    const [id] = await db('crm_anexos').insert({
      card_id: row.id,
      nome_original: fileInfo.originalName || fileInfo.originalname || 'arquivo',
      url: fileInfo.fullUrl || fileInfo.url || '',
      tamanho: fileInfo.size || 0,
      mimetype: fileInfo.mimetype || '',
      tipo: anexoTipo,
      enviado_por: usuarioId || null,
    });

    await addTimeline(
      db,
      row.id,
      {
        tipo: 'nota',
        titulo: 'Anexo adicionado',
        descricao: fileInfo.originalName || fileInfo.originalname || 'arquivo',
      },
      usuarioId,
    );

    const anexo = await db('crm_anexos').where('id', id).first();
    return { ok: true, anexo: mapAnexoRow(anexo) };
  } catch (e) {
    console.error('[CRM] Erro adicionarAnexo:', e.message);
    return { ok: false, error: e.message };
  }
}

async function removerAnexo(anexoId, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const anexo = await db('crm_anexos').where('id', anexoId).first();
    if (!anexo) return { ok: false, error: 'Anexo não encontrado' };
    await db('crm_anexos').where('id', anexoId).delete();
    return { ok: true, url: anexo.url };
  } catch (e) {
    console.error('[CRM] Erro removerAnexo:', e.message);
    return { ok: false, error: e.message };
  }
}

async function clienteTemPagamentoConfirmado(db, clienteId) {
  const { TAXA_SICAF_PAGA_WHERE } = require('../utils/sicaf-pagamento-resumo');
  const { resolveFinancialReleased } = require('../utils/sicaf-status');

  let taxaReleased = false;
  try {
    const pago = await db('taxas_sicaf')
      .where('cliente_id', clienteId)
      .whereRaw(TAXA_SICAF_PAGA_WHERE)
      .first();
    taxaReleased = !!pago;
  } catch (_) {}

  const pagoSql =
    "(LOWER(TRIM(CAST(status AS CHAR))) IN ('pago','paga','aprovado','aprovada','paid','quitado','confirmado','confirmada','liberado','liberada') OR status IN ('Pago','Paga','Aprovado','Aprovada','Confirmado','Liberado'))";

  if (!taxaReleased) {
    try {
      if (await db.schema.hasTable('pagamentos')) {
        const p = await db('pagamentos')
          .where('cliente_id', clienteId)
          .whereRaw(pagoSql)
          .first();
        if (p) taxaReleased = true;
      }
    } catch (_) {}
  }

  if (!taxaReleased) {
    try {
      if (await db.schema.hasTable('pagamentos_gerencianet')) {
        const p = await db('pagamentos_gerencianet')
          .where('cliente_id', clienteId)
          .whereRaw(pagoSql)
          .first();
        if (p) taxaReleased = true;
      }
    } catch (_) {}
  }

  let sicaf = null;
  try {
    sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
  } catch (_) {}

  return resolveFinancialReleased({
    hasSicaf: !!sicaf,
    sicafStatus: sicaf?.status || null,
    dataValidade: sicaf?.data_validade || null,
    taxaReleased,
  });
}

/**
 * Cards em "Boleto gerado": se o cliente já pagou / financeiro liberado,
 * move automaticamente para "Financeiro liberado".
 */
async function sincronizarBoletosPagos(usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const tables = await ensureTables(db);
  if (!tables.ok) return tables;

  try {
    const cards = await db('crm_cards as c')
      .leftJoin('clientes as cl', 'cl.id', 'c.cliente_id')
      .where('c.stage', 'boleto')
      .select(
        'c.id',
        'c.codigo',
        'c.cliente_id',
        'c.stage',
        'cl.razao_social',
        'cl.nome_fantasia',
        'cl.documento',
      )
      .orderBy('c.updated_at', 'desc');

    let verificados = 0;
    let promovidos = 0;
    let pendentes = 0;
    const detalhes = [];

    for (const card of cards) {
      verificados += 1;
      const clienteId = Number(card.cliente_id);
      if (!clienteId) {
        pendentes += 1;
        detalhes.push({
          cardId: card.codigo,
          cliente: card.razao_social || card.nome_fantasia || '',
          status: 'sem_cliente',
          mensagem: 'Card sem cliente vinculado',
        });
        continue;
      }

      const pago = await clienteTemPagamentoConfirmado(db, clienteId);
      if (!pago) {
        pendentes += 1;
        detalhes.push({
          cardId: card.codigo,
          cliente: card.razao_social || card.nome_fantasia || '',
          documento: card.documento || '',
          status: 'pendente',
          mensagem: 'Pagamento ainda não confirmado',
        });
        continue;
      }

      await db('crm_cards').where('id', card.id).update({
        stage: 'liberado',
        updated_at: db.fn.now(),
      });

      await addTimeline(
        db,
        card.id,
        {
          tipo: 'financeiro',
          titulo: 'Pagamento confirmado',
          descricao:
            'Sincronização automática: boleto quitado — etapa alterada para Financeiro liberado.',
        },
        usuarioId,
      );

      promovidos += 1;
      detalhes.push({
        cardId: card.codigo,
        cliente: card.razao_social || card.nome_fantasia || '',
        documento: card.documento || '',
        status: 'promovido',
        mensagem: 'Movido para Financeiro liberado',
      });
    }

    return {
      ok: true,
      verificados,
      promovidos,
      pendentes,
      detalhes,
      message:
        promovidos > 0
          ? `${promovidos} card(s) movido(s) para Financeiro liberado`
          : verificados === 0
            ? 'Nenhum card em Boleto gerado'
            : 'Nenhum pagamento novo confirmado',
    };
  } catch (e) {
    console.error('[CRM] Erro sincronizarBoletosPagos:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  listConsultores,
  searchClientes,
  listCrmCards,
  getCrmCard,
  createCrmCard,
  updateCrmCard,
  adicionarAnexo,
  removerAnexo,
  sincronizarBoletosPagos,
};
