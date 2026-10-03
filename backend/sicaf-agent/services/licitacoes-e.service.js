/**
 * Assistente Licitações-e CADBRASIL.
 *
 * Cada empresa acompanha as licitações do Licitações-e (Banco do Brasil) que pretende disputar:
 * situação no portal (publicada → propostas abertas → em disputa → em homologação → concluída)
 * e as etapas do assistente (edital, aptidão, checklist, proposta, envio, disputa, habilitação, resultado).
 */
const { getDb } = require('../database/connection');

const LOG_PREFIX = '[Licitacoes-e]';
const TABELA = 'licitacoes_e_acompanhamentos';
const TABELA_PERFIL = 'licitacoes_e_perfil';

const SITUACOES_PORTAL = ['publicada', 'propostas_abertas', 'em_disputa', 'em_homologacao', 'concluida'];
const ETAPAS = ['localizar', 'edital', 'aptidao', 'checklist', 'proposta', 'envio', 'disputa', 'habilitacao', 'resultado'];
const ETAPAS_ACESSO = ['certificado', 'documentos', 'formulario', 'agencia', 'chave', 'primeiro_acesso'];
const RESULTADOS = ['vencedora', 'nao_vencedora', 'fracassada', 'deserta', 'revogada'];
const CHECKLIST_STATUS = ['pendente', 'ok', 'nao_aplica'];

/** Checklist inicial — substituído/complementado pelos itens do edital quando ele é analisado. */
const CHECKLIST_PADRAO = [
  ['Acesso', 'Chave e senha do Licitações-e ativas para o representante'],
  ['Habilitação Jurídica', 'Contrato social / estatuto e última alteração'],
  ['Habilitação Jurídica', 'Documento do representante legal'],
  ['Regularidade Fiscal', 'Cartão CNPJ'],
  ['Regularidade Fiscal', 'CND Federal (Receita/PGFN)'],
  ['Regularidade Fiscal', 'CRF do FGTS'],
  ['Regularidade Fiscal', 'Certidão Negativa de Débitos Trabalhistas (CNDT)'],
  ['Regularidade Fiscal', 'Certidões estadual e municipal'],
  ['Qualificação Econômico-Financeira', 'Certidão de falência e recuperação judicial'],
  ['Qualificação Econômico-Financeira', 'Balanço patrimonial e DRE do último exercício'],
  ['Qualificação Técnica', 'Atestado(s) de capacidade técnica compatível com o objeto'],
  ['Declarações', 'Declarações exigidas no edital (ME/EPP, menor, idoneidade etc.)'],
];

let ensurePromise = null;

function ensureTables(db) {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      if (!(await db.schema.hasTable(TABELA))) {
        await db.schema.createTable(TABELA, (t) => {
          t.increments('id').primary();
          t.integer('cliente_id').unsigned().notNullable().index();
          t.integer('usuario_id').unsigned().nullable();
          t.integer('licitacao_id').unsigned().nullable();
          t.string('numero_licitacao', 40).nullable();
          t.string('orgao', 255).nullable();
          t.text('objeto').nullable();
          t.string('uf', 2).nullable();
          t.string('modalidade', 80).nullable();
          t.dateTime('data_disputa').nullable();
          t.decimal('valor_estimado', 15, 2).nullable();
          t.string('link', 500).nullable();
          t.string('situacao_portal', 20).notNullable().defaultTo('publicada');
          t.text('etapas').nullable();
          t.text('checklist').nullable();
          t.string('edital_url', 500).nullable();
          t.string('edital_nome', 255).nullable();
          t.text('analise', 'mediumtext').nullable();
          t.dateTime('analise_em').nullable();
          t.string('resultado', 20).nullable();
          t.dateTime('apoio_solicitado_em').nullable();
          t.text('apoio_mensagem').nullable();
          t.text('observacao_cadbrasil').nullable();
          t.dateTime('deleted_at').nullable();
          t.timestamps(true, true);
        });
      }
      if (!(await db.schema.hasColumn(TABELA, 'respondido_em'))) {
        await db.schema.alterTable(TABELA, (t) => t.dateTime('respondido_em').nullable());
      }
      if (!(await db.schema.hasTable(TABELA_PERFIL))) {
        await db.schema.createTable(TABELA_PERFIL, (t) => {
          t.increments('id').primary();
          t.integer('cliente_id').unsigned().notNullable().unique();
          t.text('acesso_etapas').nullable();
          t.timestamps(true, true);
        });
      }
    })().catch((e) => {
      ensurePromise = null;
      throw e;
    });
  }
  return ensurePromise;
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function novoItem(categoria, item, status = 'pendente') {
  return {
    id: `${normalizar(categoria).slice(0, 12)}-${normalizar(item).replace(/[^a-z0-9]/g, '').slice(0, 40)}`,
    categoria: String(categoria).slice(0, 80),
    item: String(item).slice(0, 400),
    status,
  };
}

