/**
 * Gestão de equipe interna (usuarios + perfis_acesso + métricas de tickets).
 */
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/connection');

function isPerfilEquipe(tipo) {
  return String(tipo || '').toLowerCase() !== 'cliente';
}

function initialsFromName(nome) {
  return String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatMediaMin(minutes) {
  const m = Math.max(0, parseInt(minutes, 10) || 0);
  if (!m) return '—';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}

async function isStaffPerfilId(db, perfilId) {
  const perfil = await db('perfis_acesso').where('id', perfilId).first();
  if (!perfil || !perfil.ativo) return false;
  return isPerfilEquipe(perfil.tipo);
}

async function fetchStatsMap(db) {
  const hasTickets = await db.schema.hasTable('tickets');
  if (!hasTickets) return {};

  const rows = await db('tickets as t')
    .whereNotNull('t.atribuido_a')
    .whereRaw('t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)')
    .groupBy('t.atribuido_a')
    .select(
      't.atribuido_a as usuario_id',
      db.raw('COUNT(t.id) as tickets'),
      db.raw('COUNT(DISTINCT t.cliente_id) as clientes'),
      db.raw(
        "ROUND(100 * SUM(CASE WHEN t.status IN ('resolvido','fechado') AND (t.sla_minutos_restantes >= 0 OR t.sla_minutos_restantes IS NULL) THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0), 0) as sla_pct",
      ),
      db.raw(
        'ROUND(AVG(TIMESTAMPDIFF(MINUTE, t.created_at, COALESCE(t.fechado_em, NOW()))), 0) as media_min',
      ),
      db.raw('ROUND(AVG(t.satisfacao_nota), 1) as avaliacao'),
    );

  const map = {};
  for (const row of rows) {
    map[row.usuario_id] = {
      tickets: parseInt(row.tickets, 10) || 0,
      clientes: parseInt(row.clientes, 10) || 0,
      sla: parseInt(row.sla_pct, 10) || 0,
      mediaMin: parseInt(row.media_min, 10) || 0,
      avaliacao: parseFloat(row.avaliacao) || 0,
    };
  }
  return map;
}

function mapMembro(row, stats) {
  const st = stats[row.id] || {};
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone || '',
    cargo: row.departamento || '—',
    perfilId: row.perfil_id,
    perfil: row.perfil_nome || '—',
    perfilTipo: row.perfil_tipo || '',
    ativo: row.status === 'Ativo',
    status: row.status,
    avatarIniciais: row.avatar_iniciais || initialsFromName(row.nome),
    tickets: st.tickets || 0,
    media: formatMediaMin(st.mediaMin),
    sla: st.sla || 0,
    clientes: st.clientes || 0,
    avaliacao: st.avaliacao || 0,
  };
}

async function listPerfisParaEquipe(db) {
  const rows = await db('perfis_acesso')
    .where('ativo', 1)
    .whereNot('tipo', 'cliente')
    .orderBy('id')
    .select('id', 'nome', 'descricao', 'tipo');

  return rows.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao || '',
    tipo: p.tipo,
  }));
}

async function listEquipe() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const [stats, perfis] = await Promise.all([fetchStatsMap(db), listPerfisParaEquipe(db)]);

    const rows = await db('usuarios as u')
      .innerJoin('perfis_acesso as p', 'p.id', 'u.perfil_id')
      .whereNull('u.deleted_at')
      .whereNot('p.tipo', 'cliente')
      .where('p.ativo', 1)
      .select(
        'u.id',
        'u.nome',
        'u.email',
        'u.telefone',
        'u.departamento',
        'u.status',
        'u.perfil_id',
        'u.avatar_iniciais',
        'p.nome as perfil_nome',
        'p.tipo as perfil_tipo',
      )
      .orderBy('u.nome');

    const membros = rows.map((row) => mapMembro(row, stats));
    const ativos = membros.filter((m) => m.ativo).length;

    return { ok: true, membros, perfis, total: membros.length, ativos };
  } catch (e) {
    console.error('[AdminEquipe] listEquipe:', e.message);
    return { ok: false, error: 'Erro ao listar equipe' };
  }
}

