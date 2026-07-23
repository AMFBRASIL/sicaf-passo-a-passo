/**
 * Email Marketing — campanhas, templates e automações (Admin → CRM).
 */
const { getDb } = require('../database/connection');

const PUBLICO_LABELS = {
  manutencao: 'Clientes em manutenção',
  nunca_pagaram: 'Nunca pagaram (só cadastro)',
  taxa_pendente: 'Taxa SICAF pendente',
  ja_pagaram: 'Já pagaram (ao menos 1x)',
  sem_manutencao: 'Sem manutenção ativa',
  cnae: 'Filtro por CNAE',
  'cert-venc': 'Certidões vencendo (30d)',
  sicaf: 'SICAF a vencer / vencido',
  novos: 'Novos clientes (7d)',
  todos: 'Todos os clientes',
};

const PUBLICO_META = {
  manutencao: { desc: 'Planos de manutenção ativos', grupo: 'comercial' },
  nunca_pagaram: { desc: 'Cadastrados sem nenhum pagamento confirmado', grupo: 'financeiro' },
  taxa_pendente: { desc: 'Boleto/taxa SICAF em aberto', grupo: 'financeiro' },
  ja_pagaram: { desc: 'Pelo menos um pagamento quitado', grupo: 'financeiro' },
  sem_manutencao: { desc: 'Sem plano de manutenção ativo', grupo: 'comercial' },
  cnae: { desc: 'Segmento com CNAE/ramo cadastrado', grupo: 'comercial' },
  'cert-venc': { desc: 'Preventivo automático (30 dias)', grupo: 'risco' },
  sicaf: { desc: 'Credenciamento a vencer ou vencido', grupo: 'risco' },
  novos: { desc: 'Cadastros dos últimos 7 dias', grupo: 'comercial' },
  todos: { desc: 'Base completa com e-mail válido', grupo: 'geral' },
};

const PUBLICO_TIPOS = Object.keys(PUBLICO_LABELS);

const TAXA_PAGA_SQL =
  "(LOWER(TRIM(CAST(t.status AS CHAR))) IN ('pago','paga','aprovado','aprovada') OR t.status IN ('Pago','Paga','Aprovado','Aprovada'))";
const PAG_PAGO_SQL =
  "(LOWER(TRIM(CAST(p.status AS CHAR))) IN ('pago','paga','aprovado','aprovada','paid','confirmado','confirmada','liberado','liberada') OR p.status IN ('Pago','Paga','Aprovado','Aprovada','Confirmado','Liberado'))";
const TAXA_ABERTA_SQL =
  "(LOWER(TRIM(CAST(t.status AS CHAR))) IN ('pendente','aguardando','gerado','vencido','atrasado','aberto') OR t.status IN ('Pendente','Aguardando','Gerado','Vencido','Atrasado','Aberto'))";
const MANUT_ATIVA_SQL =
  "LOWER(TRIM(CAST(m.status AS CHAR))) IN ('ativo','ativa','a vencer','vencendo')";

const HTML_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#0f172a;color:#ffffff;padding:20px 24px;font-size:18px;font-weight:700;letter-spacing:0.02em;">
            CADBRASIL
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px;color:#1e293b;font-size:15px;line-height:1.65;">
            <p style="margin:0 0 16px;">Olá <strong>{{nome}}</strong>,</p>
            <p style="margin:0 0 16px;">Temos uma atualização importante para <strong>{{razaosocial}}</strong> (CNPJ {{cnpj}}).</p>
            <p style="margin:0 0 24px;">Acesse o portal para conferir os detalhes e manter seu cadastro em dia.</p>
            <p style="margin:0;">
              <a href="{{link}}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">
                Acessar portal
              </a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;">
            CADBRASIL · Credenciamento SICAF<br/>
            Este e-mail foi enviado para o responsável cadastrado em {{razaosocial}}.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

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