function checklistPadrao() {
  return CHECKLIST_PADRAO.map(([c, i]) => novoItem(c, i));
}

/** Número do processo no Licitações-e a partir do link público (…/visualizar-processo-publico/1100745). */
function numeroDoLink(link) {
  const m = String(link || '').match(/(\d{5,})\/?$/);
  return m ? m[1] : null;
}

function toIso(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function mapRow(r) {
  return {
    id: r.id,
    licitacaoId: r.licitacao_id,
    numeroLicitacao: r.numero_licitacao,
    orgao: r.orgao,
    objeto: r.objeto,
    uf: r.uf,
    modalidade: r.modalidade,
    dataDisputa: toIso(r.data_disputa),
    valorEstimado: r.valor_estimado != null ? Number(r.valor_estimado) : null,
    link: r.link,
    situacaoPortal: r.situacao_portal,
    etapas: parseJson(r.etapas, []),
    checklist: parseJson(r.checklist, []),
    editalUrl: r.edital_url,
    editalNome: r.edital_nome,
    analise: parseJson(r.analise, null),
    analiseEm: toIso(r.analise_em),
    resultado: r.resultado,
    apoioSolicitadoEm: toIso(r.apoio_solicitado_em),
    apoioMensagem: r.apoio_mensagem,
    observacaoCadbrasil: r.observacao_cadbrasil,
    createdAt: toIso(r.created_at),
  };
}

async function getPainel(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTables(db);
    const [rows, perfil] = await Promise.all([
      db(TABELA)
        .where('cliente_id', clienteId)
        .whereNull('deleted_at')
        .orderByRaw('data_disputa IS NULL, data_disputa ASC')
        .orderBy('id', 'desc'),
      db(TABELA_PERFIL).where('cliente_id', clienteId).first(),
    ]);
    return {
      ok: true,
      acessoEtapas: parseJson(perfil?.acesso_etapas, []),
      acompanhamentos: rows.map(mapRow),
    };
  } catch (e) {
    console.error(`${LOG_PREFIX} getPainel:`, e.message);
    return { ok: false, error: e.message };
  }
}

async function salvarAcesso({ clienteId, etapas }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);
  const validas = (Array.isArray(etapas) ? etapas : []).filter((e) => ETAPAS_ACESSO.includes(e));
  const atual = await db(TABELA_PERFIL).where('cliente_id', clienteId).first();
  if (atual) {
    await db(TABELA_PERFIL)
      .where('id', atual.id)
      .update({ acesso_etapas: JSON.stringify(validas), updated_at: db.fn.now() });
  } else {
    await db(TABELA_PERFIL).insert({ cliente_id: clienteId, acesso_etapas: JSON.stringify(validas) });
  }
  return getPainel(clienteId);
}