async function createMembro({ nome, email, telefone, cargo, perfilId, senha, ativo }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const nomeTrim = String(nome || '').trim();
  const emailTrim = String(email || '').trim().toLowerCase();
  const perfil = parseInt(perfilId, 10);

  if (!nomeTrim) return { ok: false, error: 'Nome é obrigatório' };
  if (!emailTrim || !emailTrim.includes('@')) return { ok: false, error: 'E-mail inválido' };
  if (!Number.isFinite(perfil) || perfil <= 0) return { ok: false, error: 'Perfil inválido' };
  if (!(await isStaffPerfilId(db, perfil))) {
    return { ok: false, error: 'Perfil deve ser de equipe interna (não Cliente)' };
  }

  const senhaPlana = String(senha || '').trim() || `Cad@${Date.now().toString(36).slice(-6)}`;

  try {
    const dupe = await db('usuarios').where('email', emailTrim).whereNull('deleted_at').first();
    if (dupe) return { ok: false, error: 'E-mail já cadastrado' };

    const senha_hash = await bcrypt.hash(senhaPlana, 10);
    const [newId] = await db('usuarios').insert({
      nome: nomeTrim.slice(0, 120),
      email: emailTrim.slice(0, 150),
      telefone: telefone ? String(telefone).trim().slice(0, 20) : null,
      departamento: cargo ? String(cargo).trim().slice(0, 100) : null,
      senha_hash,
      tipo_usuario: 'colaborador',
      status: ativo === false ? 'Inativo' : 'Ativo',
      perfil_id: perfil,
      avatar_iniciais: initialsFromName(nomeTrim),
      created_at: new Date(),
      updated_at: new Date(),
    });

    return {
      ok: true,
      id: newId,
      message: 'Colaborador criado com sucesso',
      senhaTemporaria: senha ? undefined : senhaPlana,
    };
  } catch (e) {
    console.error('[AdminEquipe] createMembro:', e.message);
    return { ok: false, error: 'Erro ao criar colaborador' };
  }
}

async function updateMembro(usuarioId, { nome, email, telefone, cargo, perfilId, ativo, senha }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const id = parseInt(usuarioId, 10);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'ID inválido' };

  try {
    const usuario = await db('usuarios as u')
      .innerJoin('perfis_acesso as p', 'p.id', 'u.perfil_id')
      .where('u.id', id)
      .whereNull('u.deleted_at')
      .whereNot('p.tipo', 'cliente')
      .select('u.*')
      .first();

    if (!usuario) return { ok: false, error: 'Colaborador não encontrado' };

    const payload = { updated_at: new Date() };

    if (nome != null && String(nome).trim()) {
      payload.nome = String(nome).trim().slice(0, 120);
      payload.avatar_iniciais = initialsFromName(payload.nome);
    }
    if (email != null) {
      const emailTrim = String(email).trim().toLowerCase();
      if (!emailTrim.includes('@')) return { ok: false, error: 'E-mail inválido' };
      const dupe = await db('usuarios')
        .where('email', emailTrim)
        .whereNot('id', id)
        .whereNull('deleted_at')
        .first();
      if (dupe) return { ok: false, error: 'E-mail já cadastrado' };
      payload.email = emailTrim.slice(0, 150);
    }
    if (telefone !== undefined) {
      payload.telefone = telefone ? String(telefone).trim().slice(0, 20) : null;
    }
    if (cargo !== undefined) {
      payload.departamento = cargo ? String(cargo).trim().slice(0, 100) : null;
    }
    if (perfilId != null) {
      const perfil = parseInt(perfilId, 10);
      if (!Number.isFinite(perfil) || perfil <= 0) return { ok: false, error: 'Perfil inválido' };
      if (!(await isStaffPerfilId(db, perfil))) {
        return { ok: false, error: 'Perfil deve ser de equipe interna (não Cliente)' };
      }
      payload.perfil_id = perfil;
    }
    if (ativo !== undefined) {
      payload.status = ativo ? 'Ativo' : 'Inativo';
    }
    if (senha && String(senha).trim().length >= 6) {
      payload.senha_hash = await bcrypt.hash(String(senha).trim(), 10);
    }

    await db('usuarios').where('id', id).update(payload);

    const refreshed = await db('usuarios as u')
      .innerJoin('perfis_acesso as p', 'p.id', 'u.perfil_id')
      .where('u.id', id)
      .select(
        'u.id',
        'u.nome',
        'u.email',
        'u.telefone',
        'u.departamento',
        'u.status',
        'u.perfil_id',
        'u.avatar_iniciais',
        'p.nome as perfil_nome',
        'p.tipo as perfil_tipo',
      )
      .first();

    const stats = await fetchStatsMap(db);
    return { ok: true, message: 'Colaborador atualizado', membro: mapMembro(refreshed, stats) };
  } catch (e) {
    console.error('[AdminEquipe] updateMembro:', e.message);
    return { ok: false, error: 'Erro ao atualizar colaborador' };
  }
}

module.exports = {
  listEquipe,
  listPerfisParaEquipe,
  createMembro,
  updateMembro,
};