function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function normalizeVarKey(key) {
  return String(key || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function formatDocumento(doc) {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return String(doc || '').trim();
}

/** Variáveis dinâmicas suportadas no assunto/corpo ({{var}} ou {var}). */
const VARIAVEIS_EMAIL = [
  { key: 'razaosocial', label: 'Razão social', sample: 'Empresa Exemplo Ltda' },
  { key: 'nomefantasia', label: 'Nome fantasia', sample: 'Exemplo' },
  { key: 'cnpj', label: 'CNPJ/CPF', sample: '12.345.678/0001-90' },
  { key: 'nome', label: 'Responsável', sample: 'Maria Silva' },
  { key: 'email', label: 'E-mail', sample: 'maria@empresa.com.br' },
  { key: 'telefone', label: 'Telefone', sample: '(11) 99999-0000' },
  { key: 'cidade', label: 'Cidade', sample: 'São Paulo' },
  { key: 'estado', label: 'UF', sample: 'SP' },
  { key: 'empresa', label: 'Empresa (alias)', sample: 'Empresa Exemplo Ltda' },
  { key: 'link', label: 'Link do portal', sample: 'https://fornecedor.cadbrasil.com.br' },
  { key: 'certidao', label: 'Certidão', sample: 'CND Federal' },
  { key: 'dias', label: 'Dias', sample: '15' },
];

function applyVars(template, vars) {
  const map = {};
  for (const [k, v] of Object.entries(vars || {})) {
    if (v == null) continue;
    map[normalizeVarKey(k)] = String(v);
  }

  let out = String(template || '');
  // {{variavel}} primeiro
  out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = map[normalizeVarKey(key)];
    return v != null ? v : `{{${key}}}`;
  });
  // {variavel}
  out = out.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, key) => {
    const v = map[normalizeVarKey(key)];
    return v != null ? v : `{${key}}`;
  });
  return out;
}

function buildRecipientVars(recipient, campanhaRow = {}) {
  const portal =
    process.env.PORTAL_URL || process.env.FRONTEND_URL || 'https://fornecedor.cadbrasil.com.br';
  const razao = recipient.razaoSocial || recipient.empresa || '';
  const fantasia = recipient.nomeFantasia || '';
  const empresa = razao || fantasia || 'Empresa';
  const nome = recipient.nome || recipient.responsavel || 'Cliente';
  const documento = formatDocumento(recipient.documento || recipient.cnpj || '');
  const email = recipient.email || '';
  const telefone = recipient.telefone || '';
  const cidade = recipient.cidade || '';
  const estado = recipient.estado || '';

  return {
    // principais
    nome,
    responsavel: nome,
    responsavelnome: nome,
    empresa,
    razaosocial: razao || empresa,
    razao_social: razao || empresa,
    nomefantasia: fantasia || empresa,
    nome_fantasia: fantasia || empresa,
    cnpj: documento,
    documento,
    cpf: documento,
    email,
    telefone,
    celular: telefone,
    cidade,
    estado,
    uf: estado,
    link: portal,
    portal,
    // campanha / genéricos
    titulo: campanhaRow.titulo || '',
    certidao: 'CND Federal',
    dias: '15',
  };
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
    formato: row.formato === 'html' || looksLikeHtml(row.corpo) ? 'html' : 'texto',
    destinatarios: Number(row.destinatarios) || 0,
    enviados: Number(row.enviados) || 0,
    falhas: Number(row.falhas) || 0,
    aberturas: Number(row.aberturas) || 0,
    cliques: Number(row.cliques) || 0,
    status: row.status,
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
      t.enu('publico_tipo', [
        'manutencao',
        'nunca_pagaram',
        'taxa_pendente',
        'ja_pagaram',
        'sem_manutencao',
        'cnae',
        'cert-venc',
        'sicaf',
        'novos',
        'todos',
      ])
        .notNullable()
        .defaultTo('manutencao');
      t.string('publico_label', 255).nullable();
      t.string('assunto', 255).notNullable();
      t.text('corpo').notNullable();
      t.enu('formato', ['texto', 'html']).notNullable().defaultTo('texto');
      t.enu('status', ['rascunho', 'agendado', 'enviando', 'enviado', 'falhou', 'cancelado', 'pausado'])
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

  await migrateSchema(db);
  await seedDefaults(db);
}