async function criar({ clienteId, usuarioId, dados }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  await ensureTables(db);
  const d = dados || {};

  let base = {
    numero_licitacao: d.numeroLicitacao ? String(d.numeroLicitacao).slice(0, 40) : null,
    orgao: d.orgao ? String(d.orgao).slice(0, 255) : null,
    objeto: d.objeto ? String(d.objeto).slice(0, 5000) : null,
    uf: d.uf ? String(d.uf).slice(0, 2).toUpperCase() : null,
    modalidade: d.modalidade ? String(d.modalidade).slice(0, 80) : null,
    data_disputa: d.dataDisputa || null,
    link: d.link ? String(d.link).slice(0, 500) : null,
    licitacao_id: null,
    valor_estimado: null,
  };

  const licitacaoId = Number(d.licitacaoId) || null;
  if (licitacaoId) {
    const jaExiste = await db(TABELA)
      .where({ cliente_id: clienteId, licitacao_id: licitacaoId })
      .whereNull('deleted_at')
      .first();
    if (jaExiste) return { ok: false, error: 'Esta licitação já está no seu acompanhamento.' };

    const lic = await db('licitacoes').where('id', licitacaoId).first();
    if (!lic) return { ok: false, error: 'Licitação não encontrada.' };
    const link = String(lic.link_edital || '').includes('licitacoes-e') ? lic.link_edital : lic.link_portal;
    base = {
      licitacao_id: lic.id,
      numero_licitacao: numeroDoLink(link) || lic.numero_processo,
      orgao: lic.nome_orgao,
      objeto: lic.objeto_resumido || lic.objeto,
      uf: lic.uf,
      modalidade: lic.modalidade,
      data_disputa: lic.data_encerramento || lic.data_abertura,
      link: link ? String(link).slice(0, 500) : null,
      valor_estimado: lic.valor_estimado,
    };
  }

  if (!base.objeto && !base.numero_licitacao) {
    return { ok: false, error: 'Informe ao menos o número da licitação ou o objeto.' };
  }

  const agora = base.data_disputa ? new Date(base.data_disputa) : null;
  const situacao = agora && agora.getTime() > Date.now() ? 'propostas_abertas' : 'publicada';

  const [id] = await db(TABELA).insert({
    ...base,
    cliente_id: clienteId,
    usuario_id: usuarioId || null,
    situacao_portal: situacao,
    etapas: JSON.stringify(['localizar']),
    checklist: JSON.stringify(checklistPadrao()),
  });
  const painel = await getPainel(clienteId);
  return painel.ok ? { ...painel, criadoId: id } : painel;
}

async function buscarDoCliente(db, clienteId, id) {
  await ensureTables(db);
  return db(TABELA).where({ id, cliente_id: clienteId }).whereNull('deleted_at').first();
}

async function atualizar({ clienteId, id, campos }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const row = await buscarDoCliente(db, clienteId, id);
  if (!row) return { ok: false, error: 'Acompanhamento não encontrado.' };
  const c = campos || {};
  const update = { updated_at: db.fn.now() };

  if (c.situacaoPortal !== undefined) {
    if (!SITUACOES_PORTAL.includes(c.situacaoPortal)) return { ok: false, error: 'Situação inválida.' };
    update.situacao_portal = c.situacaoPortal;
  }
  if (c.etapas !== undefined) {
    const etapas = (Array.isArray(c.etapas) ? c.etapas : []).filter((e) => ETAPAS.includes(e));
    update.etapas = JSON.stringify([...new Set(etapas)]);
  }
  if (c.checklist !== undefined) {
    if (!Array.isArray(c.checklist)) return { ok: false, error: 'Checklist inválido.' };
    const itens = c.checklist
      .filter((i) => i && i.item)
      .slice(0, 150)
      .map((i) => ({
        ...novoItem(i.categoria || 'Outros', i.item),
        ...(i.id ? { id: String(i.id).slice(0, 80) } : {}),
        status: CHECKLIST_STATUS.includes(i.status) ? i.status : 'pendente',
      }));
    update.checklist = JSON.stringify(itens);
  }
  if (c.resultado !== undefined) {
    if (c.resultado && !RESULTADOS.includes(c.resultado)) return { ok: false, error: 'Resultado inválido.' };
    update.resultado = c.resultado || null;
  }
  if (c.dataDisputa !== undefined) update.data_disputa = c.dataDisputa || null;
  if (c.numeroLicitacao !== undefined) {
    update.numero_licitacao = c.numeroLicitacao ? String(c.numeroLicitacao).slice(0, 40) : null;
  }
  if (c.link !== undefined) update.link = c.link ? String(c.link).slice(0, 500) : null;

  await db(TABELA).where('id', row.id).update(update);
  return getPainel(clienteId);
}

