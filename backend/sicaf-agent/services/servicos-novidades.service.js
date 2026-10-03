/**
 * Alertas dos serviços CADBRASIL na página Início do cliente.
 *
 * Por empresa e serviço (CAUFESP, BLL, Licitações-e, PNCP) devolve no máximo um item:
 * - `acao`: algo que depende do cliente (enviar documentos, assinar termo, renovar mensalidade…);
 * - `novidade`: a equipe mexeu no serviço depois da última vez que o usuário abriu a página dele.
 * Abrir a página do serviço grava a visualização e apaga as novidades (as ações continuam até
 * serem resolvidas).
 */
const { getDb } = require('../database/connection');

const TABELA_VISTOS = 'servicos_novidades_vistos';
const SERVICOS = ['caufesp', 'bll', 'licitacoes_e', 'pncp'];
const DIAS_AVISO_MENSALIDADE = 7;
const DIAS_AVISO_VENCIDO = 30;
const MAX_CLIENTES = 200;

const ASSESSORIAS = {
  caufesp: { tabela: 'caufesp_processos', portal: 'CAUFESP', cadastro: 'CRC' },
  bll: { tabela: 'bll_processos', portal: 'BLL', cadastro: 'cadastro' },
};
const MODULOS = { licitacoes_e: 'Assistente Licitações-e', pncp: 'PNCP Inteligente' };

let ensurePromise = null;
function ensureTable(db) {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      if (!(await db.schema.hasTable(TABELA_VISTOS))) {
        await db.schema.createTable(TABELA_VISTOS, (t) => {
          t.increments('id').primary();
          t.integer('usuario_id').unsigned().notNullable();
          t.integer('cliente_id').unsigned().notNullable();
          t.string('servico', 20).notNullable();
          t.dateTime('visto_em').notNullable();
          t.unique(['usuario_id', 'cliente_id', 'servico']);
        });
      }
    })().catch((e) => {
      ensurePromise = null;
      throw e;
    });
  }
  return ensurePromise;
}

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoDate(v) {
  if (!v) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return String(v).slice(0, 10);
}

function diasEntre(deIso, ateIso) {
  return Math.round((new Date(`${ateIso}T00:00:00`) - new Date(`${deIso}T00:00:00`)) / 86400000);
}

function dataBr(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}

function posterior(a, b) {
  if (!a) return false;
  if (!b) return true;
  return new Date(a).getTime() > new Date(b).getTime();
}

async function colunasExistentes(db, tabela, colunas) {
  const out = [];
  for (const c of colunas) if (await db.schema.hasColumn(tabela, c)) out.push(c);
  return out;
}

function itemAssessoria(cfg, p, docsRecusados, pagamentoAberto, visto) {
  const novo = posterior(p.equipe_atualizou_em, visto);
  const mensagem = p.observacao_cadbrasil ? String(p.observacao_cadbrasil).slice(0, 280) : null;
  const acao = (titulo, detalhe) => ({ tipo: 'acao', titulo, detalhe: detalhe || mensagem, novo });

  if (!p.pago) {
    return pagamentoAberto
      ? acao('Pagamento da assessoria pendente', 'Pague o boleto ou PIX gerado para liberar o envio dos documentos.')
      : null;
  }
  if (p.status === 'pendencia_documentos') {
    return acao(
      docsRecusados > 0
        ? `${docsRecusados} documento(s) recusado(s) — corrija e reenvie`
        : 'Documentos com pendência — corrija e reenvie',
    );
  }
  if (p.status === 'exigencia_governo') return acao(`Pendência apontada pela ${cfg.portal}`);
  if (p.status === 'indeferido') return acao(`Cadastro recusado pela ${cfg.portal} — fale com a equipe`);
  if (p.termo_status === 'aguardando_assinatura') {
    return acao('Assine e devolva o Termo de Adesão', 'O termo já está disponível para download na etapa 4.');
  }
  if (p.termo_status === 'recusado') {
    return acao('Termo de Adesão precisa ser reenviado', p.termo_observacao || mensagem);
  }
  if (p.status === 'documentacao') {
    return acao('Envie os documentos para iniciar o cadastro', 'Pagamento confirmado: a lista de documentos já está liberada.');
  }
  if (!novo) return null;

  const titulos = {
    conferencia_cadbrasil: 'Seus documentos estão em conferência pela CADBRASIL',
    protocolado: `Cadastro iniciado na ${cfg.portal}`,
    analise_governo: `Seu cadastro está em análise na ${cfg.portal}`,
    aprovado: `Cadastro aprovado na ${cfg.portal}!`,
  };
  return {
    tipo: 'novidade',
    titulo: titulos[p.status] || 'A equipe CADBRASIL atualizou seu processo',
    detalhe: mensagem,
    novo: true,
  };
}