async function migrateSchema(db) {
  if (!(await db.schema.hasTable('email_mkt_campanhas'))) return;

  const hasFormato = await db.schema.hasColumn('email_mkt_campanhas', 'formato');
  if (!hasFormato) {
    try {
      await db.schema.alterTable('email_mkt_campanhas', (t) => {
        t.enu('formato', ['texto', 'html']).notNullable().defaultTo('texto');
      });
    } catch (e) {
      console.warn('[EmailMkt] migrate formato:', e.message);
    }
  }

  try {
    await db.raw(`
      ALTER TABLE email_mkt_campanhas
      MODIFY COLUMN publico_tipo ENUM(
        'manutencao','nunca_pagaram','taxa_pendente','ja_pagaram','sem_manutencao',
        'cnae','cert-venc','sicaf','novos','todos'
      ) NOT NULL DEFAULT 'manutencao'
    `);
  } catch (e) {
    console.warn('[EmailMkt] migrate publico_tipo:', e.message);
  }

  try {
    await db.raw(`
      ALTER TABLE email_mkt_campanhas
      MODIFY COLUMN status ENUM(
        'rascunho','agendado','enviando','enviado','falhou','cancelado','pausado'
      ) NOT NULL DEFAULT 'rascunho'
    `);
  } catch (e) {
    console.warn('[EmailMkt] migrate status pausado:', e.message);
  }
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
        db.raw("COALESCE(c.razao_social, '') as razao_social"),
        db.raw("COALESCE(c.nome_fantasia, '') as nome_fantasia"),
        db.raw("COALESCE(c.documento, '') as documento"),
        db.raw("COALESCE(NULLIF(c.responsavel_telefone, ''), NULLIF(c.telefone, ''), NULLIF(c.celular, ''), '') as telefone"),
        db.raw("COALESCE(c.cidade, '') as cidade"),
        db.raw("COALESCE(c.estado, '') as estado"),
      )
      .whereRaw("TRIM(COALESCE(NULLIF(c.responsavel_email, ''), NULLIF(c.email, ''))) <> ''")
      .whereRaw("TRIM(COALESCE(NULLIF(c.responsavel_email, ''), NULLIF(c.email, ''))) LIKE '%@%'");

  const whereNuncaPagou = (q) =>
    q
      .whereNotExists(function () {
        this.select(db.raw(1))
          .from('taxas_sicaf as t')
          .whereRaw('t.cliente_id = c.id')
          .whereRaw(TAXA_PAGA_SQL);
      })
      .whereNotExists(function () {
        this.select(db.raw(1))
          .from('pagamentos as p')
          .whereRaw('p.cliente_id = c.id')
          .whereRaw(PAG_PAGO_SQL);
      });

  const whereJaPagou = (q) =>
    q.where(function () {
      this.whereExists(function () {
        this.select(db.raw(1))
          .from('taxas_sicaf as t')
          .whereRaw('t.cliente_id = c.id')
          .whereRaw(TAXA_PAGA_SQL);
      }).orWhereExists(function () {
        this.select(db.raw(1))
          .from('pagamentos as p')
          .whereRaw('p.cliente_id = c.id')
          .whereRaw(PAG_PAGO_SQL);
      });
    });

  let rows = [];
  try {
    if (publicoTipo === 'manutencao') {
      rows = await base()
        .innerJoin('manutencoes as m', 'm.cliente_id', 'c.id')
        .whereRaw(MANUT_ATIVA_SQL)
        .groupBy('c.id');
    } else if (publicoTipo === 'nunca_pagaram') {
      rows = await whereNuncaPagou(base());
    } else if (publicoTipo === 'ja_pagaram') {
      rows = await whereJaPagou(base()).groupBy('c.id');
    } else if (publicoTipo === 'taxa_pendente') {
      rows = await base()
        .whereExists(function () {
          this.select(db.raw(1))
            .from('taxas_sicaf as t')
            .whereRaw('t.cliente_id = c.id')
            .whereRaw(TAXA_ABERTA_SQL);
        })
        .groupBy('c.id');
    } else if (publicoTipo === 'sem_manutencao') {
      rows = await base().whereNotExists(function () {
        this.select(db.raw(1))
          .from('manutencoes as m')
          .whereRaw('m.cliente_id = c.id')
          .whereRaw(MANUT_ATIVA_SQL);
      });
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
      rows = await base().whereRaw("TRIM(COALESCE(c.ramo_atividade, '')) <> ''");
    } else {
      rows = await base();
    }
  } catch (e) {
    console.warn('[EmailMkt] queryDestinatarios fallback todos:', e.message);
    rows = await base().catch(() => []);
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
        razaoSocial: r.razao_social || r.empresa,
        nomeFantasia: r.nome_fantasia || '',
        documento: r.documento || '',
        cnpj: r.documento || '',
        telefone: r.telefone || '',
        cidade: r.cidade || '',
        estado: r.estado || '',
      });
    }
  }
  return Array.from(byEmail.values());
}