/** Recebe o resultado do leitor de editais (ai-reader) e monta o checklist do edital. */
async function salvarAnalise({ clienteId, id, editalUrl, editalNome, analise }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const row = await buscarDoCliente(db, clienteId, id);
  if (!row) return { ok: false, error: 'Acompanhamento não encontrado.' };
  if (!analise || typeof analise !== 'object') return { ok: false, error: 'Análise inválida.' };

  const anterior = new Map(parseJson(row.checklist, []).map((i) => [normalizar(i.item), i.status]));
  const itens = [novoItem('Acesso', CHECKLIST_PADRAO[0][1])];
  const vistos = new Set([normalizar(CHECKLIST_PADRAO[0][1])]);
  const adicionar = (categoria, texto) => {
    const chave = normalizar(texto);
    if (!chave || vistos.has(chave)) return;
    vistos.add(chave);
    itens.push(novoItem(categoria, texto, anterior.get(chave) || 'pendente'));
  };
  for (const grupo of Array.isArray(analise.requisitosHabilitacao) ? analise.requisitosHabilitacao : []) {
    for (const item of Array.isArray(grupo?.itens) ? grupo.itens : []) {
      adicionar(grupo.categoria || 'Habilitação', item);
    }
  }
  for (const doc of Array.isArray(analise.documentos) ? analise.documentos : []) {
    adicionar('Documentos do edital', doc);
  }
  itens[0].status = anterior.get(normalizar(CHECKLIST_PADRAO[0][1])) || 'pendente';

  const etapas = new Set(parseJson(row.etapas, []));
  etapas.add('edital');

  await db(TABELA)
    .where('id', row.id)
    .update({
      edital_url: editalUrl ? String(editalUrl).slice(0, 500) : row.edital_url,
      edital_nome: editalNome ? String(editalNome).slice(0, 255) : row.edital_nome,
      analise: JSON.stringify(analise),
      analise_em: db.fn.now(),
      checklist: JSON.stringify(itens.length > 1 ? itens : checklistPadrao()),
      etapas: JSON.stringify([...etapas]),
      orgao: row.orgao || (analise.orgao ? String(analise.orgao).slice(0, 255) : null),
      objeto: row.objeto || (analise.objeto ? String(analise.objeto).slice(0, 5000) : null),
      modalidade: row.modalidade || (analise.modalidade ? String(analise.modalidade).slice(0, 80) : null),
      numero_licitacao: row.numero_licitacao || (analise.numero ? String(analise.numero).slice(0, 40) : null),
      updated_at: db.fn.now(),
    });
  return getPainel(clienteId);
}

async function solicitarApoio({ clienteId, id, mensagem }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const row = await buscarDoCliente(db, clienteId, id);
  if (!row) return { ok: false, error: 'Acompanhamento não encontrado.' };
  await db(TABELA)
    .where('id', row.id)
    .update({
      apoio_solicitado_em: db.fn.now(),
      apoio_mensagem: mensagem ? String(mensagem).slice(0, 2000) : null,
      updated_at: db.fn.now(),
    });
  return getPainel(clienteId);
}

