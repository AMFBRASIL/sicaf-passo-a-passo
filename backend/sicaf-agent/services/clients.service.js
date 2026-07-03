/**
 * Serviço de Clientes — CRUD e busca inteligente.
 *
 * Regras de busca:
 *  - CPF/CNPJ → busca na tabela clientes (campo documento)
 *  - Email → busca na tabela usuarios, retorna clientes do usuario
 *  - Nome/Razão Social → busca na tabela clientes
 */
const { getDb } = require('../database/connection');
const contratosDigitaisService = require('../services/contratos-digitais.service');
const atualizacoesSicafService = require('../services/atualizacoes-sicaf.service');
const {
  calcDaysRemaining,
  resolveSicafDisplayStatus,
  isSicafDisplayValid,
  enrichSicafRow,
} = require('../utils/sicaf-status');
const { buildNiveisDetailFromRows } = require('../utils/nivel-status');
const { fixMojibake } = require('../utils/text-encoding');
const bcrypt = require('bcryptjs');

const CLIENT_TEXT_FIELDS = [
  'razao_social',
  'nome_fantasia',
  'cidade',
  'estado',
  'endereco',
  'bairro',
  'observacoes',
  'responsavel_nome',
  'ramo_atividade',
];

function fixClientRecordTexts(row) {
  if (!row || typeof row !== 'object') return row;
  for (const key of CLIENT_TEXT_FIELDS) {
    if (typeof row[key] === 'string') row[key] = fixMojibake(row[key]);
  }
  if (typeof row.nome === 'string') row.nome = fixMojibake(row.nome);
  return row;
}

function isSicafStatusActive(status) {
  return ['ativo', 'vencendo'].includes(String(status || '').trim().toLowerCase());
}

// ──────────────────────────────────────────────────────────────────────────
// Cache em memória para cidades distintas (usado pelo filtro da listagem).
// Recomputa apenas a cada 5 minutos ou quando explicitamente invalidado.
// Antes era recomputado a TODA chamada de listClients(), pesando até 200ms
// em bases médias e atrasando a busca por CNPJ.
// ──────────────────────────────────────────────────────────────────────────
const CITIES_CACHE_TTL_MS = 5 * 60 * 1000;
let _citiesCache = { value: null, expiresAt: 0 };

function invalidateCitiesCache() {
  _citiesCache = { value: null, expiresAt: 0 };
}

async function getCitiesCached(db) {
  const now = Date.now();
  if (_citiesCache.value && now < _citiesCache.expiresAt) return _citiesCache.value;
  try {
    const rows = await db('clientes')
      .whereNotNull('cidade')
      .where('cidade', '!=', '')
      .groupBy('cidade', 'estado')
      .select('cidade', 'estado');
    const list = rows.map((c) => `${c.cidade} - ${c.estado}`);
    _citiesCache = { value: list, expiresAt: now + CITIES_CACHE_TTL_MS };
    return list;
  } catch (_) {
    return _citiesCache.value || [];
  }
}

