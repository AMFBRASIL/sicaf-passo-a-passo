/**
 * Email Marketing — campanhas, templates e automações (Admin → CRM).
 */
const { getDb } = require('../database/connection');

const PUBLICO_LABELS = {
  manutencao: 'Clientes em manutenção',
  cnae: 'Filtro por CNAE',
  'cert-venc': 'Certidões vencendo (30d)',
  sicaf: 'SICAF a vencer / vencido',
  novos: 'Novos clientes (7d)',
  todos: 'Todos os clientes',
};

const DEFAULT_AUTOMACOES = [
  {
    codigo: 'boletim_licitacoes',
    nome: 'Boletim diário de licitações',
    descricao: 'Envio diário às 07:00 com editais compatíveis com o CNAE de cada cliente.',
    icone: 'Gavel',
    tom: 'text-emerald-600 bg-emerald-100',
    ativo: 1,
    stats_texto: 'Aguardando primeira execução',
  },
  {
    codigo: 'alerta_certidao',
    nome: 'Alerta de certidão vencendo',
    descricao: 'Dispara 30, 15 e 5 dias antes do vencimento de cada certidão.',
    icone: 'FileCheck2',
    tom: 'text-amber-600 bg-amber-100',
    ativo: 1,
    stats_texto: 'Aguardando primeira execução',
  },
  {
    codigo: 'alerta_sicaf',
    nome: 'SICAF vencido / prestes a vencer',
    descricao: 'Notifica o responsável quando o SICAF atinge 10 dias para vencer.',
    icone: 'BellRing',
    tom: 'text-rose-600 bg-rose-100',
    ativo: 1,
    stats_texto: 'Aguardando primeira execução',
  },
  {
    codigo: 'boas_vindas',
    nome: 'Boas-vindas para novos clientes',
    descricao: 'Trilha de 3 e-mails no primeiro acesso ao portal.',
    icone: 'Sparkles',
    tom: 'text-blue-600 bg-blue-100',
    ativo: 1,
    stats_texto: 'Aguardando primeira execução',
  },
  {
    codigo: 'manutencao_mensal',
    nome: 'Aviso de manutenção mensal',
    descricao: 'Resumo mensal do que foi feito pela equipe CADBRASIL.',
    icone: 'Mail',
    tom: 'text-slate-600 bg-slate-100',
    ativo: 0,
    stats_texto: 'Desativada',
  },
];

const DEFAULT_TEMPLATES = [
  {
    nome: 'Boletim de licitações',
    assunto: 'Novas licitações para {empresa}',
    corpo:
      'Olá {nome},\n\nSelecionamos as licitações mais compatíveis com o CNAE da {empresa} publicadas nas últimas 24h.\n\nAcesse o portal para conferir os detalhes.',
    categoria: 'licitacoes',
  },
  {
    nome: 'Certidão vencendo',
    assunto: 'Sua {certidao} vence em {dias} dias',
    corpo:
      'Olá {nome},\n\nA certidão {certidao} da {empresa} vence em {dias} dias.\n\nRegularize no portal SICAF e envie a Situação do Fornecedor atualizada.',
    categoria: 'certidoes',
  },
  {
    nome: 'SICAF vencido',
    assunto: 'Ação necessária: SICAF de {empresa} vencido',
    corpo:
      'Olá {nome},\n\nO credenciamento SICAF de {empresa} está vencido ou prestes a vencer.\n\nAcesse o portal CADBRASIL para renovar.',
    categoria: 'avisos',
  },
  {
    nome: 'Boas-vindas',
    assunto: 'Bem-vindo à CADBRASIL, {nome}!',
    corpo:
      'Olá {nome},\n\nSeja bem-vindo(a) à CADBRASIL!\n\nEm poucos passos você conclui o SICAF e deixa {empresa} pronta para licitar.',
    categoria: 'boas-vindas',
  },
  {
    nome: 'Aviso geral',
    assunto: '{titulo}',
    corpo: 'Olá {nome},\n\n{mensagem}\n\nEquipe CADBRASIL',
    categoria: 'avisos',
  },
];

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtml(text) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1e293b">${escapeHtml(text).replace(/\n/g, '<br/>')}</div>`;
}