function itemMensalidade(nome, a, hoje) {
  const pago = isoDate(a.valido_ate);
  const cortesia = isoDate(a.cortesia_ate);
  const validoAte = pago && cortesia ? (pago > cortesia ? pago : cortesia) : pago || cortesia;
  if (!validoAte) return null;
  const dias = diasEntre(hoje, validoAte);
  if (dias < 0 && -dias <= DIAS_AVISO_VENCIDO) {
    return {
      tipo: 'acao',
      titulo: 'Mensalidade vencida — renove para voltar a usar',
      detalhe: `O acesso ao ${nome} venceu em ${dataBr(validoAte)}. Seus dados continuam guardados.`,
      novo: false,
    };
  }
  if (dias >= 0 && dias <= DIAS_AVISO_MENSALIDADE) {
    return {
      tipo: 'acao',
      titulo: dias === 0 ? 'Mensalidade vence hoje' : `Mensalidade vence em ${dias} dia(s)`,
      detalhe: `Renove pelo portal para não perder o acesso ao ${nome} (válido até ${dataBr(validoAte)}).`,
      novo: false,
    };
  }
  return null;
}

/** Novidades de todas as empresas do usuário, agrupadas por serviço. */
async function listar({ usuarioId }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTable(db);
    const access = require('./client-access.service');
    const clientes = (await access.listClientesForUsuario(db, usuarioId)).slice(0, MAX_CLIENTES);
    const servicos = Object.fromEntries(SERVICOS.map((s) => [s, []]));
    if (!clientes.length) return { ok: true, servicos };

    const ids = clientes.map((c) => c.id);
    const porId = new Map(clientes.map((c) => [c.id, c]));
    const vistos = new Map(
      (await db(TABELA_VISTOS).where('usuario_id', usuarioId).whereIn('cliente_id', ids)).map((v) => [
        `${v.cliente_id}:${v.servico}`,
        v.visto_em,
      ]),
    );
    const visto = (clienteId, servico) => vistos.get(`${clienteId}:${servico}`) || null;
    const push = (servico, clienteId, item) => {
      if (!item) return;
      const c = porId.get(clienteId);
      servicos[servico].push({
        clienteId,
        empresa: c?.razao_social || c?.nome_fantasia || `Empresa #${clienteId}`,
        cnpj: String(c?.documento || '').replace(/\D/g, ''),
        ...item,
      });
    };

    for (const [servico, cfg] of Object.entries(ASSESSORIAS)) {
      if (!(await db.schema.hasTable(cfg.tabela))) continue;
      const extras = await colunasExistentes(db, cfg.tabela, [
        'equipe_atualizou_em',
        'termo_status',
        'termo_observacao',
      ]);
      const processos = await db(cfg.tabela)
        .whereIn('cliente_id', ids)
        .select('id', 'cliente_id', 'status', 'pago', 'observacao_cadbrasil', ...extras)
        .orderBy('id', 'desc');
      const ultimos = new Map();
      for (const p of processos) if (!ultimos.has(p.cliente_id)) ultimos.set(p.cliente_id, p);
      if (!ultimos.size) continue;

      const processoIds = [...ultimos.values()].map((p) => p.id);
      const recusados = new Map(
        (
          await db(`${servico}_documentos`)
            .whereIn('processo_id', processoIds)
            .where('status', 'recusado')
            .groupBy('processo_id')
            .select('processo_id')
            .count({ n: '*' })
        ).map((r) => [r.processo_id, Number(r.n)]),
      );
      const hoje = hojeIso();
      const comPagamentoAberto = new Set(
        (
          await db('pagamentos')
            .whereNull('deleted_at')
            .where('origem', servico)
            .whereIn('origem_id', processoIds)
            .whereIn('status', ['aguardando', 'gerado'])
            .where((q) => q.whereNull('data_vencimento').orWhere('data_vencimento', '>=', hoje))
            .select('origem_id')
        ).map((r) => r.origem_id),
      );

      for (const p of ultimos.values()) {
        push(
          servico,
          p.cliente_id,
          itemAssessoria(cfg, p, recusados.get(p.id) || 0, comPagamentoAberto.has(p.id), visto(p.cliente_id, servico)),
        );
      }
    }

    const hoje = hojeIso();
    if (await db.schema.hasTable('modulos_assinaturas')) {
      const extras = await colunasExistentes(db, 'modulos_assinaturas', ['cortesia_ate']);
      const assinaturas = await db('modulos_assinaturas')
        .whereIn('cliente_id', ids)
        .whereIn('modulo', Object.keys(MODULOS))
        .select('cliente_id', 'modulo', 'valido_ate', ...extras);
      for (const a of assinaturas) push(a.modulo, a.cliente_id, itemMensalidade(MODULOS[a.modulo], a, hoje));
    }

    if (
      (await db.schema.hasTable('licitacoes_e_acompanhamentos')) &&
      (await db.schema.hasColumn('licitacoes_e_acompanhamentos', 'respondido_em'))
    ) {
      const respostas = await db('licitacoes_e_acompanhamentos')
        .whereIn('cliente_id', ids)
        .whereNull('deleted_at')
        .whereNotNull('respondido_em')
        .whereNotNull('observacao_cadbrasil')
        .select('cliente_id', 'respondido_em', 'numero_licitacao', 'orgao');
      const porCliente = new Map();
      for (const r of respostas) {
        if (!posterior(r.respondido_em, visto(r.cliente_id, 'licitacoes_e'))) continue;
        porCliente.set(r.cliente_id, [...(porCliente.get(r.cliente_id) || []), r]);
      }
      for (const [clienteId, lista] of porCliente) {
        const jaTemAcao = servicos.licitacoes_e.some((i) => i.clienteId === clienteId);
        if (jaTemAcao) continue;
        push('licitacoes_e', clienteId, {
          tipo: 'novidade',
          titulo:
            lista.length > 1
              ? `A equipe respondeu ${lista.length} pedidos de apoio`
              : 'A equipe respondeu seu pedido de apoio',
          detalhe: lista
            .map((r) => r.numero_licitacao || r.orgao)
            .filter(Boolean)
            .slice(0, 3)
            .join(' · ') || null,
          novo: true,
        });
      }
    }

    return { ok: true, servicos };
  } catch (e) {
    console.error('[ServicosNovidades] listar:', e.message);
    return { ok: false, error: e.message };
  }
}

async function marcarVisto({ usuarioId, clienteId, servico }) {
  if (!SERVICOS.includes(servico)) return { ok: false, error: 'Serviço inválido.' };
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  try {
    await ensureTable(db);
    await db(TABELA_VISTOS)
      .insert({ usuario_id: usuarioId, cliente_id: clienteId, servico, visto_em: db.fn.now() })
      .onConflict(['usuario_id', 'cliente_id', 'servico'])
      .merge({ visto_em: db.fn.now() });
    return { ok: true };
  } catch (e) {
    console.error('[ServicosNovidades] marcarVisto:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { SERVICOS, listar, marcarVisto };