/** Equipe CADBRASIL: orientação exibida ao cliente e baixa do pedido de apoio. */
async function responderApoio({ clienteId, id, observacao, resolvido, usuarioId }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const row = await buscarDoCliente(db, clienteId, id);
  if (!row) return { ok: false, error: 'Acompanhamento não encontrado.' };

  const update = {
    observacao_cadbrasil: observacao ? String(observacao).slice(0, 4000) : null,
    respondido_em: observacao ? db.fn.now() : null,
    updated_at: db.fn.now(),
  };
  if (resolvido) {
    update.apoio_solicitado_em = null;
    update.apoio_mensagem = null;
  }
  await db(TABELA).where('id', row.id).update(update);

  try {
    await db('historico_acoes').insert({
      cliente_id: clienteId,
      usuario_id: usuarioId || null,
      acao: resolvido
        ? `Apoio Licitações-e atendido (${row.numero_licitacao || row.orgao || `#${row.id}`})`
        : `Orientação Licitações-e atualizada (${row.numero_licitacao || row.orgao || `#${row.id}`})`,
      entidade: TABELA,
      entidade_id: row.id,
      created_at: db.fn.now(),
    });
  } catch (_) {}

  return getPainel(clienteId);
}

async function remover({ clienteId, id }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const row = await buscarDoCliente(db, clienteId, id);
  if (!row) return { ok: false, error: 'Acompanhamento não encontrado.' };
  await db(TABELA).where('id', row.id).update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });
  return getPainel(clienteId);
}

/** Licitações da base (captadas do PNCP) que são disputadas no Licitações-e. */
async function buscar({ q, uf, somenteAbertas, pagina }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    const limite = 20;
    const page = Math.max(1, Number(pagina) || 1);
    const query = db('licitacoes').where((w) =>
      w.where('link_edital', 'like', '%licitacoes-e%').orWhere('link_portal', 'like', '%licitacoes-e%'),
    );
    const termo = String(q || '').trim();
    if (termo) {
      query.where((w) =>
        w
          .where('objeto', 'like', `%${termo}%`)
          .orWhere('objeto_resumido', 'like', `%${termo}%`)
          .orWhere('nome_orgao', 'like', `%${termo}%`)
          .orWhere('link_edital', 'like', `%${termo}%`),
      );
    }
    if (uf) query.where('uf', String(uf).slice(0, 2).toUpperCase());
    if (somenteAbertas) query.where('data_encerramento', '>=', db.fn.now());

    const [{ total }] = await query.clone().count('* as total');
    const rows = await query
      .select(
        'id',
        'nome_orgao',
        'uf',
        'municipio',
        'modalidade',
        'objeto',
        'objeto_resumido',
        'data_abertura',
        'data_encerramento',
        'valor_estimado',
        'link_edital',
        'link_portal',
        'status',
      )
      .orderBy(somenteAbertas ? 'data_encerramento' : 'data_publicacao', somenteAbertas ? 'asc' : 'desc')
      .limit(limite)
      .offset((page - 1) * limite);

    return {
      ok: true,
      total: Number(total),
      pagina: page,
      totalPaginas: Math.max(1, Math.ceil(Number(total) / limite)),
      licitacoes: rows.map((r) => {
        const link = String(r.link_edital || '').includes('licitacoes-e') ? r.link_edital : r.link_portal;
        return {
          id: r.id,
          numeroLicitacao: numeroDoLink(link),
          orgao: r.nome_orgao,
          uf: r.uf,
          municipio: r.municipio,
          modalidade: r.modalidade,
          objeto: r.objeto_resumido || r.objeto,
          dataAbertura: toIso(r.data_abertura),
          dataEncerramento: toIso(r.data_encerramento),
          valorEstimado: r.valor_estimado != null ? Number(r.valor_estimado) : null,
          link,
          linkPncp: r.link_portal && String(r.link_portal).includes('pncp.gov.br') ? r.link_portal : null,
        };
      }),
    };
  } catch (e) {
    console.error(`${LOG_PREFIX} buscar:`, e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  SITUACOES_PORTAL,
  ETAPAS,
  getPainel,
  salvarAcesso,
  criar,
  atualizar,
  salvarAnalise,
  solicitarApoio,
  responderApoio,
  remover,
  buscar,
};