async function getPublicoOpcoes(db) {
  const opcoes = [];
  for (const id of PUBLICO_TIPOS) {
    const recipients = await queryDestinatarios(db, id);
    const meta = PUBLICO_META[id] || { desc: '', grupo: 'geral' };
    opcoes.push({
      id,
      label: PUBLICO_LABELS[id],
      desc: meta.desc,
      grupo: meta.grupo,
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
      await sendCampanha(row.id);
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
      variaveis: VARIAVEIS_EMAIL,
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
    const formato =
      String(dados.formato || '').toLowerCase() === 'html' || looksLikeHtml(corpo) ? 'html' : 'texto';
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

    const insertRow = {
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
    };
    if (await db.schema.hasColumn('email_mkt_campanhas', 'formato')) {
      insertRow.formato = formato;
    }

    const [id] = await db('email_mkt_campanhas').insert(insertRow);

    const row = await db('email_mkt_campanhas').where('id', id).first();
    let campanha = mapCampanha(row);

    // Envio imediato síncrono (legado). Com deferSend/stream o front dispara SSE depois.
    if (modo === 'agora' && !dados.deferSend && !dados.stream) {
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
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const emit = (event) => {
    try {
      if (onProgress) onProgress(event);
    } catch (_) {}
  };

  try {
    await ensureTables(db);
    const row = await db('email_mkt_campanhas').where('id', campanhaId).first();
    if (!row) return { ok: false, error: 'Campanha não encontrada' };
    if (row.status === 'enviado') return { ok: false, error: 'Campanha já foi enviada' };
    if (row.status === 'cancelado') return { ok: false, error: 'Campanha cancelada' };

    // Permite retomar: pausado, falhou, enviando (travado) e rascunho/agendado
    const statusOk = ['rascunho', 'agendado', 'pausado', 'falhou', 'enviando'].includes(row.status);
    if (!statusOk) return { ok: false, error: `Status inválido para envio: ${row.status}` };

    const recipients = await queryDestinatarios(db, row.publico_tipo);
    if (!recipients.length) {
      await db('email_mkt_campanhas').where('id', campanhaId).update({
        status: 'falhou',
        destinatarios: 0,
        erro_resumo: 'Nenhum destinatário com e-mail válido para este público',
      });
      const failed = await db('email_mkt_campanhas').where('id', campanhaId).first();
      const errPayload = {
        ok: false,
        error: 'Nenhum destinatário encontrado',
        campanha: mapCampanha(failed),
      };
      emit({ type: 'error', ...errPayload });
      return errPayload;
    }

    const alreadySentRows = await db('email_mkt_envios')
      .where({ campanha_id: campanhaId, status: 'enviado' })
      .select('email');
    const alreadySent = new Set(
      alreadySentRows.map((r) => String(r.email || '').trim().toLowerCase()).filter(Boolean),
    );

    const failCountRow = await db('email_mkt_envios')
      .where({ campanha_id: campanhaId, status: 'falhou' })
      .count({ c: '*' })
      .first();

    let enviados = alreadySent.size;
    let falhas = Number(failCountRow?.c || 0);
    const erros = [];

    const pending = recipients.filter((r) => !alreadySent.has(String(r.email || '').trim().toLowerCase()));
    const maxSend =
      opts.limit != null && Number(opts.limit) > 0
        ? Math.min(pending.length, Number(opts.limit))
        : pending.length;
    const totalGeral = recipients.length;
    const jaEnviadosAntes = enviados;

    if (maxSend === 0) {
      const statusFinal = enviados > 0 ? 'enviado' : 'falhou';
      await db('email_mkt_campanhas').where('id', campanhaId).update({
        status: statusFinal,
        enviados,
        falhas,
        destinatarios: totalGeral,
        data_envio: statusFinal === 'enviado' ? db.fn.now() : null,
        erro_resumo: enviados > 0 ? null : 'Nenhum destinatário pendente',
      });
      const updated = await db('email_mkt_campanhas').where('id', campanhaId).first();
      const payload = {
        ok: enviados > 0,
        campanha: mapCampanha(updated),
        enviados,
        falhas,
        total: totalGeral,
        skipped: jaEnviadosAntes,
        error: enviados > 0 ? null : 'Nenhum e-mail pendente',
      };
      emit({ type: 'done', ...payload });
      return payload;
    }

    await db('email_mkt_campanhas').where('id', campanhaId).update({
      status: 'enviando',
      destinatarios: totalGeral,
      enviados,
      falhas,
      erro_resumo: null,
    });

    emit({
      type: 'start',
      campanhaId: String(campanhaId),
      total: totalGeral,
      pendentes: maxSend,
      jaEnviados: jaEnviadosAntes,
      destinatarios: totalGeral,
      assunto: row.assunto,
      retomada: jaEnviadosAntes > 0 || row.status === 'pausado' || row.status === 'falhou',
    });

    let paused = false;
    let processados = 0;

    for (let i = 0; i < maxSend; i++) {
      // Checa pausa a cada destinatário
      const live = await db('email_mkt_campanhas').where('id', campanhaId).select('status').first();
      if (live?.status === 'pausado' || live?.status === 'cancelado') {
        paused = true;
        break;
      }

      const r = pending[i];
      const emailKey = String(r.email || '').trim().toLowerCase();
      const vars = buildRecipientVars(r, row);
      const subject = applyVars(row.assunto, vars);
      const bodyRaw = applyVars(row.corpo, vars);
      const isHtml = row.formato === 'html' || looksLikeHtml(row.corpo);
      const html = isHtml ? bodyRaw : textToHtml(bodyRaw);
      const text = isHtml ? htmlToText(bodyRaw) : bodyRaw;
      processados += 1;
      const index = jaEnviadosAntes + processados;
      let itemOk = false;
      let itemError = null;

      try {
        const result = await emailService.send({
          to: r.email,
          subject,
          text,
          html,
        });
        if (result.ok) {
          itemOk = true;
          enviados += 1;
          alreadySent.add(emailKey);
          const prevFail = await db('email_mkt_envios')
            .where({ campanha_id: campanhaId, email: r.email, status: 'falhou' })
            .orderBy('id', 'desc')
            .first();
          if (prevFail) {
            await db('email_mkt_envios').where('id', prevFail.id).update({
              status: 'enviado',
              erro: null,
              provider_message_id: result.messageId || null,
              enviado_em: db.fn.now(),
              nome: r.nome,
              cliente_id: r.clienteId,
            });
            falhas = Math.max(0, falhas - 1);
          } else {
            await db('email_mkt_envios').insert({
              campanha_id: campanhaId,
              cliente_id: r.clienteId,
              email: r.email,
              nome: r.nome,
              status: 'enviado',
              provider_message_id: result.messageId || null,
              enviado_em: db.fn.now(),
            });
          }
        } else {
          falhas += 1;
          itemError = result.error || 'Falha no envio';
          if (erros.length < 20) erros.push(`${r.email}: ${itemError}`);
          const prev = await db('email_mkt_envios')
            .where({ campanha_id: campanhaId, email: r.email })
            .whereIn('status', ['falhou', 'pendente'])
            .orderBy('id', 'desc')
            .first();
          if (prev) {
            await db('email_mkt_envios').where('id', prev.id).update({
              status: 'falhou',
              erro: itemError,
              nome: r.nome,
              cliente_id: r.clienteId,
            });
          } else {
            await db('email_mkt_envios').insert({
              campanha_id: campanhaId,
              cliente_id: r.clienteId,
              email: r.email,
              nome: r.nome,
              status: 'falhou',
              erro: itemError,
            });
          }
        }
      } catch (sendErr) {
        falhas += 1;
        itemError = sendErr.message || 'Erro no envio';
        if (erros.length < 20) erros.push(`${r.email}: ${itemError}`);
        const prev = await db('email_mkt_envios')
          .where({ campanha_id: campanhaId, email: r.email })
          .whereIn('status', ['falhou', 'pendente'])
          .orderBy('id', 'desc')
          .first();
        if (prev) {
          await db('email_mkt_envios').where('id', prev.id).update({
            status: 'falhou',
            erro: itemError,
            nome: r.nome,
            cliente_id: r.clienteId,
          });
        } else {
          await db('email_mkt_envios').insert({
            campanha_id: campanhaId,
            cliente_id: r.clienteId,
            email: r.email,
            nome: r.nome,
            status: 'falhou',
            erro: itemError,
          });
        }
      }

      if (processados % 5 === 0 || processados === maxSend) {
        await db('email_mkt_campanhas').where('id', campanhaId).update({
          enviados,
          falhas,
        });
      }

      emit({
        type: 'item',
        index,
        total: totalGeral,
        email: r.email,
        nome: r.nome || '',
        empresa: r.empresa || r.razaoSocial || '',
        ok: itemOk,
        error: itemError,
        enviados,
        falhas,
        percent: Math.round((enviados / Math.max(1, totalGeral)) * 100),
      });
    }

    const liveEnd = await db('email_mkt_campanhas').where('id', campanhaId).select('status').first();
    if (liveEnd?.status === 'pausado' || paused) {
      await db('email_mkt_campanhas').where('id', campanhaId).update({
        status: 'pausado',
        enviados,
        falhas,
        destinatarios: totalGeral,
        erro_resumo: erros.length ? erros.slice(0, 5).join(' | ') : null,
      });
      const updated = await db('email_mkt_campanhas').where('id', campanhaId).first();
      const payload = {
        ok: true,
        paused: true,
        campanha: mapCampanha(updated),
        enviados,
        falhas,
        total: totalGeral,
        error: null,
      };
      emit({ type: 'paused', ...payload });
      return payload;
    }

    if (liveEnd?.status === 'cancelado') {
      await db('email_mkt_campanhas').where('id', campanhaId).update({ enviados, falhas });
      const updated = await db('email_mkt_campanhas').where('id', campanhaId).first();
      const payload = {
        ok: false,
        cancelled: true,
        campanha: mapCampanha(updated),
        enviados,
        falhas,
        total: totalGeral,
        error: 'Campanha cancelada',
      };
      emit({ type: 'error', ...payload });
      return payload;
    }

    // Contagem real no banco (evita divergência em retomadas)
    const sentNow = await db('email_mkt_envios')
      .where({ campanha_id: campanhaId, status: 'enviado' })
      .count({ c: '*' })
      .first();
    const failNow = await db('email_mkt_envios')
      .where({ campanha_id: campanhaId, status: 'falhou' })
      .count({ c: '*' })
      .first();
    enviados = Number(sentNow?.c || 0);
    falhas = Number(failNow?.c || 0);

    const stillPending = recipients.filter(
      (r) => !alreadySent.has(String(r.email || '').trim().toLowerCase()),
    ).length;

    let finalStatus = 'falhou';
    if (stillPending === 0) {
      finalStatus = enviados > 0 ? 'enviado' : 'falhou';
    } else if (enviados === 0) {
      finalStatus = 'falhou';
    } else {
      // Parcial: deixa pausado para retomar/reenviar falhas
      finalStatus = 'pausado';
    }

    await db('email_mkt_campanhas').where('id', campanhaId).update({
      status: finalStatus,
      enviados,
      falhas,
      destinatarios: totalGeral,
      data_envio: finalStatus === 'enviado' ? db.fn.now() : null,
      erro_resumo: erros.length ? erros.slice(0, 5).join(' | ') : null,
    });

    const updated = await db('email_mkt_campanhas').where('id', campanhaId).first();
    const payload = {
      ok: enviados > 0,
      campanha: mapCampanha(updated),
      enviados,
      falhas,
      total: totalGeral,
      paused: finalStatus === 'pausado',
      error: enviados > 0 ? null : erros[0] || 'Nenhum e-mail enviado',
    };
    if (finalStatus === 'pausado') {
      emit({
        type: 'done',
        ...payload,
        message: 'Envio parcial — use Retomar para reenviar pendências/falhas',
      });
    } else {
      emit({ type: 'done', ...payload });
    }
    return payload;
  } catch (e) {
    console.error('[EmailMkt] sendCampanha:', e.message);
    try {
      // Em crash, deixa pausado para poder retomar (não perde o progresso)
      await db('email_mkt_campanhas').where('id', campanhaId).update({
        status: 'pausado',
        erro_resumo: e.message,
      });
    } catch (_) {}
    const payload = { ok: false, error: e.message, paused: true };
    emit({ type: 'error', ...payload });
    return payload;
  }
}

async function pauseCampanha(campanhaId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTables(db);
    const row = await db('email_mkt_campanhas').where('id', campanhaId).first();
    if (!row) return { ok: false, error: 'Campanha não encontrada' };
    if (row.status === 'enviado') return { ok: false, error: 'Campanha já foi enviada por completo' };
    if (row.status === 'cancelado') return { ok: false, error: 'Campanha cancelada' };
    if (!['enviando', 'pausado', 'falhou', 'rascunho', 'agendado'].includes(row.status)) {
      return { ok: false, error: `Não é possível pausar no status ${row.status}` };
    }
    await db('email_mkt_campanhas').where('id', campanhaId).update({
      status: 'pausado',
      erro_resumo: row.erro_resumo || 'Pausada pelo operador',
    });
    const updated = await db('email_mkt_campanhas').where('id', campanhaId).first();
    return { ok: true, campanha: mapCampanha(updated) };
  } catch (e) {
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
    const payload = {
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
    };
    if (await db.schema.hasColumn('email_mkt_campanhas', 'formato')) {
      payload.formato = row.formato === 'html' || looksLikeHtml(row.corpo) ? 'html' : 'texto';
    }
    const [id] = await db('email_mkt_campanhas').insert(payload);
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

/**
 * Gera HTML completo de e-mail marketing via IA (OpenAI configurada no sistema).
 */
async function gerarHtmlCampanha(dados = {}) {
  const iaService = require('./ia.service');

  try {
    const assunto = String(dados.assunto || '').trim();
    const rascunho = String(dados.rascunho || dados.corpo || dados.mensagem || '').trim();
    const categoria = String(dados.categoria || 'avisos');
    const publico = String(dados.publicoLabel || dados.publico || PUBLICO_LABELS[dados.publicoTipo] || 'clientes');
    const instrucao = String(dados.instrucao || '').trim();

    if (!assunto && !rascunho && !instrucao) {
      return { ok: false, error: 'Informe o assunto, um rascunho ou uma instrução para a IA' };
    }

    const openai = await iaService.ensureReady();
    const params = await iaService.getParams();

    const system = `Você é um especialista em e-mail marketing da CADBRASIL (credenciamento SICAF / fornecedores públicos no Brasil).
Gere um e-mail HTML completo, profissional e responsivo (tabelas + CSS inline), pronto para envio.

Regras obrigatórias:
- Retorne APENAS o código HTML (comece com <!DOCTYPE html> ou <html>). Sem markdown, sem \`\`\`.
- Largura máxima ~560px, centralizado, fundo #f1f5f9, card branco com borda sutil.
- Header escuro (#0f172a) com texto "CADBRASIL".
- CTA azul (#2563eb) apontando para {{link}}.
- Use variáveis dinâmicas no formato {{variavel}} (obrigatório), por exemplo:
  {{razaosocial}}, {{cnpj}}, {{nome}}, {{email}}, {{telefone}}, {{cidade}}, {{estado}}, {{nomefantasia}}, {{link}}, {{certidao}}, {{dias}}.
- NÃO invente dados reais; deixe as variáveis no HTML para personalização no envio.
- Sem scripts externos; sem imagens obrigatórias (pode citar cores sólidas).
- Footer discreto com "CADBRASIL · Credenciamento SICAF".`;

    const user = `Crie o HTML do e-mail com estes dados:
- Categoria: ${categoria}
- Público: ${publico}
- Assunto: ${assunto || '(definir a partir do conteúdo)'}
- Rascunho / ideia: ${rascunho || '(não informado)'}
- Instrução extra: ${instrucao || '(nenhuma)'}

Produza o HTML final completo agora.`;

    const response = await openai.chat.completions.create({
      model: params.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: Math.min(0.7, Number(params.temperature) || 0.5),
      max_tokens: Math.min(4000, Math.max(1200, Number(params.maxTokens) || 2500)),
    });

    let html = String(response.choices?.[0]?.message?.content || '').trim();
    if (!html) return { ok: false, error: 'A IA não retornou HTML' };

    html = html
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    if (!looksLikeHtml(html)) {
      return { ok: false, error: 'Resposta da IA não parece HTML válido', html };
    }

    return { ok: true, html, formato: 'html' };
  } catch (e) {
    console.error('[EmailMkt] gerarHtmlCampanha:', e.message);
    return { ok: false, error: e.message || 'Falha ao gerar HTML com IA' };
  }
}

module.exports = {
  ensureTables,
  getDashboard,
  processDueCampanhas,
  createCampanha,
  sendCampanha,
  pauseCampanha,
  duplicateCampanha,
  cancelCampanha,
  deleteCampanha,
  toggleAutomacao,
  saveTemplate,
  deleteTemplate,
  gerarHtmlCampanha,
  PUBLICO_LABELS,
  PUBLICO_META,
  VARIAVEIS_EMAIL,
  HTML_EMAIL_TEMPLATE,
};
