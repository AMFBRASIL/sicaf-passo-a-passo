/**
 * Relatório de uso do portal para o cliente autenticado.
 * Agrega logins/IP, licitações na mira, atualizações SICAF e eventos de uso.
 */
const crypto = require('crypto');
const { getDb } = require('../database/connection');
const { listClientesForUsuario } = require('./client-access.service');
const { resolveSicafDisplayStatus, calcDaysRemaining } = require('../utils/sicaf-status');

const USO_TABLE = 'portal_uso_eventos';

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Código de licença estável e único na tela — derivado do cliente (não precisa de coluna).
 * Formato: CB-{id}-{seg1}-{seg2}  ex. CB-32403-A7F2-9C1E
 */
function gerarCodigoLicenca(cliente) {
  const id = Number(cliente?.id) || 0;
  const doc = digitsOnly(cliente?.documento) || String(id);
  const seed = `cadbrasil|licenca|v1|${id}|${doc}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').toUpperCase();
  const seg1 = hash.slice(0, 4);
  const seg2 = hash.slice(4, 8);
  const idPart = String(id).padStart(5, '0');
  return `CB-${idPart}-${seg1}-${seg2}`;
}

async function ensureUsoTable(db) {
  const has = await db.schema.hasTable(USO_TABLE);
  if (has) return;
  await db.schema.createTable(USO_TABLE, (t) => {
    t.increments('id').primary();
    t.integer('usuario_id').unsigned().notNullable().index();
    t.integer('cliente_id').unsigned().nullable().index();
    t.string('evento', 80).notNullable().index();
    t.string('entidade', 80).nullable();
    t.integer('entidade_id').unsigned().nullable();
    t.string('ip', 64).nullable();
    t.string('path', 255).nullable();
    t.text('meta').nullable();
    t.timestamp('created_at').defaultTo(db.fn.now()).index();
  });
}

function extractIp(requestLike) {
  if (!requestLike) return null;
  const headers = requestLike.headers || {};
  const get = (k) => {
    if (typeof headers.get === 'function') return headers.get(k);
    return headers[k] || headers[k.toLowerCase()] || null;
  };
  const xf = String(get('x-forwarded-for') || '').split(',')[0].trim();
  const real = String(get('x-real-ip') || '').trim();
  return xf || real || null;
}

async function pickClientePrincipal(db, usuarioId) {
  const clientes = await listClientesForUsuario(db, usuarioId);
  if (!clientes?.length) return null;
  return clientes[0];
}

async function registrarEvento(usuarioId, { evento, clienteId, entidade, entidadeId, path, ip, meta } = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco indisponível' };
  const evt = String(evento || '').trim().slice(0, 80);
  if (!evt) return { ok: false, error: 'Evento obrigatório' };

  try {
    await ensureUsoTable(db);
    let cid = clienteId != null ? Number(clienteId) : null;
    if (!cid || !Number.isFinite(cid)) {
      const principal = await pickClientePrincipal(db, usuarioId);
      cid = principal?.id || null;
    }
    await db(USO_TABLE).insert({
      usuario_id: usuarioId,
      cliente_id: cid,
      evento: evt,
      entidade: entidade ? String(entidade).slice(0, 80) : null,
      entidade_id: entidadeId != null ? Number(entidadeId) || null : null,
      ip: ip ? String(ip).slice(0, 64) : null,
      path: path ? String(path).slice(0, 255) : null,
      meta: meta != null ? JSON.stringify(meta).slice(0, 2000) : null,
      created_at: db.fn.now(),
    });
    return { ok: true };
  } catch (e) {
    console.warn('[Relatorio] registrarEvento:', e.message);
    return { ok: false, error: e.message };
  }
}

async function countEventos(db, { usuarioId, clienteId, evento, sinceDays = null }) {
  try {
    await ensureUsoTable(db);
    let q = db(USO_TABLE).where('evento', evento);
    if (usuarioId) q = q.where('usuario_id', usuarioId);
    if (clienteId) q = q.where('cliente_id', clienteId);
    if (sinceDays != null) {
      q = q.whereRaw('created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [sinceDays]);
    }
    const row = await q.count({ total: '*' }).first();
    return Number(row?.total || 0);
  } catch (_) {
    return 0;
  }
}

async function getRelatorio(usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco indisponível' };

  try {
    const cliente = await pickClientePrincipal(db, usuarioId);
    if (!cliente) {
      return { ok: false, error: 'Nenhuma empresa vinculada a este usuário.' };
    }

    const fullCliente = await db('clientes').where('id', cliente.id).first();
    const codigoLicenca = gerarCodigoLicenca(fullCliente || cliente);

    // SICAF
    let sicaf = null;
    try {
      sicaf = await db('sicaf_cadastros').where('cliente_id', cliente.id).first();
    } catch (_) {}

    const sicafStatus = sicaf
      ? resolveSicafDisplayStatus(sicaf.status, sicaf.data_validade, true)
      : 'Sem cadastro';
    const diasRestantes = sicaf?.data_validade ? calcDaysRemaining(sicaf.data_validade) : null;

    // Manutenção
    let manutencao = null;
    try {
      manutencao = await db('manutencoes')
        .where('cliente_id', cliente.id)
        .orderBy('id', 'desc')
        .first();
    } catch (_) {}

    // Atualizações SICAF (Assistente)
    let atualizacoes = {
      usadas: 0,
      limite: 3,
      restantes: 3,
      manutencaoAtiva: false,
      bloqueado: false,
    };
    try {
      const atSvc = require('./atualizacoes-sicaf.service');
      const ctx = await atSvc.getAdminAtualizacoesGratuitas(cliente.id);
      if (ctx?.ok) {
        atualizacoes = {
          usadas: ctx.usadas ?? 0,
          limite: ctx.limiteEfetivo ?? ctx.limite ?? 3,
          restantes: ctx.restantes ?? 0,
          manutencaoAtiva: !!ctx.manutencaoAtiva,
          bloqueado: !!ctx.bloqueado,
          resetEm: ctx.resetEm || null,
        };
      }
    } catch (_) {}

    // Logins / IP
    let logins = { total: 0, sucessos: 0, ultimo: null, ipsRecentes: [] };
    try {
      if (await db.schema.hasTable('login_logs')) {
        const base = db('login_logs').where('usuario_id', usuarioId);
        const totalRow = await base.clone().count({ total: '*' }).first();
        const okRow = await base.clone().where('sucesso', 1).count({ total: '*' }).first();
        logins.total = Number(totalRow?.total || 0);
        logins.sucessos = Number(okRow?.total || 0);

        const recent = await db('login_logs')
          .where({ usuario_id: usuarioId, sucesso: 1 })
          .orderBy('created_at', 'desc')
          .limit(8)
          .select('ip', 'dispositivo', 'navegador', 'plataforma', 'created_at');

        if (recent[0]) {
          logins.ultimo = {
            ip: recent[0].ip || null,
            dispositivo: recent[0].dispositivo || null,
            navegador: recent[0].navegador || null,
            plataforma: recent[0].plataforma || null,
            em: recent[0].created_at || null,
          };
        }

        const seen = new Set();
        for (const r of recent) {
          const ip = String(r.ip || '').trim();
          if (!ip || seen.has(ip)) continue;
          seen.add(ip);
          logins.ipsRecentes.push({
            ip,
            em: r.created_at,
            dispositivo: r.dispositivo || null,
            navegador: r.navegador || null,
          });
          if (logins.ipsRecentes.length >= 5) break;
        }
      }
    } catch (_) {}

    // Licitações na mira
    let licitacoes = {
      naMira: 0,
      vaiParticipar: 0,
      itensMira: [],
      acessosTela: 0,
      acessosTela30d: 0,
      detalhesAbertos: 0,
    };
    try {
      if (await db.schema.hasTable('licitacoes_mira')) {
        const miraCount = await db('licitacoes_mira')
          .where('usuario_id', usuarioId)
          .count({ total: '*' })
          .first();
        licitacoes.naMira = Number(miraCount?.total || 0);

        const partCount = await db('licitacoes_mira')
          .where({ usuario_id: usuarioId, pipeline_status: 'vai_participar' })
          .count({ total: '*' })
          .first()
          .catch(() => ({ total: 0 }));
        licitacoes.vaiParticipar = Number(partCount?.total || 0);

        const hasLicitacoes = await db.schema.hasTable('licitacoes');
        let itensQ = db('licitacoes_mira as m').where('m.usuario_id', usuarioId);
        if (hasLicitacoes) {
          itensQ = itensQ
            .leftJoin('licitacoes as l', 'l.id', 'm.licitacao_id')
            .select(
              'm.licitacao_id as id',
              'm.pipeline_status as pipelineStatus',
              'l.objeto_resumido',
              'l.objeto',
              'l.nome_orgao',
              'l.uf',
              'l.data_encerramento as dataEncerramento',
              'l.valor_estimado as valorEstimado',
            );
        } else {
          itensQ = itensQ.select('m.licitacao_id as id', 'm.pipeline_status as pipelineStatus');
        }
        const itens = await itensQ.orderBy('m.id', 'desc').limit(12);
        licitacoes.itensMira = itens.map((r) => ({
          id: r.id,
          titulo: r.objeto_resumido || r.objeto || `Licitação #${r.id}`,
          orgao: r.nome_orgao || null,
          uf: r.uf || null,
          pipelineStatus: r.pipelineStatus || 'na_mira',
          dataEncerramento: r.dataEncerramento || null,
          valorEstimado: r.valorEstimado != null ? Number(r.valorEstimado) : null,
          atualizadoEm: null,
        }));
      }
    } catch (e) {
      console.warn('[Relatorio] licitacoes_mira:', e.message);
    }

    licitacoes.acessosTela = await countEventos(db, {
      usuarioId,
      evento: 'licitacoes.page_view',
    });
    licitacoes.acessosTela30d = await countEventos(db, {
      usuarioId,
      evento: 'licitacoes.page_view',
      sinceDays: 30,
    });
    licitacoes.detalhesAbertos = await countEventos(db, {
      usuarioId,
      evento: 'licitacoes.detalhe',
    });

    // Outros eventos úteis
    const acessosSicaf = await countEventos(db, { usuarioId, evento: 'sicaf.page_view' });
    const acessosAssistente = await countEventos(db, {
      usuarioId,
      evento: 'assistente.page_view',
    });
    const acessosRelatorio = await countEventos(db, {
      usuarioId,
      evento: 'relatorio.page_view',
    });

    // Documentos (se houver)
    let documentosCount = 0;
    try {
      if (await db.schema.hasTable('documentos_cliente')) {
        const row = await db('documentos_cliente')
          .where('cliente_id', cliente.id)
          .whereNull('deleted_at')
          .count({ total: '*' })
          .first();
        documentosCount = Number(row?.total || 0);
      } else if (await db.schema.hasTable('cliente_documentos')) {
        const row = await db('cliente_documentos')
          .where('cliente_id', cliente.id)
          .count({ total: '*' })
          .first();
        documentosCount = Number(row?.total || 0);
      }
    } catch (_) {}

    // Tickets suporte
    let ticketsAbertos = 0;
    try {
      if (await db.schema.hasTable('tickets')) {
        const row = await db('tickets')
          .where('cliente_id', cliente.id)
          .whereNotIn('status', ['fechado', 'Fechado', 'resolvido', 'Resolvido', 'cancelado', 'Cancelado'])
          .count({ total: '*' })
          .first();
        ticketsAbertos = Number(row?.total || 0);
      }
    } catch (_) {}

    return {
      ok: true,
      geradoEm: new Date().toISOString(),
      empresa: {
        id: cliente.id,
        razaoSocial: fullCliente?.razao_social || cliente.razao_social || '',
        nomeFantasia: fullCliente?.nome_fantasia || cliente.nome_fantasia || '',
        documento: fullCliente?.documento || cliente.documento || '',
        cidade: fullCliente?.cidade || null,
        estado: fullCliente?.estado || null,
      },
      licenca: {
        codigo: codigoLicenca,
        status: sicafStatus,
        dataValidade: sicaf?.data_validade || null,
        diasRestantes,
        credenciamentoAnual: !!sicaf?.credenciamento_anual,
      },
      manutencao: {
        ativa: !!atualizacoes.manutencaoAtiva || ['Ativo', 'ativo', 'Ativa', 'ativa'].includes(String(manutencao?.status || '')),
        status: manutencao?.status || null,
        diaVencimento: manutencao?.dia_vencimento || null,
      },
      atualizacoesSicaf: atualizacoes,
      acessos: {
        loginsTotal: logins.total,
        loginsSucesso: logins.sucessos,
        ultimoAcesso: logins.ultimo,
        ipsRecentes: logins.ipsRecentes,
      },
      licitacoes,
      usoPortal: {
        sicaf: acessosSicaf,
        assistente: acessosAssistente,
        relatorio: acessosRelatorio,
        documentos: documentosCount,
        ticketsAbertos,
      },
    };
  } catch (e) {
    console.error('[Relatorio] getRelatorio:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  gerarCodigoLicenca,
  registrarEvento,
  getRelatorio,
  extractIp,
  ensureUsoTable,
};