// Formata 14 dígitos em "12.345.678/0001-90"
function formatCnpjFromDigits(d) {
  if (!d || d.length !== 14) return null;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

// Formata 11 dígitos em "123.456.789-01"
function formatCpfFromDigits(d) {
  if (!d || d.length !== 11) return null;
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

const MANUTENCAO_ATIVA_LIST = ['Ativo', 'ativo', 'A Vencer', 'a vencer', 'Vencendo', 'vencendo'];
const TAXA_SICAF_PAGA_TS_WHERE =
  "(LOWER(TRIM(CAST(ts.status AS CHAR))) IN ('pago','paga','aprovado','aprovada') OR ts.status IN ('Pago','Paga','pago','paga','Aprovado','Aprovada','aprovado','aprovada'))";

/** Licença SICAF com validade futura — mesma regra de resolveFinancialReleased / isSicafLicencaVigente */
const SICAF_LICENCA_VIGENTE_SQL =
  '(s.id IS NOT NULL AND s.data_validade IS NOT NULL AND DATEDIFF(DATE(s.data_validade), CURDATE()) > 0)';
const NIVEL_APTO_SQL = `sn.habilitado = 1 AND (
  LOWER(CAST(sn.status AS CHAR)) LIKE '%valid%'
  OR LOWER(CAST(sn.status AS CHAR)) LIKE '%habilit%'
  OR LOWER(CAST(sn.status AS CHAR)) LIKE '%vencend%'
  OR LOWER(CAST(sn.status AS CHAR)) LIKE '%vencid%'
)`;

function applyAdminFiltro(query, db, filtro) {
  const f = String(filtro || 'todos');
  if (!f || f === 'todos' || f === 'sicaf_ok' || f === 'sicaf_pendente') return query;

  if (f === 'manutencao') {
    return query.whereExists(function () {
      this.select(db.raw('1'))
        .from('manutencoes as m')
        .whereRaw('m.cliente_id = c.id')
        .whereIn('m.status', MANUTENCAO_ATIVA_LIST);
    });
  }

  if (f === 'novo') {
    return query.where('c.created_at', '>=', db.raw('DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)'));
  }

  if (f === 'pagou') {
    return query.where(function () {
      this.whereExists(function () {
        this.select(db.raw('1'))
          .from('taxas_sicaf as ts')
          .whereRaw('ts.cliente_id = c.id')
          .whereRaw(TAXA_SICAF_PAGA_TS_WHERE);
      }).orWhereRaw(SICAF_LICENCA_VIGENTE_SQL);
    });
  }

  if (f === 'nao_pagou') {
    return query.where(function () {
      this.whereNotExists(function () {
        this.select(db.raw('1'))
          .from('taxas_sicaf as ts')
          .whereRaw('ts.cliente_id = c.id')
          .whereRaw(TAXA_SICAF_PAGA_TS_WHERE);
      }).whereRaw(`NOT (${SICAF_LICENCA_VIGENTE_SQL})`);
    });
  }

  if (f === 'apto') {
    return query.whereExists(function () {
      this.select(db.raw('1'))
        .from('sicaf_niveis as sn')
        .join('sicaf_cadastros as sc', 'sc.id', 'sn.sicaf_id')
        .whereRaw('sc.cliente_id = c.id')
        .whereRaw(NIVEL_APTO_SQL);
    });
  }

  if (f === 'inapto') {
    return query.whereNotExists(function () {
      this.select(db.raw('1'))
        .from('sicaf_niveis as sn')
        .join('sicaf_cadastros as sc', 'sc.id', 'sn.sicaf_id')
        .whereRaw('sc.cliente_id = c.id')
        .whereRaw(NIVEL_APTO_SQL);
    });
  }

  return query;
}

/**
 * Lista todos os clientes com dados agregados (SICAF, certidões, licitações).
 */
async function listClients({ search, status, sicaf, city, page = 1, limit = 50, usuarioIds, adminFiltro } = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    let query = db('clientes as c')
      .leftJoin('sicaf_cadastros as s', 'c.id', 's.cliente_id')
      .select(
        'c.id',
        'c.razao_social',
        'c.nome_fantasia',
        'c.tipo_documento',
        'c.documento',
        'c.email',
        'c.telefone',
        'c.cidade',
        'c.estado',
        'c.porte',
        'c.status',
        'c.usuario_id',
        'c.created_at',
        's.id as sicaf_id',
        's.status as sicaf_status',
        's.completude as sicaf_completude',
        's.data_validade as sicaf_validade',
        's.dias_validade as sicaf_dias_validade',
        's.manutencao_ativa as sicaf_manutencao'
      );

    // ── Filtro por usuários (portfólio completo de um login) ──
    if (usuarioIds && usuarioIds.length) {
      query = query.whereIn('c.usuario_id', usuarioIds);
    }

    // ── Busca inteligente ──
    if (search && search.trim() && !(usuarioIds && usuarioIds.length)) {
      const term = search.trim();
      const digitsOnly = term.replace(/\D/g, '');
      const isDocumento = digitsOnly.length >= 3 && /^[\d.\/\-\s]+$/.test(term);
      const isEmail = term.includes('@');

      if (isDocumento) {
        // Otimização crítica: ao buscar por CPF/CNPJ completo (11 ou 14 dígitos)
        // usamos comparação direta com whereIn — isso utiliza o índice da coluna
        // `documento` (criado via auto-migration), em vez de forçar full table scan
        // com REPLACE() / LIKE '%...%' que anula qualquer índice.
        if (digitsOnly.length === 14 || digitsOnly.length === 11) {
          const variants = new Set();
          variants.add(digitsOnly);
          variants.add(term);
          const cnpjFmt = formatCnpjFromDigits(digitsOnly);
          const cpfFmt = formatCpfFromDigits(digitsOnly);
          if (cnpjFmt) variants.add(cnpjFmt);
          if (cpfFmt) variants.add(cpfFmt);
          query = query.whereIn('c.documento', Array.from(variants));
        } else {
          // Busca parcial — última opção (mais lenta). Só LIKE simples; sem REPLACE
          // (REPLACE força full scan; preferimos LIKE com sufixo que ao menos
          // consegue varrer o índice em casos prefixados).
          const docClean = digitsOnly;
          query = query.where(function () {
            this.where('c.documento', 'like', `%${docClean}%`)
              .orWhere('c.documento', 'like', `%${term}%`);
          });
        }
      } else if (isEmail) {
        // Busca por email no usuario → retorna clientes desse usuario
        const usuarios = await db('usuarios')
          .where('email', 'like', `%${term}%`)
          .select('id');
        const userIds = usuarios.map((u) => u.id);

        if (userIds.length > 0) {
          query = query.whereIn('c.usuario_id', userIds);
        } else {
          // Fallback: buscar também pelo email do cliente
          query = query.where('c.email', 'like', `%${term}%`);
        }
      } else {
        // Busca por nome/razão social ou nome do usuário vinculado
        let userIdsByName = [];
        try {
          const usuarios = await db('usuarios')
            .where('nome', 'like', `%${term}%`)
            .select('id');
          userIdsByName = usuarios.map((u) => u.id);
        } catch (_) {}

        query = query.where(function () {
          this.where('c.razao_social', 'like', `%${term}%`)
            .orWhere('c.nome_fantasia', 'like', `%${term}%`)
            .orWhere('c.responsavel_nome', 'like', `%${term}%`);
          if (userIdsByName.length) {
            this.orWhereIn('c.usuario_id', userIdsByName);
          }
        });
      }
    }

    // ── Filtros ──
    if (status && status !== 'all') {
      query = query.where('c.status', status);
    }

    if (sicaf === 'ok') {
      query = query.whereNotNull('s.id').whereIn('s.status', ['Ativo', 'Vencendo']);
    } else if (sicaf === 'pending') {
      query = query.where(function () {
        this.whereNull('s.id')
          .orWhereIn('s.status', ['Pendente', 'Vencido']);
      });
    } else if (sicaf === 'cadastrado') {
      query = query.whereNotNull('s.id');
    }

    if (city && city !== 'all') {
      // city vem como "São Paulo - SP", separar
      const parts = city.split(' - ');
      if (parts.length === 2) {
        query = query.where('c.cidade', parts[0].trim()).where('c.estado', parts[1].trim());
      } else {
        query = query.where('c.cidade', 'like', `%${city}%`);
      }
    }

    query = applyAdminFiltro(query, db, adminFiltro);

    // Ordenar e paginar (mais recentes primeiro)
    let mainQuery = query.clone().orderBy('c.created_at', 'desc');
    if (limit > 0) {
      mainQuery = mainQuery.limit(limit).offset((page - 1) * limit);
    }

    // Otimização: count, stats e a query principal agora rodam em PARALELO.
    const [countRow, statsRow, rawRows] = await Promise.all([
      query.clone().clearSelect().clearOrder().countDistinct({ total: 'c.id' }).first(),
      query.clone().clearSelect().clearOrder().select(
        db.raw("COUNT(DISTINCT CASE WHEN c.status = 'Ativo' THEN c.id END) as ativos"),
        db.raw(`COUNT(DISTINCT CASE WHEN s.id IS NULL OR s.status IN ('Pendente', 'Vencido') THEN c.id END) as sicaf_pendentes`),
      ).first(),
      mainQuery,
    ]);
    const total = countRow?.total ?? countRow?.['count(distinct `c`.`id`)'] ?? 0;

    // LEFT JOIN sicaf pode duplicar linhas se houver >1 cadastro por cliente.
    const rowsById = new Map();
    for (const r of rawRows) {
      const prev = rowsById.get(r.id);
      if (!prev) {
        rowsById.set(r.id, r);
      } else if (!prev.sicaf_id && r.sicaf_id) {
        rowsById.set(r.id, r);
      }
    }
    const rows = Array.from(rowsById.values());

    const clientIds = rows.map((r) => r.id);
    const sicafIds = rows.filter((r) => r.sicaf_id).map((r) => r.sicaf_id);

    // Otimização: agregações de certidões, propostas e níveis SICAF em paralelo.
    const [certsRes, bidsRes, niveisRes] = await Promise.all([
      clientIds.length > 0
        ? db('certidoes')
            .whereIn('cliente_id', clientIds)
            .groupBy('cliente_id')
            .select('cliente_id', db.raw('COUNT(*) as total'))
            .catch(() => [])
        : Promise.resolve([]),
      clientIds.length > 0
        ? db('propostas')
            .whereIn('cliente_id', clientIds)
            .groupBy('cliente_id')
            .select('cliente_id', db.raw('COUNT(*) as total'))
            .catch(() => [])
        : Promise.resolve([]),
      sicafIds.length > 0
        ? db('sicaf_niveis')
            .whereIn('sicaf_id', sicafIds)
            .select('sicaf_id', 'nivel', 'habilitado', 'status')
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const certCounts = {};
    certsRes.forEach((c) => { certCounts[c.cliente_id] = c.total; });

    const bidCounts = {};
    bidsRes.forEach((b) => { bidCounts[b.cliente_id] = b.total; });

    const niveisMap = {};
    if (niveisRes.length > 0) {
      const sicafToClient = {};
      rows.forEach((r) => { if (r.sicaf_id) sicafToClient[r.sicaf_id] = r.id; });
      niveisRes.forEach((n) => {
        const cid = sicafToClient[n.sicaf_id];
        if (cid) {
          if (!niveisMap[cid]) niveisMap[cid] = {};
          niveisMap[cid][n.nivel] = { habilitado: n.habilitado === 1, status: n.status || null };
        }
      });
    }

    // Montar resultado
    const clients = rows.map((r) => {
      const hasSicaf = !!r.sicaf_id;
      const sicafStatusDisplay = hasSicaf
        ? resolveSicafDisplayStatus(r.sicaf_status, r.sicaf_validade, true)
        : null;
      const daysRaw = r.sicaf_validade ? calcDaysRemaining(r.sicaf_validade) : null;
      return {
      id: r.id,
      name: fixMojibake(r.razao_social),
      fantasyName: fixMojibake(r.nome_fantasia),
      tipoDocumento: r.tipo_documento,
      documento: r.documento,
      email: r.email || '',
      phone: r.telefone || '',
      city: fixMojibake(r.cidade && r.estado ? `${r.cidade} - ${r.estado}` : (r.cidade || '')),
      porte: r.porte,
      status: r.status,
      activeBids: bidCounts[r.id] || 0,
      certificates: certCounts[r.id] || 0,
      sicafId: r.sicaf_id || null,
      sicafValid: hasSicaf ? isSicafDisplayValid(r.sicaf_status, r.sicaf_validade, true) : false,
      sicafStatus: sicafStatusDisplay,
      sicafCompletude: r.sicaf_completude ? parseFloat(r.sicaf_completude) : 0,
      sicafValidade: r.sicaf_validade || null,
      sicafDiasValidade: daysRaw !== null ? Math.max(0, daysRaw) : (r.sicaf_dias_validade || null),
      sicafManutencao: r.sicaf_manutencao === 1 || r.sicaf_manutencao === true,
      sicafNiveis: niveisMap[r.id] || null,
      userId: r.usuario_id,
      createdAt: r.created_at,
    };
    });

    // Cidades únicas (para filtro). Cacheadas em memória — antes era recalculado a
    // CADA chamada da listagem, atrasando inclusive buscas restritas por CNPJ.
    const cityList = await getCitiesCached(db);

    return {
      ok: true,
      clients,
      total: parseInt(total, 10),
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
      cities: cityList,
      stats: {
        ativos: parseInt(statsRow?.ativos || 0, 10),
        sicafPendentes: parseInt(statsRow?.sicaf_pendentes || 0, 10),
      },
    };
  } catch (e) {
    console.error('[Clients] Erro listClients:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

/**
 * Busca um cliente por ID com todos os detalhes para o modal.
 */
async function getClientById(id) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const client = await db('clientes').where('id', id).first();
    if (!client) return { ok: false, error: 'Cliente não encontrado' };
    const usuarioPrincipal = client.usuario_id
      ? await db('usuarios')
          .where('id', client.usuario_id)
          .select('id', 'nome', 'email', 'telefone', 'status')
          .first()
      : null;

    // ── Contatos ──
    const contacts = await db('cliente_contatos').where('cliente_id', id).orderBy('principal', 'desc');

    // ── SICAF ──
    const sicafRaw = await db('sicaf_cadastros').where('cliente_id', id).first();
    const sicaf = enrichSicafRow(sicafRaw);

    // ── Certidões com tipo ──
    const certidoes = await db('certidoes as cert')
      .leftJoin('tipo_certidoes as tc', 'cert.tipo_certidao_id', 'tc.id')
      .where('cert.cliente_id', id)
      .select(
        'cert.id',
        'cert.numero',
        'cert.nivel_sicaf',
        'cert.data_emissao',
        'cert.data_validade',
        'cert.status',
        'cert.dias_restantes',
        'cert.auto_renovar',
        'cert.arquivo_url',
        'cert.arquivo_nome',
        'tc.id as tipo_id',
        'tc.nome as tipo_nome',
        'tc.codigo as tipo_codigo',
        'tc.orgao_emissor',
        'tc.nivel_sicaf as tipo_nivel_sicaf'
      )
      .orderBy('cert.nivel_sicaf', 'asc');

    // ── Propostas (licitações) ──
    let propostas = [];
    try {
      propostas = await db('propostas as p')
        .leftJoin('licitacoes as l', 'p.licitacao_id', 'l.id')
        .where('p.cliente_id', id)
        .select(
          'p.id',
          'p.numero_proposta',
          'p.tipo',
          'p.valor',
          'p.status',
          'p.progresso',
          'p.created_at',
          'l.numero_processo',
          'l.nome_orgao',
          'l.objeto_resumido',
          'l.modalidade'
        )
        .orderBy('p.created_at', 'desc');
    } catch (_) {
      // Tabela propostas pode não existir
    }

    // ── Documentos ──
    let documentos = [];
    try {
      documentos = await db('documentos')
        .where('cliente_id', id)
        .orderBy('data_upload', 'desc');
    } catch (_) {
      // Tabela documentos pode não existir
    }

    // ── Histórico (audit_log + historico_acoes) ──
    let historico = [];
    try {
      const auditRows = await db('audit_log as a')
        .leftJoin('usuarios as u', 'a.usuario_id', 'u.id')
        .where(function () {
          this.where('a.entidade', 'clientes').where('a.entidade_id', id);
        })
        .orWhere(function () {
          this.where('a.entidade', 'certidoes').whereIn('a.entidade_id',
            db('certidoes').where('cliente_id', id).select('id')
          );
        })
        .orWhere(function () {
          this.where('a.entidade', 'sicaf_cadastros').whereIn('a.entidade_id',
            db('sicaf_cadastros').where('cliente_id', id).select('id')
          );
        })
        .orWhere(function () {
          this.where('a.entidade', 'sicaf_renovacoes').whereIn('a.entidade_id',
            db('sicaf_renovacoes').where('cliente_id', id).select('id')
          );
        })
        .orWhere(function () {
          this.where('a.entidade', 'taxas_sicaf').whereIn('a.entidade_id',
            db('taxas_sicaf').where('cliente_id', id).select('id')
          );
        })
        .orWhere(function () {
          this.where('a.entidade', 'pagamentos_gerencianet').whereIn('a.entidade_id',
            db('pagamentos_gerencianet').where('cliente_id', id).select('id')
          );
        })
        .select(
          'a.id',
          'a.acao',
          'a.entidade',
          'a.created_at',
          'u.nome as usuario_nome'
        )
        .orderBy('a.created_at', 'desc')
        .limit(30);

      let acaoRows = [];
      try {
        acaoRows = await db('historico_acoes as h')
          .leftJoin('usuarios as u', 'h.usuario_id', 'u.id')
          .where('h.cliente_id', id)
          .select(
            'h.id',
            'h.acao',
            'h.entidade',
            'h.created_at',
            'u.nome as usuario_nome'
          )
          .orderBy('h.created_at', 'desc')
          .limit(30);
      } catch (_) {}

      historico = [...auditRows, ...acaoRows]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50);
    } catch (_) {
      // Tabelas podem não existir
    }

    // ── Renovações SICAF ──
    let renovacoes = [];
    if (sicaf) {
      try {
        renovacoes = await db('sicaf_renovacoes')
          .where('sicaf_id', sicaf.id)
          .orderBy('created_at', 'desc');
      } catch (_) {}
    }

    // ── Taxas SICAF ──
    let taxas = [];
    try {
      taxas = await db('taxas_sicaf')
        .where('cliente_id', id)
        .orderBy('created_at', 'desc');
    } catch (_) {}

    // ── Buscar níveis habilitados no sicaf_niveis (validados pelo assistente) ──
    let sicafNiveisDb = [];
    if (sicaf) {
      try {
        sicafNiveisDb = await db('sicaf_niveis')
          .where('sicaf_id', sicaf.id)
          .select('nivel', 'habilitado', 'status', 'observacao');
      } catch (_) {}
    }

    // ── Montar Níveis SICAF a partir das certidões + níveis do banco ──
    const niveisSicaf = buildNiveisSicaf(certidoes, sicaf, sicafNiveisDb);

    // ── Histórico de acessos (login_logs) ──
    let loginLogs = [];
    if (client.usuario_id) {
      try {
        const hasTable = await db.schema.hasTable('login_logs');
        if (hasTable) {
          loginLogs = await db('login_logs')
            .where('usuario_id', client.usuario_id)
            .orderBy('created_at', 'desc')
            .limit(20)
            .select('id', 'ip', 'dispositivo', 'navegador', 'plataforma', 'created_at');
        }
      } catch (_) {}
    }

    fixClientRecordTexts(client);
    if (usuarioPrincipal) fixClientRecordTexts(usuarioPrincipal);

    return {
      ok: true,
      client: {
        id: client.id,
        razao_social: client.razao_social,
        nome_fantasia: client.nome_fantasia,
        tipo_documento: client.tipo_documento,
        documento: client.documento,
        email: client.email,
        telefone: client.telefone,
        celular: client.celular,
        endereco: client.endereco,
        cidade: client.cidade,
        estado: client.estado,
        cep: client.cep,
        porte: client.porte,
        ramo_atividade: client.ramo_atividade,
        responsavel_nome: client.responsavel_nome,
        responsavel_cpf: client.responsavel_cpf,
        responsavel_email: client.responsavel_email,
        responsavel_telefone: client.responsavel_telefone,
        status: client.status,
        observacoes: client.observacoes,
        created_at: client.created_at,
        updated_at: client.updated_at,
        usuario_principal: usuarioPrincipal
          ? {
              id: usuarioPrincipal.id,
              nome: usuarioPrincipal.nome || '',
              email: usuarioPrincipal.email || '',
              telefone: usuarioPrincipal.telefone || '',
              status: usuarioPrincipal.status || '',
            }
          : null,
        contacts,
        sicaf: sicaf || null,
        certidoes,
        propostas,
        documentos,
        historico,
        niveisSicaf,
        niveisDetail: buildNiveisDetailFromRows(sicafNiveisDb),
        renovacoes,
        taxas,
        loginLogs,
      },
    };
  } catch (e) {
    console.error('[Clients] Erro getClientById:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

const SICAF_DOCS_BY_LEVEL = {
  I: ['contrato_social', 'documento_identidade'],
  II: ['estatuto_consolidado', 'certidao_junta_comercial'],
  III: ['cnd_federal', 'crf_fgts', 'cndt_trabalhista'],
  IV: ['inscricao_municipal', 'inscricao_estadual', 'cnd_estadual', 'cnd_municipal'],
  V: ['atestado_tecnico'],
  VI: ['balanco_patrimonial'],
};

const SICAF_TIPO_DEFAULTS = {
  contrato_social: { nome: 'Contrato Social / Ato Constitutivo', descricao: 'Ato constitutivo ou contrato social', nivel_sicaf: 'I', orgao_emissor: 'Junta Comercial / Cartório' },
  documento_identidade: { nome: 'Documento de Identidade do Representante', descricao: 'RG ou documento equivalente do representante legal', nivel_sicaf: 'I', orgao_emissor: 'Órgão emissor' },
  estatuto_consolidado: { nome: 'Estatuto / Contrato Social Consolidado', descricao: 'Estatuto ou contrato social consolidado', nivel_sicaf: 'II', orgao_emissor: 'Junta Comercial' },
  certidao_junta_comercial: { nome: 'Certidão Simplificada da Junta Comercial', descricao: 'Certidão simplificada da Junta Comercial', nivel_sicaf: 'II', orgao_emissor: 'Junta Comercial' },
  cnd_federal: { nome: 'CND Federal', descricao: 'Certidão Negativa de Débitos Federais', nivel_sicaf: 'III', orgao_emissor: 'Receita Federal' },
  crf_fgts: { nome: 'Certificado de Regularidade FGTS (CRF)', descricao: 'Certificado de Regularidade do FGTS', nivel_sicaf: 'III', orgao_emissor: 'Caixa Econômica Federal' },
  cndt_trabalhista: { nome: 'CNDT Trabalhista', descricao: 'Certidão Negativa de Débitos Trabalhistas', nivel_sicaf: 'III', orgao_emissor: 'Tribunal Superior do Trabalho' },
  inscricao_municipal: { nome: 'Inscrição Municipal', descricao: 'Comprovante de inscrição municipal (ISS)', nivel_sicaf: 'IV', orgao_emissor: 'Prefeitura Municipal' },
  inscricao_estadual: { nome: 'Inscrição Estadual', descricao: 'Comprovante de inscrição estadual (ICMS)', nivel_sicaf: 'IV', orgao_emissor: 'Secretaria da Fazenda Estadual' },
  cnd_estadual: { nome: 'Certidão Negativa Estadual', descricao: 'CND Estadual (ICMS)', nivel_sicaf: 'IV', orgao_emissor: 'Secretaria da Fazenda Estadual' },
  cnd_municipal: { nome: 'Certidão Negativa Municipal', descricao: 'CND Municipal (ISS)', nivel_sicaf: 'IV', orgao_emissor: 'Prefeitura Municipal' },
  atestado_tecnico: { nome: 'Atestado de Qualificação Técnica', descricao: 'Atestado de capacidade técnica', nivel_sicaf: 'V', orgao_emissor: 'Contratante / Órgão emissor' },
  balanco_patrimonial: { nome: 'Balanço Patrimonial', descricao: 'Balanço patrimonial da empresa', nivel_sicaf: 'VI', orgao_emissor: 'Contabilidade / Empresa' },
};

/**
 * Garante que todos os tipos de documento usados no modal SICAF existam em tipo_certidoes.
 * Inscrição Municipal/Estadual (nível IV) não existiam por padrão — sem elas o botão fica "Indisponível".
 */
async function ensureSicafTipoCertidoes() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco não disponível' };

  let inserted = 0;
  let updated = 0;

  for (const codigo of Object.keys(SICAF_TIPO_DEFAULTS)) {
    const meta = SICAF_TIPO_DEFAULTS[codigo];
    const existing = await db('tipo_certidoes').where('codigo', codigo).first();

    if (!existing) {
      await db('tipo_certidoes').insert({
        codigo,
        nome: meta.nome,
        descricao: meta.descricao,
        nivel_sicaf: meta.nivel_sicaf,
        orgao_emissor: meta.orgao_emissor,
        ativo: 1,
      });
      inserted += 1;
      continue;
    }

    const patch = {};
    if (existing.nivel_sicaf !== meta.nivel_sicaf) patch.nivel_sicaf = meta.nivel_sicaf;
    if (existing.ativo !== 1) patch.ativo = 1;

    if (Object.keys(patch).length > 0) {
      patch.updated_at = db.fn.now();
      await db('tipo_certidoes').where('id', existing.id).update(patch);
      updated += 1;
    }
  }

  if (inserted > 0 || updated > 0) {
    console.log(`  [Migration] tipo_certidoes SICAF: ${inserted} inserido(s), ${updated} atualizado(s).`);
  }

  return { ok: true, inserted, updated };
}

function buildCertidaoItemFromTipo(tipo, cert, now) {
  let status = 'missing';
  let dataValidade = null;
  let dataEmissao = null;
  let diasRestantes = null;

  if (cert) {
    dataEmissao = cert.data_emissao;
    dataValidade = cert.data_validade;

    if (cert.data_validade) {
      const validade = new Date(cert.data_validade);
      const diffMs = validade.getTime() - now.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diasRestantes < 0) status = 'expired';
      else if (diasRestantes <= 30) status = 'expiring';
      else status = 'valid';
    } else {
      status = 'valid';
      diasRestantes = null;
    }
  }

  const uploadRules = resolveTipoUploadRules(tipo);

  return {
    tipoId: tipo.id,
    codigo: tipo.codigo,
    nome: tipo.nome,
    descricao: tipo.descricao,
    nivelSicaf: tipo.nivel_sicaf,
    orgaoEmissor: tipo.orgao_emissor,
    requerCodigo: uploadRules.requerCodigo,
    requerValidade: uploadRules.requerValidade,
    uploadManual: uploadRules.uploadManual,
    certidaoId: cert ? cert.id : null,
    status,
    dataEmissao,
    dataValidade,
    diasRestantes,
    numero: cert ? cert.numero : null,
    arquivoUrl: cert ? cert.arquivo_url : null,
    arquivoNome: cert ? cert.arquivo_nome : null,
    arquivoTamanho: cert ? cert.arquivo_tamanho : null,
    autoRenovar: cert ? cert.auto_renovar : 0,
  };
}

function getDocUploadRules(codigo, nivel) {
  if (nivel === 'III') {
    return { requerCodigo: false, requerValidade: false, uploadManual: false };
  }
  if (['inscricao_municipal', 'inscricao_estadual'].includes(codigo)) {
    return { requerCodigo: true, requerValidade: false, uploadManual: true };
  }
  if (['cnd_municipal', 'cnd_estadual'].includes(codigo)) {
    return { requerCodigo: true, requerValidade: true, uploadManual: true };
  }
  return { requerCodigo: false, requerValidade: false, uploadManual: true };
}

function resolveTipoUploadRules(tipo) {
  const fromDb = {
    requerCodigo: tipo.requer_codigo != null ? !!tipo.requer_codigo : null,
    requerValidade: tipo.requer_validade != null ? !!tipo.requer_validade : null,
    uploadManual: tipo.upload_manual != null ? !!tipo.upload_manual : null,
  };
  const computed = getDocUploadRules(tipo.codigo, tipo.nivel_sicaf);
  return {
    requerCodigo: fromDb.requerCodigo ?? computed.requerCodigo,
    requerValidade: fromDb.requerValidade ?? computed.requerValidade,
    uploadManual: fromDb.uploadManual ?? computed.uploadManual,
  };
}

/**
 * Constrói os 6 níveis SICAF a partir das certidões do cliente e dos níveis validados no banco.
 * @param {Array} certidoes - Certidões do cliente
 * @param {Object|null} sicaf - Dados do sicaf_cadastros
 * @param {Array} sicafNiveisDb - Registros de sicaf_niveis (nivel, habilitado, status, observacao)
 */
function buildNiveisSicaf(certidoes, sicaf, sicafNiveisDb = []) {
  const niveis = [
    { level: 'I', name: 'Credenciamento', codigos: SICAF_DOCS_BY_LEVEL.I },
    { level: 'II', name: 'Habilitação Jurídica', codigos: SICAF_DOCS_BY_LEVEL.II },
    { level: 'III', name: 'Regularidade Fiscal Federal', codigos: SICAF_DOCS_BY_LEVEL.III },
    { level: 'IV', name: 'Regularidade Fiscal Estadual/Municipal', codigos: SICAF_DOCS_BY_LEVEL.IV },
    { level: 'V', name: 'Qualificação Técnica', codigos: SICAF_DOCS_BY_LEVEL.V },
    { level: 'VI', name: 'Qualificação Econômico-Financeira', codigos: SICAF_DOCS_BY_LEVEL.VI },
  ];

  const niveisDbMap = {};
  for (const row of sicafNiveisDb) {
    niveisDbMap[row.nivel] = row;
  }

  const hasSicaf = !!sicaf;
  const hasAltoNivelHabilitado = ['III', 'IV', 'V', 'VI'].some(
    (lev) => niveisDbMap[lev] && niveisDbMap[lev].habilitado === 1,
  );
  const isBaseLevel = (level) => level === 'I' || level === 'II';
  const isEnabledOnlyLevel = (level) => ['I', 'II', 'V', 'VI'].includes(level);

  return niveis.map((nivel) => {
    const certDoNivel = certidoes.filter(
      (c) => c.nivel_sicaf === nivel.level || nivel.codigos.includes(c.tipo_codigo)
    );

    const dbNivel = niveisDbMap[nivel.level];
    const habilitadoNoBanco = dbNivel && dbNivel.habilitado === 1;

    // Se há certidões, determinar status por elas
    if (certDoNivel.length > 0) {
      const comValidade = certDoNivel.filter((c) => c.data_validade);
      let expiry = null;
      let status = 'Válido';

      if (comValidade.length > 0) {
        comValidade.sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
        expiry = comValidade[0].data_validade;

        const hasVencida = certDoNivel.some((c) => c.status === 'Vencida');
        const hasVencendo = certDoNivel.some((c) => c.status === 'Vencendo');

        if (hasVencida) status = 'Vencido';
        else if (hasVencendo) status = 'A Vencer';
      } else {
        const hasVencida = certDoNivel.some((c) => c.status === 'Vencida');
        if (hasVencida) status = 'Vencido';
      }

      return { level: nivel.level, name: nivel.name, status, expiry, certCount: certDoNivel.length };
    }

    // Níveis I e II: só como "Válido" por pré-requisito SICAF quando há nível III–VI habilitado
    // (Situação do Fornecedor) e existe cadastro SICAF.
    if (isBaseLevel(nivel.level) && hasSicaf && hasAltoNivelHabilitado) {
      const expiry = nivel.level === 'I' && sicaf.data_validade ? sicaf.data_validade : null;
      return { level: nivel.level, name: nivel.name, status: 'Habilitado', expiry, certCount: 0 };
    }

    // Sem certidões, mas habilitado no sicaf_niveis (validado pelo assistente)
    if (habilitadoNoBanco) {
      if (isEnabledOnlyLevel(nivel.level)) {
        return { level: nivel.level, name: nivel.name, status: 'Habilitado', expiry: null, certCount: 0 };
      }

      let status = 'Válido';
      const dbStatus = (dbNivel.status || '').toLowerCase();
      if (dbStatus.includes('pendente') || dbStatus.includes('irregular')) status = 'Pendente';
      else if (dbStatus.includes('vencido') || dbStatus.includes('expirad')) status = 'Vencido';
      else if (dbStatus.includes('vencendo')) status = 'A Vencer';

      return { level: nivel.level, name: nivel.name, status, expiry: null, certCount: 0 };
    }

    // Sem certidões e não habilitado
    return { level: nivel.level, name: nivel.name, status: 'Pendente', expiry: null, certCount: 0 };
  });
}

/**
 * Retorna todos os tipo_certidoes, cruzando com as certidões reais do cliente.
 * Para cada tipo, informa se o cliente tem o documento, validade e status.
 * @param {number} clienteId - ID do cliente
 */
async function getCertidoesStatus(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    await ensureSicafTipoCertidoes();

    // Buscar cliente
    const cliente = await db('clientes').where('id', clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    // Buscar SICAF do cliente
    const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();

    // Buscar todos os tipos de certidões ativos
    const tipos = await db('tipo_certidoes')
      .where('ativo', 1)
      .orderBy('nivel_sicaf', 'asc')
      .orderBy('nome', 'asc');

    // Buscar certidões reais do cliente
    const certidoes = await db('certidoes')
      .where('cliente_id', clienteId);

    // Mapear certidões por tipo_certidao_id (pegar a mais recente de cada tipo)
    const certByTipo = {};
    for (const cert of certidoes) {
      const existing = certByTipo[cert.tipo_certidao_id];
      if (!existing || new Date(cert.data_emissao) > new Date(existing.data_emissao)) {
        certByTipo[cert.tipo_certidao_id] = cert;
      }
    }

    const now = new Date();

    const tipoByCodigo = {};
    for (const tipo of tipos) tipoByCodigo[tipo.codigo] = tipo;

    const items = [];
    for (const [nivel, codigos] of Object.entries(SICAF_DOCS_BY_LEVEL)) {
      for (const codigo of codigos) {
        const tipo = tipoByCodigo[codigo];
        if (!tipo) continue;
        const cert = certByTipo[tipo.id] || null;
        items.push(buildCertidaoItemFromTipo(tipo, cert, now));
      }
    }

    // Estatísticas
    const total = items.length;
    const validos = items.filter(i => i.status === 'valid').length;
    const vencendo = items.filter(i => i.status === 'expiring').length;
    const vencidos = items.filter(i => i.status === 'expired').length;
    const naoInformados = items.filter(i => i.status === 'missing').length;

    // Agrupar por nível
    const porNivel = {};
    for (const item of items) {
      const nivel = item.nivelSicaf || 'Geral';
      if (!porNivel[nivel]) porNivel[nivel] = [];
      porNivel[nivel].push(item);
    }

    return {
      ok: true,
      cliente: {
        id: cliente.id,
        razaoSocial: cliente.razao_social,
        tipoDocumento: cliente.tipo_documento,
        documento: cliente.documento,
      },
      sicaf: sicaf ? {
        status: sicaf.status,
        completude: parseFloat(sicaf.completude),
        dataValidade: sicaf.data_validade,
      } : null,
      stats: { total, validos, vencendo, vencidos, naoInformados },
      items,
      porNivel,
    };
  } catch (e) {
    console.error('[Clients] Erro getCertidoesStatus:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

/**
 * Retorna todos os tipo_certidoes ativos, agrupados por nível SICAF.
 */
async function getTipoCertidoes() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    await ensureSicafTipoCertidoes();

    const tipos = await db('tipo_certidoes')
      .where('ativo', 1)
      .orderBy('nivel_sicaf', 'asc')
      .orderBy('nome', 'asc');

    // Agrupar por nível
    const porNivel = {};
    for (const tipo of tipos) {
      const nivel = tipo.nivel_sicaf || 'Geral';
      if (!porNivel[nivel]) porNivel[nivel] = [];
      const uploadRules = resolveTipoUploadRules(tipo);
      porNivel[nivel].push({
        id: tipo.id,
        codigo: tipo.codigo,
        nome: tipo.nome,
        descricao: tipo.descricao,
        nivelSicaf: tipo.nivel_sicaf,
        orgaoEmissor: tipo.orgao_emissor,
        requerCodigo: uploadRules.requerCodigo,
        requerValidade: uploadRules.requerValidade,
        uploadManual: uploadRules.uploadManual,
        hasExpiry: uploadRules.requerValidade,
      });
    }

    return { ok: true, tipos, porNivel };
  } catch (e) {
    console.error('[Clients] Erro getTipoCertidoes:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

/**
 * Insere ou atualiza uma certidão para um cliente.
 */
async function insertCertidao({ clienteId, tipoCertidaoId, numero, dataEmissao, dataValidade, arquivoUrl, arquivoNome, arquivoTamanho }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    // Validar cliente
    const cliente = await db('clientes').where('id', clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    // Validar tipo
    const tipo = await db('tipo_certidoes').where('id', tipoCertidaoId).first();
    if (!tipo) return { ok: false, error: 'Tipo de certidão não encontrado' };

    const uploadRules = resolveTipoUploadRules(tipo);
    if (!uploadRules.uploadManual) {
      return {
        ok: false,
        error: 'Este documento é atualizado automaticamente pelo Assistente SICAF. Não é necessário envio manual.',
      };
    }
    if (uploadRules.requerCodigo && !String(numero || '').trim()) {
      return { ok: false, error: 'Informe o código da certidão' };
    }
    if (uploadRules.requerValidade && !dataValidade) {
      return { ok: false, error: 'Informe a data de validade da certidão' };
    }
    if (!arquivoUrl) {
      return { ok: false, error: 'Envie o PDF da certidão' };
    }

    // Buscar SICAF do cliente (opcional)
    const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
    const contadorAtualizacoesAtivo = sicaf
      ? await atualizacoesSicafService.hasPaidActiveAnnualSicaf(db, sicaf, clienteId)
      : false;

    // Calcular status e dias restantes
    let status = 'Válida';
    let diasRestantes = 0;
    if (dataValidade) {
      const now = new Date();
      const validade = new Date(dataValidade);
      const diffMs = validade.getTime() - now.getTime();
      diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diasRestantes < 0) {
        status = 'Vencida';
      } else if (diasRestantes <= 30) {
        status = 'Vencendo';
      }
    }

    // Verificar se já existe uma certidão deste tipo para o cliente
    const existente = await db('certidoes')
      .where('cliente_id', clienteId)
      .where('tipo_certidao_id', tipoCertidaoId)
      .first();

    // Bloqueia upload manual apenas se a cota gratuita (Situação do Fornecedor no assistente) estiver esgotada.
    let atualizacaoInfo = null;
    if (sicaf && contadorAtualizacoesAtivo && !sicaf.manutencao_ativa) {
      try {
        const manutencao = await db('manutencoes').where('cliente_id', clienteId).where('status', 'Ativo').first();
        const manutencaoAtiva = !!(sicaf.manutencao_ativa || manutencao);
        const atualizacoes = await atualizacoesSicafService.buildAtualizacoesStatus(db, clienteId, {
          contadorAtivo: true,
          manutencaoAtiva,
          resetEm: sicaf.atualizacoes_reset_em,
          semSicaf: false,
        });

        if (atualizacoes.bloqueado) {
          return {
            ok: false,
            code: 'LIMITE_ATUALIZACOES',
            error: `Limite de ${atualizacoes.limite} atualizações gratuitas atingido (Situação do Fornecedor no Assistente). Contrate o plano de Manutenção SICAF para continuar incluindo documentos.`,
            atualizacoes,
          };
        }

        atualizacaoInfo = atualizacoes;
      } catch (e) {
        console.error('[Certidoes] Erro verificar limite atualizações:', e.message);
      }
    }

    let certidaoId;

    if (existente) {
      await db('certidoes').where('id', existente.id).update({
        numero: numero || existente.numero,
        nivel_sicaf: tipo.nivel_sicaf || existente.nivel_sicaf,
        data_emissao: dataEmissao || new Date().toISOString().slice(0, 10),
        data_validade: dataValidade || null,
        status,
        dias_restantes: diasRestantes,
        arquivo_url: arquivoUrl || existente.arquivo_url,
        arquivo_nome: arquivoNome || existente.arquivo_nome,
        arquivo_tamanho: arquivoTamanho || existente.arquivo_tamanho,
        updated_at: db.fn.now(),
      });
      certidaoId = existente.id;
    } else {
      const [id] = await db('certidoes').insert({
        cliente_id: clienteId,
        sicaf_id: sicaf ? sicaf.id : null,
        tipo_certidao_id: tipoCertidaoId,
        numero: numero || null,
        nivel_sicaf: tipo.nivel_sicaf || null,
        data_emissao: dataEmissao || new Date().toISOString().slice(0, 10),
        data_validade: dataValidade || null,
        status,
        dias_restantes: diasRestantes,
        auto_renovar: 0,
        arquivo_url: arquivoUrl || null,
        arquivo_nome: arquivoNome || null,
        arquivo_tamanho: arquivoTamanho || null,
      });
      certidaoId = id;
    }

    return {
      ok: true,
      certidaoId,
      updated: !!existente,
      message: existente ? 'Certidão atualizada com sucesso' : 'Certidão inserida com sucesso',
      atualizacoes: atualizacaoInfo,
    };
  } catch (e) {
    console.error('[Clients] Erro insertCertidao:', e.message, e.stack);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

/**
 * Cadastra um novo cliente + sicaf_cadastros (Pendente) + nível I.
 * @param {Object} data - Dados do cliente
 * @param {number} usuarioId - ID do usuário logado
 * @returns {Promise<Object>}
 */
async function createClient(data, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    if (!data.documento) return { ok: false, error: 'CPF/CNPJ é obrigatório' };
    if (!data.razaoSocial) return { ok: false, error: 'Razão Social é obrigatória' };

    const docClean = data.documento.replace(/\D/g, '');
    const tipoDoc = docClean.length <= 11 ? 'CPF' : 'CNPJ';

    // Verificar se já existe
    const existing = await db('clientes')
      .whereRaw("REPLACE(REPLACE(REPLACE(documento, '.', ''), '/', ''), '-', '') = ?", [docClean])
      .first();
    if (existing) {
      return { ok: false, error: 'Já existe um cliente cadastrado com este CPF/CNPJ.' };
    }

    // Montar endereço completo (tabela tem campo único "endereco")
    const endParts = [data.endereco];
    if (data.numero) endParts.push(data.numero);
    if (data.complemento) endParts.push(data.complemento);
    if (data.bairro) endParts.push(data.bairro);
    const enderecoFull = endParts.filter(Boolean).join(', ') || null;

    // Validar porte (enum: MEI, ME, EPP, Média, Grande)
    const portesValidos = ['MEI', 'ME', 'EPP', 'Média', 'Grande'];
    const porteVal = portesValidos.includes(data.porte) ? data.porte : 'ME';

    // Inserir cliente
    const [clienteId] = await db('clientes').insert({
      usuario_id: usuarioId,
      tipo_documento: tipoDoc,
      documento: data.documento,
      razao_social: data.razaoSocial,
      nome_fantasia: data.nomeFantasia || null,
      inscricao_estadual: data.inscricaoEstadual || null,
      inscricao_municipal: data.inscricaoMunicipal || null,
      email: data.email || null,
      telefone: data.telefone || null,
      celular: data.celular || null,
      endereco: enderecoFull,
      cidade: data.cidade || null,
      estado: data.estado ? data.estado.slice(0, 2).toUpperCase() : null,
      cep: data.cep ? data.cep.replace(/\D/g, '') : null,
      porte: porteVal,
      ramo_atividade: data.ramoAtividade || null,
      responsavel_nome: data.responsavelNome || null,
      responsavel_cpf: data.responsavelCpf || null,
      responsavel_email: data.responsavelEmail || null,
      responsavel_telefone: data.responsavelTelefone || null,
      status: 'Ativo',
      observacoes: data.observacoes || null,
    });

    // Promover o criador da empresa a admin do sistema (dono da empresa).
    // Mantém colaboradores intactos. Idempotente.
    try {
      await db('usuarios')
        .where({ id: usuarioId })
        .andWhereNot('tipo_usuario', 'colaborador')
        .update({ tipo_usuario: 'admin' });
    } catch (_) {
      // coluna pode não existir em ambientes pré-migration
    }

    // Criar sicaf_cadastros (Pendente)
    const [sicafId] = await db('sicaf_cadastros').insert({
      cliente_id: clienteId,
      status: 'Pendente',
      data_ultima_atualizacao: db.fn.now(),
      completude: 0,
      credenciamento_anual: 0,
      manutencao_ativa: 0,
      dias_validade: 0,
    });

    // Criar nível I padrão
    await db('sicaf_niveis').insert({ sicaf_id: sicafId, nivel: 'I', habilitado: 0 });

    // Se responsável informado, criar contato principal
    if (data.responsavelNome) {
      await db('cliente_contatos').insert({
        cliente_id: clienteId,
        nome: data.responsavelNome,
        cargo: 'Responsável Legal',
        email: data.responsavelEmail || data.email || null,
        telefone: data.responsavelTelefone || data.telefone || null,
        principal: 1,
      });
    }

    // Criar contrato digital automaticamente (Licença + Manutenção, 1 ano)
    let contratoId = null;
    try {
      const contratoResult = await contratosDigitaisService.criarContrato({
        clienteId,
        plano: 'Licença + Manutenção',
      });
      if (contratoResult.ok) {
        contratoId = contratoResult.contratoId;
        console.log(`[Clients] Contrato digital #${contratoId} criado automaticamente para cliente ${clienteId}`);
      } else {
        console.warn(`[Clients] Aviso ao criar contrato digital: ${contratoResult.error}`);
      }
    } catch (contratoErr) {
      console.error('[Clients] Erro ao criar contrato digital (não bloqueante):', contratoErr.message);
    }

    console.log(`[Clients] Novo cliente cadastrado: id=${clienteId}, SICAF id=${sicafId}, contrato=${contratoId}, doc=${data.documento}`);

    return {
      ok: true,
      clienteId,
      sicafId,
      contratoId,
      message: 'Empresa cadastrada com sucesso!',
    };
  } catch (e) {
    console.error('[Clients] Erro createClient:', e.message);
    if (e.code === 'ER_DUP_ENTRY') {
      return { ok: false, error: 'Já existe um cliente cadastrado com este CPF/CNPJ.' };
    }
    return { ok: false, error: 'Erro interno no servidor: ' + e.message };
  }
}

/**
 * Consulta cliente por CNPJ com status de cadastro, SICAF/renovação e manutenção.
 * Retorna também dados completos do cliente quando encontrado.
 */
async function consultClientByCnpj(cnpj) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cnpjDigits = String(cnpj || '').replace(/\D/g, '');
  if (cnpjDigits.length !== 14) {
    return { ok: false, error: 'CNPJ inválido. Informe 14 dígitos.' };
  }

  try {
    const row = await db('clientes as c')
      .leftJoin('sicaf_cadastros as s', 'c.id', 's.cliente_id')
      .whereRaw("REPLACE(REPLACE(REPLACE(c.documento, '.', ''), '/', ''), '-', '') = ?", [cnpjDigits])
      .select(
        'c.*',
        's.id as sicaf_id',
        's.status as sicaf_status',
        's.data_validade as sicaf_data_validade',
        's.dias_validade as sicaf_dias_validade',
        's.manutencao_ativa as sicaf_manutencao_ativa',
        's.completude as sicaf_completude'
      )
      .orderBy('c.id', 'desc')
      .first();

    if (!row) {
      return {
        ok: true,
        cnpj: cnpjDigits,
        possuiCadastro: false,
        cadastroValido: false,
        sicafValido: false,
        possuiRenovacao: false,
        possuiManutencao: false,
        razaoSocial: null,
        cliente: null,
        sicaf: null,
        renovacao: null,
        manutencao: null,
        message: 'CNPJ não encontrado na base de clientes.',
      };
    }

    let ultimaRenovacao = null;
    if (row.sicaf_id) {
      ultimaRenovacao = await db('sicaf_renovacoes')
        .where('sicaf_id', row.sicaf_id)
        .where('cliente_id', row.id)
        .orderBy('id', 'desc')
        .first();
    }

    const manutencaoAtual = await db('manutencoes')
      .where('cliente_id', row.id)
      .orderBy('created_at', 'desc')
      .first();

    const sicafValido = !!row.sicaf_id && isSicafDisplayValid(row.sicaf_status, row.sicaf_data_validade, true);
    const renovacaoStatus = String(ultimaRenovacao?.status || '').toLowerCase();
    const possuiRenovacao = !!ultimaRenovacao && ['concluida', 'concluída', 'aprovada', 'paga', 'confirmada'].includes(renovacaoStatus);
    const cadastroValido = sicafValido || possuiRenovacao;

    const manutStatus = String(manutencaoAtual?.status || '').toLowerCase();
    const manutencaoAtivaPorStatus = ['ativo', 'a vencer', 'vencendo'].includes(manutStatus);
    const possuiManutencao = (row.sicaf_manutencao_ativa === 1 || row.sicaf_manutencao_ativa === true) || manutencaoAtivaPorStatus;

    return {
      ok: true,
      cnpj: cnpjDigits,
      possuiCadastro: true,
      cadastroValido,
      sicafValido,
      possuiRenovacao,
      possuiManutencao,
      razaoSocial: row.razao_social || null,
      cliente: {
        id: row.id,
        razaoSocial: row.razao_social || null,
        nomeFantasia: row.nome_fantasia || null,
        tipoDocumento: row.tipo_documento || null,
        documento: row.documento || null,
        email: row.email || null,
        telefone: row.telefone || null,
        celular: row.celular || null,
        endereco: row.endereco || null,
        cidade: row.cidade || null,
        estado: row.estado || null,
        cep: row.cep || null,
        porte: row.porte || null,
        ramoAtividade: row.ramo_atividade || null,
        status: row.status || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      },
      sicaf: row.sicaf_id ? {
        id: row.sicaf_id,
        status: resolveSicafDisplayStatus(row.sicaf_status, row.sicaf_data_validade, true),
        valido: sicafValido,
        dataValidade: row.sicaf_data_validade || null,
        diasValidade: (() => {
          const d = calcDaysRemaining(row.sicaf_data_validade);
          return d !== null ? Math.max(0, d) : (row.sicaf_dias_validade != null ? Number(row.sicaf_dias_validade) : null);
        })(),
        completude: row.sicaf_completude != null ? Number(row.sicaf_completude) : null,
      } : null,
      renovacao: ultimaRenovacao ? {
        id: ultimaRenovacao.id,
        status: ultimaRenovacao.status || null,
        anoReferencia: ultimaRenovacao.ano_referencia || null,
        createdAt: ultimaRenovacao.created_at || null,
      } : null,
      manutencao: manutencaoAtual ? {
        id: manutencaoAtual.id,
        status: manutencaoAtual.status || null,
        dataInicio: manutencaoAtual.data_inicio || null,
        dataFim: manutencaoAtual.data_fim || null,
        valor: manutencaoAtual.valor != null ? Number(manutencaoAtual.valor) : null,
        diasRestantes: manutencaoAtual.dias_restantes != null ? Number(manutencaoAtual.dias_restantes) : null,
      } : null,
    };
  } catch (e) {
    console.error('[Clients] Erro consultClientByCnpj:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

/**
 * Consulta boletos pendentes (SICAF e Manutenção) por CNPJ.
 */
async function consultPendingBoletosByCnpj(cnpj) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cnpjDigits = String(cnpj || '').replace(/\D/g, '');
  if (cnpjDigits.length !== 14) {
    return { ok: false, error: 'CNPJ inválido. Informe 14 dígitos.' };
  }

  try {
    const cliente = await db('clientes as c')
      .whereRaw("REPLACE(REPLACE(REPLACE(c.documento, '.', ''), '/', ''), '-', '') = ?", [cnpjDigits])
      .select('c.id', 'c.documento', 'c.razao_social')
      .orderBy('c.id', 'desc')
      .first();

    if (!cliente) {
      return {
        ok: true,
        cnpj: cnpjDigits,
        possuiCadastro: false,
        razaoSocial: null,
        totalPendentes: 0,
        boletos: {
          sicafPendentes: [],
          manutencaoPendentes: [],
        },
        message: 'CNPJ não encontrado na base de clientes.',
      };
    }

    const sicafCadastro = await db('sicaf_cadastros as s')
      .where('s.cliente_id', cliente.id)
      .select(
        's.id',
        's.status',
        's.data_validade',
        's.dias_validade',
        's.completude'
      )
      .orderBy('s.id', 'desc')
      .first();

    let sicafInfo = null;
    if (sicafCadastro) {
      const dataValidade = sicafCadastro.data_validade || null;
      let diasParaVencer = sicafCadastro.dias_validade != null ? Number(sicafCadastro.dias_validade) : null;

      if (dataValidade) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const due = new Date(dataValidade);
        const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        diasParaVencer = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      let statusValidade = 'Sem validade';
      if (diasParaVencer != null) {
        if (diasParaVencer < 0) statusValidade = 'Vencido';
        else if (diasParaVencer <= 30) statusValidade = 'Vencendo';
        else statusValidade = 'Válido';
      }

      sicafInfo = {
        id: sicafCadastro.id,
        status: sicafCadastro.status || null,
        dataValidade,
        diasParaVencer,
        statusValidade,
        recomendacaoSolicitarBoleto: diasParaVencer != null ? diasParaVencer <= 30 : false,
        completude: sicafCadastro.completude != null ? Number(sicafCadastro.completude) : null,
      };
    }

    const pendingStatuses = [
      'aguardando',
      'pendente',
      'gerado',
      'vencido',
      'atrasado',
      'Aguardando',
      'Pendente',
      'Gerado',
      'Vencido',
      'Atrasado',
    ];

    // SICAF: fonte principal deve ser taxas_sicaf (dados internos do sistema).
    const taxasSicaf = await db('taxas_sicaf as t')
      .where('t.cliente_id', cliente.id)
      .whereNotIn('t.status', ['Pago', 'Aprovado', 'Cancelado', 'Cancelada', 'Removido'])
      .select(
        't.id',
        't.sicaf_id',
        't.status',
        't.valor',
        't.descricao',
        't.ano_referencia',
        't.forma_pagamento',
        't.codigo_barras',
        't.created_at'
      )
      .orderBy('t.ano_referencia', 'desc')
      .orderBy('t.created_at', 'desc');

    // Manutenção: fonte principal deve ser manutencao_boletos (nem todo boleto possui
    // registro em pagamentos).
    const boletosManutencao = await db('manutencao_boletos as mb')
      .leftJoin('manutencoes as m', 'm.id', 'mb.manutencao_id')
      .where('m.cliente_id', cliente.id)
      .whereNotIn('mb.status', ['Pago', 'Cancelado'])
      .select(
        'mb.id',
        'mb.manutencao_id',
        'mb.status',
        'mb.valor',
        'mb.data_vencimento',
        'mb.codigo_barras',
        'mb.numero_boleto',
        'mb.mes_referencia',
        'mb.ano_referencia',
        'mb.created_at'
      )
      .orderBy('mb.data_vencimento', 'asc')
      .orderBy('mb.created_at', 'desc');

    const taxaIds = taxasSicaf.map((t) => t.id);
    const manutencaoBoletoIds = boletosManutencao.map((b) => b.id);

    // v2 usa `pagamentos`; legado usava `pagamentos_gerencianet` — unificar via helper existente.
    const allPagamentos = await loadAllPagamentosList(db, cliente.id);
    const pendingStatusSet = new Set(pendingStatuses.map((s) => String(s).toLowerCase()));

    const pagamentosSicaf = taxaIds.length
      ? allPagamentos.filter(
          (p) =>
            p.origem === 'sicaf' &&
            String(p.tipo || 'boleto').toLowerCase() === 'boleto' &&
            taxaIds.includes(p.origem_id),
        )
      : [];

    const pagamentosManutencao = manutencaoBoletoIds.length
      ? allPagamentos.filter(
          (p) =>
            p.origem === 'manutencao' &&
            String(p.tipo || 'boleto').toLowerCase() === 'boleto' &&
            manutencaoBoletoIds.includes(p.origem_id) &&
            pendingStatusSet.has(String(p.status || '').toLowerCase()),
        )
      : [];

    const pagamentoSicafByTaxaId = {};
    for (const row of pagamentosSicaf) {
      if (!pagamentoSicafByTaxaId[row.origem_id]) {
        pagamentoSicafByTaxaId[row.origem_id] = row;
      }
    }

    const sicafPendentes = taxasSicaf.map((taxa) => {
      const pg = pagamentoSicafByTaxaId[taxa.id] || null;
      const valor = pg?.valor != null ? Number(pg.valor) : (taxa.valor != null ? Number(taxa.valor) : null);
      const dataVencimento = pg?.data_vencimento || null;
      const statusBase = String(taxa.status || pg?.status || '').trim();
      const statusLower = statusBase.toLowerCase();

      let statusPrazo = null;
      if (dataVencimento) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const due = new Date(dataVencimento);
        const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) statusPrazo = 'Vencido';
        else if (diffDays <= 30) statusPrazo = 'Vencendo';
        else statusPrazo = 'A Vencer';
      }

      const isGenericPending = ['pendente', 'aguardando', 'gerado', 'atrasado'].includes(statusLower);
      const statusFinal = isGenericPending ? (statusPrazo || statusBase || 'Pendente') : (statusBase || statusPrazo || 'Pendente');

      return {
        pagamentoId: pg?.id || null,
        taxaId: taxa.id,
        sicafId: taxa.sicaf_id || null,
        anoReferencia: taxa.ano_referencia || null,
        status: statusFinal,
        statusTaxa: taxa.status || null,
        statusPagamento: pg?.status || null,
        formaPagamento: taxa.forma_pagamento || null,
        descricao: taxa.descricao || null,
        valor,
        protocolo: pg?.protocolo || null,
        dataVencimento,
        chargeId: pg?.provider_charge_id || pg?.gn_charge_id || null,
        codigoBarras: pg?.gn_barcode || taxa.codigo_barras || null,
        linkBoleto: pg?.gn_link || null,
        pdfBoleto: pg?.gn_pdf || null,
        createdAt: pg?.created_at || taxa.created_at || null,
      };
    });

    // Pegar o último pagamento gerado por boleto de manutenção (se existir)
    const pagamentoByBoletoId = {};
    for (const row of pagamentosManutencao) {
      if (!pagamentoByBoletoId[row.origem_id]) {
        pagamentoByBoletoId[row.origem_id] = row;
      }
    }

    const manutencaoPendentes = boletosManutencao.map((boleto) => {
      const pg = pagamentoByBoletoId[boleto.id] || null;
      const valor = pg?.valor != null ? Number(pg.valor) : (boleto.valor != null ? Number(boleto.valor) : null);
      const dataVencimento = pg?.data_vencimento || boleto.data_vencimento || null;
      const statusBase = String(boleto.status || pg?.status || '').trim();
      const statusLower = statusBase.toLowerCase();

      // Classificação por prazo para refletir "vencido / vencendo / a vencer".
      let statusPrazo = null;
      if (dataVencimento) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const due = new Date(dataVencimento);
        const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) statusPrazo = 'Vencido';
        else if (diffDays <= 30) statusPrazo = 'Vencendo';
        else statusPrazo = 'A Vencer';
      }

      const isGenericPending = ['pendente', 'aguardando', 'gerado', 'atrasado'].includes(statusLower);
      const statusFinal = isGenericPending ? (statusPrazo || statusBase || 'Pendente') : (statusBase || statusPrazo || 'Pendente');

      return {
        pagamentoId: pg?.id || null,
        boletoId: boleto.id,
        manutencaoId: boleto.manutencao_id || null,
        mesReferencia: boleto.mes_referencia != null ? Number(boleto.mes_referencia) : null,
        anoReferencia: boleto.ano_referencia || null,
        status: statusFinal,
        statusBoleto: boleto.status || null,
        statusPagamento: pg?.status || null,
        valor,
        protocolo: pg?.protocolo || null,
        dataVencimento,
        chargeId: pg?.provider_charge_id || pg?.gn_charge_id || boleto.numero_boleto || null,
        codigoBarras: pg?.gn_barcode || boleto.codigo_barras || null,
        linkBoleto: pg?.gn_link || null,
        pdfBoleto: pg?.gn_pdf || null,
        createdAt: pg?.created_at || boleto.created_at || null,
      };
    });

    const totalPendentes = sicafPendentes.length + manutencaoPendentes.length;
    const valorTotalPendente = [...sicafPendentes, ...manutencaoPendentes]
      .reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

    return {
      ok: true,
      cnpj: cnpjDigits,
      possuiCadastro: true,
      clienteId: cliente.id,
      razaoSocial: cliente.razao_social || null,
      sicaf: sicafInfo,
      totalPendentes,
      valorTotalPendente,
      boletos: {
        sicafPendentes,
        manutencaoPendentes,
      },
    };
  } catch (e) {
    console.error('[Clients] Erro consultPendingBoletosByCnpj:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

function isBoletoSicafReutilizavel(pg, taxa) {
  if (!pg) return false;
  if (String(pg.tipo || '').toLowerCase() !== 'boleto') return false;
  if (isPaidFinanceStatus(pg.status) || isPaidFinanceStatus(taxa?.status)) return false;
  const pdf = pg.gn_pdf || null;
  if (!pdf) return false;
  if (isOverdueFinance(pg.status, pg.data_vencimento)) return false;
  return true;
}

async function resolvePendenciaPagamentoSicaf(db, clienteId) {
  const anoAtual = new Date().getFullYear();
  let taxas = [];
  try {
    taxas = await db('taxas_sicaf')
      .where('cliente_id', clienteId)
      .orderBy('ano_referencia', 'desc')
      .orderBy('created_at', 'desc');
  } catch (_) {}

  const cancelados = new Set(['cancelado', 'cancelada', 'removido', 'estornado']);
  const pendentes = taxas.filter((t) => {
    const s = normPayStatus(t.status);
    return isPendingFinanceStatus(t.status) && !cancelados.has(s);
  });

  if (pendentes.length) {
    return { pendente: true, taxasPendentes: pendentes, anoReferencia: pendentes[0].ano_referencia || anoAtual };
  }

  const pagoAnoAtual = taxas.some(
    (t) => Number(t.ano_referencia) === anoAtual && isPaidFinanceStatus(t.status),
  );
  if (pagoAnoAtual) {
    return { pendente: false, taxasPendentes: [], anoReferencia: anoAtual };
  }

  let sicaf = null;
  try {
    sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
  } catch (_) {}

  if (!sicaf) {
    return { pendente: true, taxasPendentes: [], anoReferencia: anoAtual, motivo: 'sem_sicaf' };
  }

  const sicafStatus = normPayStatus(sicaf.status);
  if (sicafStatus === 'pendente' || !pagoAnoAtual) {
    return { pendente: true, taxasPendentes: [], anoReferencia: anoAtual, motivo: 'taxa_nao_paga' };
  }

  return { pendente: false, taxasPendentes: [], anoReferencia: anoAtual };
}

function pickBoletoSicafValido(pagamentos, taxasPendentes) {
  const taxaIds = new Set(taxasPendentes.map((t) => t.id));
  const taxaById = Object.fromEntries(taxasPendentes.map((t) => [t.id, t]));

  const candidatos = pagamentos
    .filter((p) => p.origem === 'sicaf' && taxaIds.has(p.origem_id))
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

  for (const pg of candidatos) {
    const taxa = taxaById[pg.origem_id];
    if (isBoletoSicafReutilizavel(pg, taxa)) {
      return { pagamento: pg, taxa };
    }
  }
  return null;
}

function mapBoletoSicafResposta({
  cliente,
  cnpjDigits,
  taxa,
  pagamento,
  valor,
  reutilizado,
  geradoAgora,
  pendentePagamento,
  message,
}) {
  const pg = pagamento || {};
  const valorNum = valor != null ? Number(valor) : pg.valor != null ? Number(pg.valor) : null;
  return {
    ok: true,
    possuiCadastro: true,
    clienteId: cliente.id,
    cnpj: cnpjDigits,
    razaoSocial: cliente.razao_social || cliente.nome_fantasia || null,
    pendentePagamento: pendentePagamento !== false,
    valor: valorNum,
    valorFormatado:
      valorNum != null
        ? valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : null,
    linkPdf: pg.gn_pdf || pg.link_pdf || null,
    linkBoleto: pg.gn_link || pg.link_boleto || null,
    codigoBarras: pg.gn_barcode || pg.barcode || null,
    protocolo: pg.protocolo || null,
    dataVencimento: pg.data_vencimento || null,
    taxaId: taxa?.id || pg.origem_id || null,
    pagamentoId: pg.id || null,
    boletoReutilizado: !!reutilizado,
    geradoAgora: !!geradoAgora,
    message: message || null,
  };
}

/**
 * Por CNPJ: valida cadastro, confirma pendência de pagamento SICAF e retorna link PDF do boleto.
 * Reutiliza boleto vigente (não vencido) ou gera novo de R$ 985,00 (valor configurado no plano).
 */
async function gerarOuObterBoletoSicafByCnpj(cnpj) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cnpjDigits = String(cnpj || '').replace(/\D/g, '');
  if (cnpjDigits.length !== 14) {
    return { ok: false, error: 'CNPJ inválido. Informe 14 dígitos.' };
  }

  try {
    const cliente = await db('clientes as c')
      .whereRaw("REPLACE(REPLACE(REPLACE(c.documento, '.', ''), '/', ''), '-', '') = ?", [cnpjDigits])
      .select('c.id', 'c.documento', 'c.razao_social', 'c.nome_fantasia', 'c.email')
      .orderBy('c.id', 'desc')
      .first();

    if (!cliente) {
      return {
        ok: false,
        possuiCadastro: false,
        cnpj: cnpjDigits,
        error: 'Cliente não encontrado para este CNPJ.',
      };
    }

    const pendencia = await resolvePendenciaPagamentoSicaf(db, cliente.id);
    if (!pendencia.pendente) {
      return {
        ok: true,
        possuiCadastro: true,
        clienteId: cliente.id,
        cnpj: cnpjDigits,
        razaoSocial: cliente.razao_social || cliente.nome_fantasia || null,
        pendentePagamento: false,
        linkPdf: null,
        linkBoleto: null,
        message: 'Cliente sem pendência de pagamento da taxa SICAF.',
      };
    }

    const valorTaxa = await require('./planos.service').resolveValorTaxaSicaf(null);
    const allPagamentos = await loadAllPagamentosList(db, cliente.id);
    const reutilizavel = pickBoletoSicafValido(allPagamentos, pendencia.taxasPendentes);

    if (reutilizavel) {
      const { pagamento, taxa } = reutilizavel;
      return mapBoletoSicafResposta({
        cliente,
        cnpjDigits,
        taxa,
        pagamento,
        valor: taxa?.valor ?? valorTaxa,
        reutilizado: true,
        geradoAgora: false,
        message: 'Boleto vigente localizado. Link PDF retornado.',
      });
    }

    const sicafTaxaService = require('./sicaf-taxa.service');
    const geracao = await sicafTaxaService.gerarTaxa({
      clienteId: cliente.id,
      ano: pendencia.anoReferencia || new Date().getFullYear(),
      formaPagamento: 'boleto',
    });

    if (!geracao.ok) {
      return {
        ok: false,
        possuiCadastro: true,
        clienteId: cliente.id,
        cnpj: cnpjDigits,
        error: geracao.error || 'Erro ao gerar boleto SICAF',
        taxaId: geracao.taxaId || null,
      };
    }

    const pagamentoGerado = geracao.dados?.pagamento || {};
    const taxaId = geracao.dados?.taxaId || null;
    let pagamentoDb = null;
    if (pagamentoGerado.pagamentoId) {
      pagamentoDb = allPagamentos.find((p) => p.id === pagamentoGerado.pagamentoId) || null;
    }
    if (!pagamentoDb && pagamentoGerado.pagamentoId) {
      try {
        pagamentoDb = await db('pagamentos').where('id', pagamentoGerado.pagamentoId).first();
        if (pagamentoDb) pagamentoDb = normalizePagamentoFinanceiroFull(pagamentoDb);
      } catch (_) {}
    }

    const pagamento = pagamentoDb || {
      id: pagamentoGerado.pagamentoId || null,
      origem_id: taxaId,
      gn_pdf: pagamentoGerado.pdf || null,
      gn_link: pagamentoGerado.link || null,
      gn_barcode: pagamentoGerado.barcode || null,
      protocolo: pagamentoGerado.protocolo || null,
      data_vencimento: pagamentoGerado.vencimento || null,
      valor: pagamentoGerado.valor ?? valorTaxa,
    };

    const taxa = taxaId
      ? pendencia.taxasPendentes.find((t) => t.id === taxaId) || { id: taxaId, valor: geracao.dados?.valor }
      : null;

    if (!pagamento.gn_pdf) {
      return {
        ok: false,
        possuiCadastro: true,
        clienteId: cliente.id,
        cnpj: cnpjDigits,
        error: 'Boleto gerado, mas o link PDF não foi retornado pelo provedor de pagamento.',
        taxaId,
        pagamentoId: pagamento.id,
      };
    }

    return mapBoletoSicafResposta({
      cliente,
      cnpjDigits,
      taxa,
      pagamento,
      valor: geracao.dados?.valor ?? valorTaxa,
      reutilizado: false,
      geradoAgora: true,
      message: geracao.message || 'Novo boleto SICAF gerado com sucesso.',
    });
  } catch (e) {
    console.error('[Clients] Erro gerarOuObterBoletoSicafByCnpj:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

const PORTES_VALIDOS = ['MEI', 'ME', 'EPP', 'Média', 'Grande'];
const STATUS_VALIDOS = ['Ativo', 'Pendente', 'Inativo'];

async function _sendClienteAcessoEmail({ cliente, loginEmail, senhaPlana }) {
  const emailService = require('./email.service');
  const to =
    loginEmail ||
    cliente?.responsavel_email ||
    cliente?.email ||
    null;
  if (!to) return { ok: false, error: 'E-mail de destino não encontrado para envio de acesso.' };

  const portalBase =
    process.env.PORTAL_URL ||
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.cadbrasil.com.br';
  const login = loginEmail || to;
  const senhaTxt = senhaPlana
    ? `<p style="margin:12px 0"><strong>Senha:</strong> ${senhaPlana}</p>`
    : '<p style="margin:12px 0">Use a senha que você já possui ou solicite uma nova ao suporte.</p>';

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;padding:24px;max-width:560px">
    <h2 style="margin:0 0 8px">Dados de acesso — CadBrasil</h2>
    <p>Olá${cliente?.responsavel_nome ? `, <strong>${cliente.responsavel_nome}</strong>` : ''}!</p>
    <p>Seguem os dados para acessar o portal CadBrasil:</p>
    <p style="margin:12px 0"><strong>Login:</strong> ${login}</p>
    ${senhaTxt}
    <p style="margin:20px 0"><a href="${portalBase}/login" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Acessar o portal</a></p>
    <p style="font-size:12px;color:#64748b">Se você não solicitou esta alteração, entre em contato com o suporte.</p>
  </body></html>`;

  return emailService.send({
    to,
    subject: 'Seus dados de acesso — CadBrasil',
    html,
    text: `Login: ${login}\nAcesse: ${portalBase}/login`,
  });
}

/**
 * Atualiza cadastro do cliente (campos permitidos via whitelist).
 * @param {number} id
 * @param {Object} payload
 * @param {number|null} usuarioId — para histórico
 */
async function updateClient(id, payload, usuarioId = null) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const cliente = await db('clientes').where('id', id).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    const updates = {};
    const userUpdates = {};

    const str = (v) => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      return s.length ? s : null;
    };

    if (payload.razao_social !== undefined) {
      const v = str(payload.razao_social);
      updates.razao_social = v ?? cliente.razao_social;
    }
    if (payload.nome_fantasia !== undefined) updates.nome_fantasia = str(payload.nome_fantasia);
    if (payload.email !== undefined) updates.email = str(payload.email);
    if (payload.telefone !== undefined) updates.telefone = str(payload.telefone);
    if (payload.celular !== undefined) updates.celular = str(payload.celular);
    if (payload.endereco !== undefined) updates.endereco = str(payload.endereco);
    if (payload.cidade !== undefined) updates.cidade = str(payload.cidade);
    if (payload.estado !== undefined) {
      const e = str(payload.estado);
      updates.estado = e ? e.slice(0, 2).toUpperCase() : null;
    }
    if (payload.cep !== undefined) {
      const c = str(payload.cep);
      updates.cep = c ? c.replace(/\D/g, '') : null;
    }
    if (payload.ramo_atividade !== undefined) updates.ramo_atividade = str(payload.ramo_atividade);
    if (payload.responsavel_nome !== undefined) updates.responsavel_nome = str(payload.responsavel_nome);
    if (payload.responsavel_cpf !== undefined) {
      const c = str(payload.responsavel_cpf);
      updates.responsavel_cpf = c ? c.replace(/\D/g, '') : null;
    }
    if (payload.responsavel_email !== undefined) updates.responsavel_email = str(payload.responsavel_email);
    if (payload.responsavel_telefone !== undefined) updates.responsavel_telefone = str(payload.responsavel_telefone);
    if (payload.observacoes !== undefined) updates.observacoes = payload.observacoes === '' ? null : String(payload.observacoes);

    if (payload.porte !== undefined) {
      const p = String(payload.porte || '').trim();
      updates.porte = PORTES_VALIDOS.includes(p) ? p : cliente.porte;
    }

    if (payload.status !== undefined) {
      const s = String(payload.status || '').trim();
      updates.status = STATUS_VALIDOS.includes(s) ? s : cliente.status;
    }

    if (payload.tipo_documento !== undefined) {
      const t = String(payload.tipo_documento || '').trim().toUpperCase();
      if (t === 'CPF' || t === 'CNPJ') updates.tipo_documento = t;
    }

    if (payload.documento !== undefined) {
      const docRaw = String(payload.documento || '').trim();
      if (docRaw) {
        const docClean = docRaw.replace(/\D/g, '');
        const dupe = await db('clientes')
          .whereRaw(
            "REPLACE(REPLACE(REPLACE(REPLACE(documento, '.', ''), '/', ''), '-', ''), ' ', '') = ?",
            [docClean],
          )
          .whereNot('id', id)
          .first();
        if (dupe) {
          return { ok: false, error: 'Já existe outro cliente cadastrado com este CPF/CNPJ.' };
        }
        updates.documento = docRaw;
        if (payload.tipo_documento === undefined) {
          updates.tipo_documento = docClean.length <= 11 ? 'CPF' : 'CNPJ';
        }
      }
    }

    const forcarTroca = payload.forcar_troca === true || payload.forcarTroca === true;
    const enviarReset = payload.enviar_reset === true || payload.enviarReset === true;

    const principalPayload = payload?.usuario_principal && typeof payload.usuario_principal === 'object'
      ? payload.usuario_principal
      : null;
    let senhaPlana = null;
    let loginEmail = null;

    if (principalPayload) {
      if (!cliente.usuario_id) {
        const precisaAcesso =
          (principalPayload.email && str(principalPayload.email)) ||
          (principalPayload.nova_senha && String(principalPayload.nova_senha || '').trim());
        if (precisaAcesso) {
          return {
            ok: false,
            error: 'Este cliente não possui usuário de acesso vinculado. Vincule um usuário antes de alterar login ou senha.',
          };
        }
      }

      if (principalPayload.nome !== undefined) userUpdates.nome = str(principalPayload.nome);
      if (principalPayload.telefone !== undefined) userUpdates.telefone = str(principalPayload.telefone);
      if (principalPayload.email !== undefined) {
        const email = str(principalPayload.email);
        if (email) {
          const emailDupe = await db('usuarios')
            .whereRaw('LOWER(email) = LOWER(?)', [email])
            .whereNot('id', cliente.usuario_id || 0)
            .first();
          if (emailDupe) {
            return { ok: false, error: 'Este e-mail já está em uso por outro usuário.' };
          }
          loginEmail = email;
        }
        userUpdates.email = email;
      }
      if (principalPayload.nova_senha !== undefined) {
        const senha = String(principalPayload.nova_senha || '').trim();
        if (senha) {
          if (senha.length < 6) {
            return { ok: false, error: 'A nova senha do usuário principal deve ter no mínimo 6 caracteres.' };
          }
          senhaPlana = senha;
          userUpdates.senha_hash = await bcrypt.hash(senha, 10);
        }
      }
    }

    if (enviarReset && !cliente.usuario_id) {
      return {
        ok: false,
        error: 'Este cliente não possui usuário de acesso vinculado para enviar e-mail de redefinição.',
      };
    }

    if (enviarReset && !senhaPlana) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      senhaPlana = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      userUpdates.senha_hash = await bcrypt.hash(senhaPlana, 10);
    }

    if (forcarTroca && (senhaPlana || enviarReset)) {
      userUpdates.boas_vindas_visto_em = null;
    }

    if (Object.keys(updates).length === 0 && Object.keys(userUpdates).length === 0) {
      return { ok: false, error: 'Nenhum campo para atualizar' };
    }

    const updatesWithTs = { ...updates, updated_at: db.fn.now() };
    try {
      await db('clientes').where('id', id).update(updatesWithTs);
    } catch (e) {
      if (String(e?.message || '').toLowerCase().includes('updated_at')) {
        delete updatesWithTs.updated_at;
        await db('clientes').where('id', id).update(updatesWithTs);
      } else {
        throw e;
      }
    }

    if (cliente.usuario_id && Object.keys(userUpdates).length > 0) {
      const userPayload = { ...userUpdates, updated_at: db.fn.now() };
      try {
        await db('usuarios').where('id', cliente.usuario_id).update(userPayload);
      } catch (e) {
        if (String(e?.message || '').toLowerCase().includes('updated_at')) {
          delete userPayload.updated_at;
          await db('usuarios').where('id', cliente.usuario_id).update(userPayload);
        } else {
          throw e;
        }
      }
    }

    if (usuarioId) {
      try {
        await db('historico_acoes').insert({
          cliente_id: id,
          usuario_id: usuarioId,
          acao: Object.keys(userUpdates).length > 0
            ? 'Cadastro do cliente e dados de acesso atualizados'
            : 'Cadastro do cliente atualizado',
          entidade: 'clientes',
          entidade_id: id,
          created_at: db.fn.now(),
        });
      } catch (_) {}
    }

    if (enviarReset) {
      const usuarioAtual = cliente.usuario_id
        ? await db('usuarios').where('id', cliente.usuario_id).select('email').first()
        : null;
      const emailLogin = loginEmail || usuarioAtual?.email || updates.email || cliente.email;
      const emailResult = await _sendClienteAcessoEmail({
        cliente: { ...cliente, ...updates },
        loginEmail: emailLogin,
        senhaPlana,
      });
      if (!emailResult.ok) {
        return {
          ok: true,
          message: 'Cliente atualizado, mas o e-mail de acesso não foi enviado: ' + (emailResult.error || 'erro desconhecido'),
          emailEnviado: false,
        };
      }
      return { ok: true, message: 'Cliente atualizado e e-mail de acesso enviado', emailEnviado: true };
    }

    return { ok: true, message: 'Cliente atualizado com sucesso' };
  } catch (e) {
    console.error('[Clients] Erro updateClient:', e.message);
    return { ok: false, error: 'Erro interno no servidor' };
  }
}

async function _hasTable(db, name) {
  try {
    return await db.schema.hasTable(name);
  } catch (_) {
    return false;
  }
}

/**
 * Cancela o CNPJ/empresa no portal — cliente não deseja mais usar o serviço.
 * Inativa o cadastro, cancela SICAF, taxas e pagamentos em aberto.
 */
async function cancelClientCnpj(clienteId, { usuarioId, motivo } = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const id = parseInt(clienteId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Cliente inválido' };
  }

  const motivoTxt = String(motivo || '').trim();
  if (!motivoTxt) {
    return { ok: false, error: 'Informe o motivo do cancelamento' };
  }

  const cliente = await db('clientes').where('id', id).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  if (String(cliente.status || '').trim() === 'Inativo') {
    return { ok: false, error: 'Este CNPJ já está cancelado (inativo)' };
  }

  const resumo = {
    taxasCanceladas: 0,
    pagamentosCancelados: 0,
    sicafCancelado: false,
    manutencaoRemovida: false,
  };

  const skipPaid = ['pago', 'paga', 'aprovado', 'aprovada', 'paid', 'quitado', 'liberado', 'liberada'];
  const skipCanceled = ['cancelado', 'cancelada', 'estornado', 'removido', 'erro'];

  try {
    const TAXA_CANCELAVEL = [
      'Pendente', 'pendente', 'Aguardando', 'aguardando', 'Gerado', 'gerado',
      'Vencido', 'vencido', 'Atrasado', 'atrasado',
    ];
    resumo.taxasCanceladas = await db('taxas_sicaf')
      .where('cliente_id', id)
      .whereIn('status', TAXA_CANCELAVEL)
      .update({ status: 'Cancelado', updated_at: db.fn.now() });
  } catch (_) {}

  const cancelPagamento = async (table) => {
    if (!(await _hasTable(db, table))) return 0;
    try {
      let q = db(table).where('cliente_id', id).whereNotIn('status', skipPaid);
      if (table === 'pagamentos') q = q.whereNull('deleted_at');
      return await q
        .whereNotIn('status', skipCanceled)
        .update({ status: 'cancelado', updated_at: db.fn.now() });
    } catch (_) {
      return 0;
    }
  };

  resumo.pagamentosCancelados += await cancelPagamento('pagamentos');
  resumo.pagamentosCancelados += await cancelPagamento('pagamentos_gerencianet');

  const sicaf = await db('sicaf_cadastros').where('cliente_id', id).first();
  if (sicaf) {
    await db('sicaf_cadastros').where('id', sicaf.id).update({
      status: 'Cancelado',
      manutencao_ativa: 0,
      dias_validade: 0,
      data_validade: null,
      updated_at: db.fn.now(),
    });
    resumo.sicafCancelado = true;
  }

  try {
    const MANUTENCAO_STATUS_ATIVOS = ['Ativo', 'ativo', 'A Vencer', 'a vencer', 'Vencendo', 'vencendo'];
    const manut = await db('manutencoes')
      .where('cliente_id', id)
      .whereIn('status', MANUTENCAO_STATUS_ATIVOS)
      .orderBy('created_at', 'desc')
      .first();

    if (manut) {
      const boletoIds = await db('manutencao_boletos')
        .where('manutencao_id', manut.id)
        .pluck('id');

      if (boletoIds.length) {
        if (await _hasTable(db, 'pagamentos')) {
          await db('pagamentos')
            .where('origem', 'manutencao')
            .whereIn('origem_id', boletoIds)
            .whereNotIn('status', skipPaid)
            .update({ status: 'cancelado', updated_at: db.fn.now() });
        }
        if (await _hasTable(db, 'pagamentos_gerencianet')) {
          await db('pagamentos_gerencianet')
            .where('origem', 'manutencao')
            .whereIn('origem_id', boletoIds)
            .whereNotIn('status', skipPaid)
            .update({ status: 'cancelado', updated_at: db.fn.now() });
        }
      }

      await db('manutencoes').where('cliente_id', id).whereIn('status', MANUTENCAO_STATUS_ATIVOS).delete();
      resumo.manutencaoRemovida = true;
    }
  } catch (_) {}

  const dataCancel = new Date().toISOString().slice(0, 10);
  const obsExtra = `[${dataCancel}] CNPJ cancelado pela equipe: ${motivoTxt}`;
  const observacoes = cliente.observacoes
    ? `${cliente.observacoes}\n\n${obsExtra}`
    : obsExtra;

  await db('clientes').where('id', id).update({
    status: 'Inativo',
    observacoes,
    updated_at: db.fn.now(),
  });

  try {
    await db('historico_acoes').insert({
      cliente_id: id,
      usuario_id: usuarioId || null,
      acao: `CNPJ cancelado — ${cliente.razao_social || cliente.documento || id} (${cliente.documento || '—'}). ${motivoTxt}`,
      entidade: 'clientes',
      entidade_id: id,
      created_at: db.fn.now(),
    });
  } catch (_) {}

  return {
    ok: true,
    message: 'CNPJ cancelado com sucesso. O cliente não aparecerá mais como ativo no portal.',
    resumo,
  };
}

function normPayStatus(raw) {
  return String(raw || '').toLowerCase().trim();
}

function isPaidFinanceStatus(status) {
  const s = normPayStatus(status);
  return ['pago', 'paga', 'aprovado', 'aprovada', 'paid', 'quitado'].includes(s);
}

function isPendingFinanceStatus(status) {
  const s = normPayStatus(status);
  if (isPaidFinanceStatus(s)) return false;
  if (['cancelado', 'cancelada', 'estornado', 'erro', 'removido'].includes(s)) return false;
  return true;
}

function isOverdueFinance(status, dueDate) {
  if (isPaidFinanceStatus(status)) return false;
  const s = normPayStatus(status);
  if (['vencido', 'atrasado', 'overdue'].includes(s)) return true;
  if (!dueDate) return false;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return due < today;
}

function mapFinanceRow(row, tipo) {
  const valor = row.valor != null ? Number(row.valor) : 0;
  const status = row.status || row.statusBoleto || '—';
  const venc = row.data_vencimento || row.dataVencimento || null;
  const formaRaw = String(row.forma_pagamento || row.tipoPagamento || row.tipo || '').toLowerCase();
  const formaPagamento = formaRaw.includes('pix') ? 'PIX' : formaRaw.includes('boleto') ? 'Boleto' : row.forma_pagamento || row.tipoPagamento || row.tipo || null;
  return {
    id: row.id,
    tipo,
    descricao: row.descricao || row.descricaoLabel || tipo,
    valor,
    status,
    dataVencimento: venc,
    dataPagamento: row.data_pagamento || null,
    formaPagamento,
    anoReferencia: row.ano_referencia || null,
    mesReferencia: row.mes_referencia != null ? row.mes_referencia : null,
    createdAt: row.created_at || null,
    pagamentoId: row.pagamentoId != null ? row.pagamentoId : null,
    pago: isPaidFinanceStatus(status),
    pendente: isPendingFinanceStatus(status),
    vencido: isOverdueFinance(status, venc),
    linkPdf: row.gn_pdf || row.linkPdf || row.link_pdf || null,
    linkBoleto: row.gn_link || row.linkBoleto || row.link_boleto || null,
    protocolo: row.protocolo || null,
    barcode: row.gn_barcode || row.barcode || null,
    qrcodeText: row.qrcode_text || row.gnQrcodeText || null,
    qrcodeImage: row.qrcode_image || row.gnQrcodeImage || null,
    txid: row.provider_txid || row.gn_txid || row.txid || null,
    chargeId: row.provider_charge_id || row.gn_charge_id || row.chargeId || null,
  };
}

function normalizePagamentoFinanceiro(p) {
  return {
    id: p.id,
    origem: p.origem,
    origem_id: p.origem_id,
    data_vencimento: p.data_vencimento || null,
    data_pagamento: p.data_pagamento || null,
    tipo: p.tipo || p.forma_pagamento || null,
    status: p.status,
    created_at: p.created_at,
    gn_pdf: p.gn_pdf || p.link_pdf || null,
    gn_link: p.gn_link || p.link_boleto || null,
    protocolo: p.protocolo || null,
  };
}

function resolveFinanceStatus(taxaStatus, pgStatus) {
  const pg = normPayStatus(pgStatus);
  const tx = normPayStatus(taxaStatus);
  if (['cancelado', 'cancelada', 'estornado', 'erro', 'removido'].includes(pg)) {
    return pgStatus || 'Cancelado';
  }
  if (['cancelado', 'cancelada', 'estornado', 'erro', 'removido'].includes(tx)) {
    return taxaStatus || 'Cancelado';
  }
  if (isPaidFinanceStatus(pgStatus)) return 'Pago';
  if (isPaidFinanceStatus(taxaStatus)) return 'Pago';
  return pgStatus || taxaStatus || 'Pendente';
}

function normalizePagamentoFinanceiroFull(p) {
  return {
    id: p.id,
    origem: p.origem || 'sicaf',
    origem_id: p.origem_id,
    valor: p.valor != null ? Number(p.valor) : null,
    data_vencimento: p.data_vencimento || null,
    data_pagamento: p.data_pagamento || null,
    tipo: p.tipo || p.forma_pagamento || null,
    status: p.status,
    descricao: p.descricao || null,
    protocolo: p.protocolo || null,
    created_at: p.created_at,
    gn_pdf: p.gn_pdf || p.link_pdf || null,
    gn_link: p.gn_link || p.link_boleto || null,
    gn_barcode: p.gn_barcode || p.barcode || null,
    qrcode_text: p.qrcode_text || p.gn_qrcode_text || null,
    qrcode_image: p.qrcode_image || p.gn_qrcode_image || null,
    provider_txid: p.provider_txid || p.gn_txid || null,
    provider_charge_id: p.provider_charge_id || p.gn_charge_id || null,
  };
}

async function loadAllPagamentosList(db, clienteId) {
  const byId = new Map();

  const upsert = (p) => {
    const norm = normalizePagamentoFinanceiroFull(p);
    const existing = byId.get(norm.id);
    if (!existing) {
      byId.set(norm.id, norm);
      return;
    }
    const curTs = existing.created_at ? new Date(existing.created_at).getTime() : 0;
    const rowTs = norm.created_at ? new Date(norm.created_at).getTime() : 0;
    if (rowTs >= curTs) byId.set(norm.id, norm);
  };

  try {
    const gn = await db('pagamentos_gerencianet')
      .where('cliente_id', clienteId)
      .orderBy('created_at', 'desc')
      .limit(120);
    for (const p of gn) upsert(p);
  } catch (_) {}

  try {
    const pg = await db('pagamentos')
      .where('cliente_id', clienteId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .limit(120);
    for (const p of pg) upsert(p);
  } catch (_) {}

  return Array.from(byId.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

function buildSicafFinanceRows(taxasSicaf, allPagamentos) {
  const taxasById = Object.fromEntries(taxasSicaf.map((t) => [t.id, t]));
  const rows = [];

  const sicafPagamentos = allPagamentos
    .filter((p) => p.origem === 'sicaf' && p.origem_id)
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

  for (const p of sicafPagamentos) {
    const t = taxasById[p.origem_id];
    const effectiveStatus = resolveFinanceStatus(t?.status, p.status);
    rows.push(mapFinanceRow({
      id: t?.id || p.origem_id,
      valor: p.valor != null ? p.valor : t?.valor,
      status: effectiveStatus,
      data_vencimento: p.data_vencimento || null,
      data_pagamento: p.data_pagamento || t?.data_pagamento || null,
      forma_pagamento: p.tipo || t?.forma_pagamento,
      descricao: t?.descricao || p.descricao || `Taxa SICAF ${t?.ano_referencia || ''}`,
      ano_referencia: t?.ano_referencia,
      created_at: p.created_at || t?.created_at,
      pagamentoId: p.id,
      gn_pdf: p.gn_pdf,
      gn_link: p.gn_link,
      gn_barcode: p.gn_barcode,
      qrcode_text: p.qrcode_text,
      qrcode_image: p.qrcode_image,
      provider_txid: p.provider_txid,
      provider_charge_id: p.provider_charge_id,
      protocolo: p.protocolo,
    }, 'sicaf'));
  }

  for (const t of taxasSicaf) {
    const hasPg = sicafPagamentos.some((p) => p.origem_id === t.id);
    if (hasPg) continue;
    rows.push(mapFinanceRow({
      id: t.id,
      valor: t.valor,
      status: t.status,
      data_vencimento: null,
      data_pagamento: t.data_pagamento,
      forma_pagamento: t.forma_pagamento,
      descricao: t.descricao || `Taxa SICAF ${t.ano_referencia || ''}`,
      ano_referencia: t.ano_referencia,
      created_at: t.created_at,
      pagamentoId: null,
    }, 'sicaf'));
  }

  return rows;
}

async function loadPagamentosClienteFinanceiro(db, clienteId) {
  const byKey = {};
  const allPagamentos = await loadAllPagamentosList(db, clienteId);
  for (const row of allPagamentos) {
    const key = `${row.origem}-${row.origem_id || 0}`;
    const cur = byKey[key];
    if (!cur) {
      byKey[key] = row;
      continue;
    }
    const curTs = cur.created_at ? new Date(cur.created_at).getTime() : 0;
    const rowTs = row.created_at ? new Date(row.created_at).getTime() : 0;
    if (rowTs >= curTs) byKey[key] = row;
  }
  return byKey;
}

/**
 * Resumo financeiro do cliente: SICAF, manutenção, personalizados e pendências.
 */
async function getClientFinanceiro(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const cliente = await db('clientes').where('id', clienteId).first();
    if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

    let taxasSicaf = [];
    try {
      taxasSicaf = await db('taxas_sicaf').where('cliente_id', clienteId).orderBy('created_at', 'desc');
    } catch (_) {}

    let boletosManut = [];
    try {
      boletosManut = await db('manutencao_boletos as mb')
        .innerJoin('manutencoes as m', 'm.id', 'mb.manutencao_id')
        .where('m.cliente_id', clienteId)
        .select(
          'mb.id', 'mb.valor', 'mb.status', 'mb.data_vencimento', 'mb.data_pagamento',
          'mb.forma_pagamento', 'mb.mes_referencia', 'mb.ano_referencia', 'mb.created_at'
        )
        .orderBy('mb.created_at', 'desc');
    } catch (_) {}

    const pgByOrigem = await loadPagamentosClienteFinanceiro(db, clienteId);
    const allPagamentos = await loadAllPagamentosList(db, clienteId);

    const sicafRows = buildSicafFinanceRows(taxasSicaf, allPagamentos);
    const sicafPagos = sicafRows.filter((i) => i.pago);
    const sicafPendentes = sicafRows.filter((i) => i.pendente);

    const manutPagos = [];
    const manutPendentes = [];
    for (const b of boletosManut) {
      const pg = pgByOrigem[`manutencao-${b.id}`];
      const effectiveStatus = resolveFinanceStatus(b.status, pg?.status);
      const item = mapFinanceRow({
        id: b.id,
        valor: b.valor,
        status: effectiveStatus,
        data_vencimento: b.data_vencimento || pg?.data_vencimento,
        data_pagamento: b.data_pagamento || pg?.data_pagamento,
        forma_pagamento: b.forma_pagamento || pg?.tipo,
        descricao: `Manutenção ${String(b.mes_referencia || '').padStart(2, '0')}/${b.ano_referencia || ''}`,
        mes_referencia: b.mes_referencia,
        ano_referencia: b.ano_referencia,
        created_at: b.created_at,
        gn_pdf: pg?.gn_pdf,
        gn_link: pg?.gn_link,
        protocolo: pg?.protocolo,
      }, 'manutencao');
      if (item.pago) manutPagos.push(item);
      else if (item.pendente) manutPendentes.push(item);
    }

    const personalizados = allPagamentos
      .filter((p) => p.origem === 'personalizado' || p.origem === 'avulso')
      .map((p) => mapFinanceRow({
        id: p.id,
        valor: p.valor,
        status: p.status,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento,
        forma_pagamento: p.tipo,
        descricao: p.descricao || 'Cobrança personalizada',
        created_at: p.created_at,
        gn_pdf: p.gn_pdf,
        gn_link: p.gn_link,
        protocolo: p.protocolo,
      }, 'personalizado'));

    const pendencias = [
      ...sicafPendentes.filter((i) => i.vencido),
      ...manutPendentes.filter((i) => i.vencido),
      ...sicafPendentes.filter((i) => !i.vencido),
      ...manutPendentes.filter((i) => !i.vencido),
      ...personalizados.filter((i) => i.pendente && !i.pago),
    ];

    const sum = (arr) => arr.reduce((acc, i) => acc + (i.valor || 0), 0);

    return {
      ok: true,
      financeiro: {
        resumo: {
          totalPagoSicaf: sum(sicafPagos),
          totalPagoManutencao: sum(manutPagos),
          totalPendente: sum([...sicafPendentes, ...manutPendentes, ...personalizados.filter((p) => p.pendente)]),
          totalInadimplencia: sum(pendencias.filter((p) => p.vencido)),
          qtdPagoSicaf: sicafPagos.length,
          qtdPagoManutencao: manutPagos.length,
          qtdPendentes: sicafPendentes.length + manutPendentes.length + personalizados.filter((p) => p.pendente).length,
          qtdVencidos: pendencias.filter((p) => p.vencido).length,
        },
        sicaf: { pagos: sicafPagos, pendentes: sicafPendentes },
        manutencao: { pagos: manutPagos, pendentes: manutPendentes },
        personalizados,
        pendencias,
        pagamentosRecentes: allPagamentos.slice(0, 20).map((p) => ({
          id: p.id,
          origem: p.origem,
          tipo: p.tipo,
          valor: Number(p.valor),
          status: p.status,
          descricao: p.descricao,
          dataVencimento: p.data_vencimento,
          dataPagamento: p.data_pagamento,
          gnPdf: p.gn_pdf,
          gnLink: p.gn_link,
          createdAt: p.created_at,
        })),
      },
    };
  } catch (e) {
    console.error('[Clients] Erro getClientFinanceiro:', e.message);
    return { ok: false, error: 'Erro ao carregar financeiro' };
  }
}

/**
 * Carrega os 6 níveis SICAF do cliente (certidões + sicaf_niveis).
 */
async function loadSicafNiveisCliente(clienteId) {
  const db = getDb();
  if (!db || !clienteId) return [];

  try {
    const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
    if (!sicaf) return [];

    const certidoes = await db('certidoes as cert')
      .leftJoin('tipo_certidoes as tc', 'cert.tipo_certidao_id', 'tc.id')
      .where('cert.cliente_id', clienteId)
      .select(
        'cert.id',
        'cert.nivel_sicaf',
        'cert.data_validade',
        'cert.status',
        'tc.codigo as tipo_codigo',
      );

    let sicafNiveisDb = [];
    try {
      sicafNiveisDb = await db('sicaf_niveis')
        .where('sicaf_id', sicaf.id)
        .select('nivel', 'habilitado', 'status', 'observacao');
    } catch (_) {}

    return buildNiveisSicaf(certidoes, sicaf, sicafNiveisDb);
  } catch (e) {
    console.warn('[Clients] loadSicafNiveisCliente:', e.message);
    return [];
  }
}

module.exports = {
  listClients,
  getClientById,
  getClientFinanceiro,
  getCertidoesStatus,
  getTipoCertidoes,
  insertCertidao,
  createClient,
  updateClient,
  cancelClientCnpj,
  consultClientByCnpj,
  consultPendingBoletosByCnpj,
  gerarOuObterBoletoSicafByCnpj,
  loadSicafNiveisCliente,
  invalidateCitiesCache,
  ensureSicafTipoCertidoes,
};