function applyVars(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] != null ? String(vars[key]) : `{${key}}`,
  );
}

function formatDataCampanha(row) {
  if (row.status === 'enviado' && row.data_envio) {
    return new Date(row.data_envio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
  if (row.status === 'agendado' && row.data_agendada) {
    return new Date(row.data_agendada).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
  if (row.status === 'rascunho') return '—';
  if (row.created_at) {
    return new Date(row.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
  return '—';
}

function mapCampanha(row) {
  return {
    id: String(row.id),
    titulo: row.titulo,
    categoria: row.categoria,
    publico: row.publico_label || PUBLICO_LABELS[row.publico_tipo] || row.publico_tipo,
    publicoTipo: row.publico_tipo,
    assunto: row.assunto,
    corpo: row.corpo,
    destinatarios: Number(row.destinatarios) || 0,
    enviados: Number(row.enviados) || 0,
    falhas: Number(row.falhas) || 0,
    aberturas: Number(row.aberturas) || 0,
    cliques: Number(row.cliques) || 0,
    status: row.status === 'enviando' ? 'enviado' : row.status,
    data: formatDataCampanha(row),
    dataAgendada: row.data_agendada || null,
    dataEnvio: row.data_envio || null,
    templateId: row.template_id || null,
    erroResumo: row.erro_resumo || null,
    createdAt: row.created_at || null,
  };
}

function mapTemplate(row) {
  return {
    id: String(row.id),
    nome: row.nome,
    assunto: row.assunto,
    corpo: row.corpo,
    categoria: row.categoria,
    ativo: !!row.ativo,
  };
}

function mapAutomacao(row) {
  return {
    id: String(row.id),
    codigo: row.codigo,
    nome: row.nome,
    descricao: row.descricao || '',
    icon: row.icone || 'Mail',
    tone: row.tom || 'text-slate-600 bg-slate-100',
    ativo: !!row.ativo,
    stats: row.stats_texto || '',
  };
}

async function ensureTables(db) {
  const hasTpl = await db.schema.hasTable('email_mkt_templates');
  if (!hasTpl) {
    await db.schema.createTable('email_mkt_templates', (t) => {
      t.bigIncrements('id').primary();
      t.string('nome', 180).notNullable();
      t.string('assunto', 255).notNullable();
      t.text('corpo').notNullable();
      t.enu('categoria', ['licitacoes', 'certidoes', 'avisos', 'boas-vindas']).notNullable().defaultTo('avisos');
      t.boolean('ativo').notNullable().defaultTo(1);
      t.bigInteger('criado_por').unsigned().nullable();
      t.timestamps(true, true);
    });
  }

  const hasAuto = await db.schema.hasTable('email_mkt_automacoes');
  if (!hasAuto) {
    await db.schema.createTable('email_mkt_automacoes', (t) => {
      t.bigIncrements('id').primary();
      t.string('codigo', 60).notNullable().unique();
      t.string('nome', 180).notNullable();
      t.text('descricao').nullable();
      t.string('icone', 40).defaultTo('Mail');
      t.string('tom', 80).defaultTo('text-slate-600 bg-slate-100');
      t.boolean('ativo').notNullable().defaultTo(1);
      t.string('stats_texto', 255).nullable();
      t.json('config_json').nullable();
      t.timestamps(true, true);
    });
  }

  const hasCamp = await db.schema.hasTable('email_mkt_campanhas');
  if (!hasCamp) {
    await db.schema.createTable('email_mkt_campanhas', (t) => {
      t.bigIncrements('id').primary();
      t.string('titulo', 255).notNullable();
      t.enu('categoria', ['licitacoes', 'certidoes', 'avisos', 'boas-vindas']).notNullable().defaultTo('avisos');
      t.enu('publico_tipo', ['manutencao', 'cnae', 'cert-venc', 'sicaf', 'novos', 'todos'])
        .notNullable()
        .defaultTo('manutencao');
      t.string('publico_label', 255).nullable();
      t.string('assunto', 255).notNullable();
      t.text('corpo').notNullable();
      t.enu('status', ['rascunho', 'agendado', 'enviando', 'enviado', 'falhou', 'cancelado'])
        .notNullable()
        .defaultTo('rascunho');
      t.integer('destinatarios').unsigned().notNullable().defaultTo(0);
      t.integer('enviados').unsigned().notNullable().defaultTo(0);
      t.integer('falhas').unsigned().notNullable().defaultTo(0);
      t.integer('aberturas').unsigned().notNullable().defaultTo(0);
      t.integer('cliques').unsigned().notNullable().defaultTo(0);
      t.dateTime('data_agendada').nullable();
      t.dateTime('data_envio').nullable();
      t.bigInteger('template_id').unsigned().nullable();
      t.text('erro_resumo').nullable();
      t.bigInteger('criado_por').unsigned().nullable();
      t.timestamps(true, true);
      t.index(['status']);
    });
  }

  const hasEnv = await db.schema.hasTable('email_mkt_envios');
  if (!hasEnv) {
    await db.schema.createTable('email_mkt_envios', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('campanha_id').unsigned().notNullable().index();
      t.bigInteger('cliente_id').unsigned().nullable();
      t.string('email', 255).notNullable();
      t.string('nome', 255).nullable();
      t.enu('status', ['pendente', 'enviado', 'falhou', 'aberto', 'clicado']).notNullable().defaultTo('pendente');
      t.string('provider_message_id', 255).nullable();
      t.text('erro').nullable();
      t.dateTime('enviado_em').nullable();
      t.dateTime('aberto_em').nullable();
      t.dateTime('clicado_em').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  await seedDefaults(db);
}

async function seedDefaults(db) {
  for (const a of DEFAULT_AUTOMACOES) {
    const exists = await db('email_mkt_automacoes').where('codigo', a.codigo).first();
    if (!exists) await db('email_mkt_automacoes').insert(a);
  }

  const tplCount = await db('email_mkt_templates').count({ c: '*' }).first();
  if (Number(tplCount?.c || 0) === 0) {
    for (const t of DEFAULT_TEMPLATES) {
      await db('email_mkt_templates').insert({ ...t, ativo: 1 });
    }
  }
}

async function queryDestinatarios(db, publicoTipo) {
  const base = () =>
    db('clientes as c')
      .select(
        'c.id as cliente_id',
        db.raw("TRIM(COALESCE(NULLIF(c.responsavel_email, ''), NULLIF(c.email, ''))) as email"),
        db.raw("COALESCE(NULLIF(c.responsavel_nome, ''), NULLIF(c.razao_social, ''), NULLIF(c.nome_fantasia, ''), 'Cliente') as nome"),
        db.raw("COALESCE(NULLIF(c.razao_social, ''), NULLIF(c.nome_fantasia, ''), 'Empresa') as empresa"),
      )
      .whereRaw("TRIM(COALESCE(NULLIF(c.responsavel_email, ''), NULLIF(c.email, ''))) <> ''")
      .whereRaw("TRIM(COALESCE(NULLIF(c.responsavel_email, ''), NULLIF(c.email, ''))) LIKE '%@%'");

  let rows = [];
  try {
    if (publicoTipo === 'manutencao') {
      rows = await base()
        .innerJoin('manutencoes as m', 'm.cliente_id', 'c.id')
        .whereRaw("LOWER(TRIM(CAST(m.status AS CHAR))) IN ('ativo','ativa','a vencer','vencendo')")
        .groupBy('c.id');
    } else if (publicoTipo === 'cert-venc') {
      rows = await base()
        .innerJoin('certidoes as cert', 'cert.cliente_id', 'c.id')
        .whereRaw(
          'cert.data_validade IS NOT NULL AND cert.data_validade BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)',
        )
        .groupBy('c.id');
    } else if (publicoTipo === 'sicaf') {
      rows = await base()
        .innerJoin('sicaf_cadastros as s', 's.cliente_id', 'c.id')
        .whereRaw(
          `(s.data_validade IS NOT NULL AND s.data_validade <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))
           OR LOWER(TRIM(CAST(s.status AS CHAR))) IN ('vencido','vencida','inativo','pendente')`,
        )
        .groupBy('c.id');
    } else if (publicoTipo === 'novos') {
      rows = await base().whereRaw('c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    } else if (publicoTipo === 'cnae') {
      rows = await base().whereRaw(
        "TRIM(COALESCE(c.ramo_atividade, '')) <> ''",
      );
    } else {
      rows = await base();
    }
  } catch (e) {
    console.warn('[EmailMkt] queryDestinatarios fallback todos:', e.message);
    rows = await base();
  }

  const byEmail = new Map();
  for (const r of rows) {
    const email = String(r.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        clienteId: r.cliente_id,
        email,
        nome: r.nome,
        empresa: r.empresa,
      });
    }
  }
  return Array.from(byEmail.values());
}

async function getPublicoOpcoes(db) {
  const tipos = ['manutencao', 'cnae', 'cert-venc', 'sicaf', 'novos', 'todos'];
  const opcoes = [];
  for (const id of tipos) {
    const recipients = await queryDestinatarios(db, id);
    opcoes.push({
      id,
      label: PUBLICO_LABELS[id],
      desc:
        id === 'manutencao'
          ? 'Todos os planos ativos'
          : id === 'cnae'
            ? 'Segmento com CNAE/ramo cadastrado'
            : id === 'cert-venc'
              ? 'Preventivo automático'
              : id === 'sicaf'
                ? 'Ação urgente'
                : id === 'novos'
                  ? 'Trilha de boas-vindas'
                  : 'Comunicação institucional',
      count: recipients.length,
    });
  }
  return opcoes;
}

async function countClientesAtivos(db) {
  try {
    const row = await db('manutencoes as m')
      .countDistinct({ c: 'm.cliente_id' })
      .whereRaw("LOWER(TRIM(CAST(m.status AS CHAR))) IN ('ativo','ativa','a vencer','vencendo')")
      .first();
    return Number(row?.c || 0);
  } catch (_) {
    const row = await db('clientes').count({ c: '*' }).first();
    return Number(row?.c || 0);
  }
}

/** Envia campanhas agendadas cuja data já passou (disparo oportunista ao abrir o painel). */
async function processDueCampanhas(db) {
  const due = await db('email_mkt_campanhas')
    .where('status', 'agendado')
    .whereNotNull('data_agendada')
    .where('data_agendada', '<=', db.fn.now())
    .orderBy('data_agendada', 'asc')
    .limit(10);

  for (const row of due) {
    try {
      await sendCampanha(row.id, { limit: 500 });
    } catch (e) {
      console.warn(`[EmailMkt] processDueCampanhas #${row.id}:`, e.message);
    }
  }
}

async function getDashboard(opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    await ensureTables(db);
    await processDueCampanhas(db);
    const search = String(opts.search || '').trim().toLowerCase();
    const categoria = String(opts.categoria || '').trim();

    let campanhasQ = db('email_mkt_campanhas').orderBy('created_at', 'desc').limit(200);
    if (categoria && categoria !== 'todos') campanhasQ = campanhasQ.where('categoria', categoria);
    const campanhasRows = await campanhasQ;
    let campanhas = campanhasRows.map(mapCampanha);
    if (search) {
      campanhas = campanhas.filter((c) => c.titulo.toLowerCase().includes(search));
    }

    const templates = (await db('email_mkt_templates').where('ativo', 1).orderBy('nome', 'asc')).map(mapTemplate);
    const automacoes = (await db('email_mkt_automacoes').orderBy('id', 'asc')).map(mapAutomacao);
    const publicoOpcoes = await getPublicoOpcoes(db);
    const clientesAtivos = await countClientesAtivos(db);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const enviados30 = campanhasRows
      .filter((c) => c.status === 'enviado' && c.data_envio && new Date(c.data_envio) >= since)
      .reduce((s, c) => s + (Number(c.enviados) || 0), 0);
    const aberturas30 = campanhasRows
      .filter((c) => c.status === 'enviado' && c.data_envio && new Date(c.data_envio) >= since)
      .reduce((s, c) => s + (Number(c.aberturas) || 0), 0);
    const cliques30 = campanhasRows
      .filter((c) => c.status === 'enviado' && c.data_envio && new Date(c.data_envio) >= since)
      .reduce((s, c) => s + (Number(c.cliques) || 0), 0);

    return {
      ok: true,
      campanhas,
      templates,
      automacoes,
      publicoOpcoes,
      kpis: {
        enviados30,
        taxaAbertura: enviados30 ? Math.round((aberturas30 / enviados30) * 100) : 0,
        taxaCliques: enviados30 ? Math.round((cliques30 / enviados30) * 100) : 0,
        clientesAtivos,
      },
      agendamentos: campanhas.filter((c) => c.status === 'agendado' || c.status === 'rascunho'),
    };
  } catch (e) {
    console.error('[EmailMkt] getDashboard:', e.message);
    return { ok: false, error: e.message };
  }
}

async function createCampanha(usuarioId, dados = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    await ensureTables(db);
    const titulo = String(dados.titulo || dados.assunto || '').trim();
    const assunto = String(dados.assunto || '').trim();
    const corpo = String(dados.corpo || dados.mensagem || '').trim();
    const categoria = String(dados.categoria || 'avisos');
    const publicoTipo = String(dados.publicoTipo || dados.publico || 'manutencao');
    const modo = String(dados.modo || 'agora');
    const quando = dados.dataAgendada || dados.quando || null;

    if (!titulo) return { ok: false, error: 'Informe o título/assunto da campanha' };
    if (!assunto) return { ok: false, error: 'Informe o assunto' };
    if (!corpo) return { ok: false, error: 'Informe o corpo do e-mail' };
    if (!PUBLICO_LABELS[publicoTipo]) return { ok: false, error: 'Público inválido' };

    const recipients = await queryDestinatarios(db, publicoTipo);
    let status = 'rascunho';
    let dataAgendada = null;
    if (modo === 'agendar') {
      if (!quando) return { ok: false, error: 'Informe data e horário para agendar' };
      status = 'agendado';
      dataAgendada = new Date(quando);
      if (Number.isNaN(dataAgendada.getTime())) return { ok: false, error: 'Data de agendamento inválida' };
    } else if (modo === 'rascunho') {
      status = 'rascunho';
    } else {
      status = 'rascunho';
    }

    const [id] = await db('email_mkt_campanhas').insert({
      titulo,
      categoria,
      publico_tipo: publicoTipo,
      publico_label: PUBLICO_LABELS[publicoTipo],
      assunto,
      corpo,
      status,
      destinatarios: recipients.length,
      data_agendada: dataAgendada,
      template_id: dados.templateId ? Number(dados.templateId) || null : null,
      criado_por: usuarioId || null,
    });

    const row = await db('email_mkt_campanhas').where('id', id).first();
    let campanha = mapCampanha(row);

    if (modo === 'agora') {
      const sent = await sendCampanha(id, { usuarioId });
      if (sent.ok && sent.campanha) campanha = sent.campanha;
      else if (!sent.ok) return sent;
    }

    return { ok: true, campanha };
  } catch (e) {
    console.error('[EmailMkt] createCampanha:', e.message);
    return { ok: false, error: e.message };
  }
}

async function sendCampanha(campanhaId, opts = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const emailService = require('./email.service');

  try {
    await ensureTables(db);
    const row = await db('email_mkt_campanhas').where('id', campanhaId).first();
    if (!row) return { ok: false, error: 'Campanha não encontrada' };
    if (row.status === 'enviado') return { ok: false, error: 'Campanha já foi enviada' };
    if (row.status === 'cancelado') return { ok: false, error: 'Campanha cancelada' };

    const recipients = await queryDestinatarios(db, row.publico_tipo);
    if (!recipients.length) {
      await db('email_mkt_campanhas').where('id', campanhaId).update({
        status: 'falhou',
        destinatarios: 0,
        erro_resumo: 'Nenhum destinatário com e-mail válido para este público',
      });
      const failed = await db('email_mkt_campanhas').where('id', campanhaId).first();
      return { ok: false, error: 'Nenhum destinatário encontrado', campanha: mapCampanha(failed) };
    }

    await db('email_mkt_campanhas').where('id', campanhaId).update({
      status: 'enviando',
      destinatarios: recipients.length,
      erro_resumo: null,
    });

    let enviados = 0;
    let falhas = 0;
    const erros = [];
    const maxSend = Math.min(recipients.length, Number(opts.limit) || 500);

    for (let i = 0; i < maxSend; i++) {
      const r = recipients[i];
      const vars = {
        nome: r.nome,
        empresa: r.empresa,
        certidao: 'CND Federal',
        dias: '15',
        link: process.env.PORTAL_URL || process.env.FRONTEND_URL || 'https://fornecedor.cadbrasil.com.br',
        titulo: row.titulo,
        mensagem: row.corpo,
      };
      const subject = applyVars(row.assunto, vars);
      const bodyText = applyVars(row.corpo, vars);
      try {
        const result = await emailService.send({
          to: r.email,
          subject,
          text: bodyText,
          html: textToHtml(bodyText),
        });
        if (result.ok) {
          enviados += 1;
          await db('email_mkt_envios').insert({
            campanha_id: campanhaId,
            cliente_id: r.clienteId,
            email: r.email,
            nome: r.nome,
            status: 'enviado',
            provider_message_id: result.messageId || null,
            enviado_em: db.fn.now(),
          });
        } else {
          falhas += 1;
          if (erros.length < 5) erros.push(`${r.email}: ${result.error || 'falha'}`);
          await db('email_mkt_envios').insert({
            campanha_id: campanhaId,
            cliente_id: r.clienteId,
            email: r.email,
            nome: r.nome,
            status: 'falhou',
            erro: result.error || 'Falha no envio',
          });
        }
      } catch (sendErr) {
        falhas += 1;
        if (erros.length < 5) erros.push(`${r.email}: ${sendErr.message}`);
        await db('email_mkt_envios').insert({
          campanha_id: campanhaId,
          cliente_id: r.clienteId,
          email: r.email,
          nome: r.nome,
          status: 'falhou',
          erro: sendErr.message,
        });
      }
    }

    const statusFinal = enviados > 0 ? 'enviado' : 'falhou';
    await db('email_mkt_campanhas').where('id', campanhaId).update({
      status: statusFinal,
      enviados,
      falhas,
      destinatarios: recipients.length,
      data_envio: statusFinal === 'enviado' ? db.fn.now() : null,
      erro_resumo: erros.length ? erros.join(' | ') : null,
    });

    const updated = await db('email_mkt_campanhas').where('id', campanhaId).first();
    return {
      ok: enviados > 0,
      campanha: mapCampanha(updated),
      enviados,
      falhas,
      error: enviados > 0 ? null : erros[0] || 'Nenhum e-mail enviado',
    };
  } catch (e) {
    console.error('[EmailMkt] sendCampanha:', e.message);
    try {
      await db('email_mkt_campanhas').where('id', campanhaId).update({
        status: 'falhou',
        erro_resumo: e.message,
      });
    } catch (_) {}
    return { ok: false, error: e.message };
  }
}

async function duplicateCampanha(campanhaId, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTables(db);
    const row = await db('email_mkt_campanhas').where('id', campanhaId).first();
    if (!row) return { ok: false, error: 'Campanha não encontrada' };
    const [id] = await db('email_mkt_campanhas').insert({
      titulo: `${row.titulo} (cópia)`,
      categoria: row.categoria,
      publico_tipo: row.publico_tipo,
      publico_label: row.publico_label,
      assunto: row.assunto,
      corpo: row.corpo,
      status: 'rascunho',
      destinatarios: row.destinatarios,
      template_id: row.template_id,
      criado_por: usuarioId || null,
    });
    const created = await db('email_mkt_campanhas').where('id', id).first();
    return { ok: true, campanha: mapCampanha(created) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function cancelCampanha(campanhaId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTables(db);
    const row = await db('email_mkt_campanhas').where('id', campanhaId).first();
    if (!row) return { ok: false, error: 'Campanha não encontrada' };
    if (row.status === 'enviado') return { ok: false, error: 'Não é possível cancelar campanha já enviada' };
    await db('email_mkt_campanhas').where('id', campanhaId).update({ status: 'cancelado' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function deleteCampanha(campanhaId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTables(db);
    const row = await db('email_mkt_campanhas').where('id', campanhaId).first();
    if (!row) return { ok: false, error: 'Campanha não encontrada' };
    if (row.status === 'enviado') return { ok: false, error: 'Não exclua campanhas já enviadas; marque como cancelada se for rascunho/agendada' };
    await db('email_mkt_envios').where('campanha_id', campanhaId).delete();
    await db('email_mkt_campanhas').where('id', campanhaId).delete();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function toggleAutomacao(id, ativo) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTables(db);
    const row = await db('email_mkt_automacoes').where('id', id).first();
    if (!row) return { ok: false, error: 'Automação não encontrada' };
    const next = typeof ativo === 'boolean' ? (ativo ? 1 : 0) : row.ativo ? 0 : 1;
    await db('email_mkt_automacoes').where('id', id).update({
      ativo: next,
      stats_texto: next ? 'Ativa' : 'Desativada',
    });
    const updated = await db('email_mkt_automacoes').where('id', id).first();
    return { ok: true, automacao: mapAutomacao(updated) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function saveTemplate(usuarioId, dados = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTables(db);
    const nome = String(dados.nome || '').trim();
    const assunto = String(dados.assunto || '').trim();
    const corpo = String(dados.corpo || '').trim();
    const categoria = String(dados.categoria || 'avisos');
    if (!nome || !assunto || !corpo) return { ok: false, error: 'Preencha nome, assunto e corpo' };

    if (dados.id) {
      const existing = await db('email_mkt_templates').where('id', dados.id).first();
      if (!existing) return { ok: false, error: 'Template não encontrado' };
      await db('email_mkt_templates').where('id', dados.id).update({ nome, assunto, corpo, categoria });
      const row = await db('email_mkt_templates').where('id', dados.id).first();
      return { ok: true, template: mapTemplate(row) };
    }

    const [id] = await db('email_mkt_templates').insert({
      nome,
      assunto,
      corpo,
      categoria,
      ativo: 1,
      criado_por: usuarioId || null,
    });
    const row = await db('email_mkt_templates').where('id', id).first();
    return { ok: true, template: mapTemplate(row) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function deleteTemplate(id) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTables(db);
    await db('email_mkt_templates').where('id', id).update({ ativo: 0 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  ensureTables,
  getDashboard,
  processDueCampanhas,
  createCampanha,
  sendCampanha,
  duplicateCampanha,
  cancelCampanha,
  deleteCampanha,
  toggleAutomacao,
  saveTemplate,
  deleteTemplate,
  PUBLICO_LABELS,
};
