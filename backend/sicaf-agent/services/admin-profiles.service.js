/**
 * Gestão de perfis de acesso e permissões por página.
 */
const { getDb } = require('../database/connection');
const {
  ADMIN_PANEL_MANIFEST,
  syncAdminPanelPermissions,
} = require('./admin-menus-sync.service');

const PANEL_CATEGORY_ORDER = ['Operação', 'Atendimento', 'Inteligência', 'Gestão'];

const PROFILE_VISUALS = {
  admin: { cor: 'from-amber-500 to-orange-600' },
  gestor: { cor: 'from-blue-500 to-indigo-600' },
  colaborador: { cor: 'from-emerald-500 to-teal-600' },
  analista: { cor: 'from-violet-500 to-purple-600' },
  visualizador: { cor: 'from-slate-500 to-slate-700' },
  cliente: { cor: 'from-rose-500 to-pink-600' },
};

async function listProfiles() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    await syncAdminPanelPermissions();

    const profiles = await db('perfis_acesso')
      .select(
        'perfis_acesso.*',
        db.raw(
          '(SELECT COUNT(*) FROM usuarios WHERE usuarios.perfil_id = perfis_acesso.id AND usuarios.deleted_at IS NULL) as user_count',
        ),
        db.raw(
          '(SELECT COUNT(*) FROM permissoes_pagina WHERE permissoes_pagina.perfil_id = perfis_acesso.id AND permissoes_pagina.permitido = 1) as perm_ativas',
        ),
        db.raw(
          '(SELECT COUNT(*) FROM permissoes_pagina WHERE permissoes_pagina.perfil_id = perfis_acesso.id) as perm_total',
        ),
      )
      .where('perfis_acesso.ativo', 1)
      .orderBy('perfis_acesso.id');

    const result = profiles.map((p) => {
      const visuals = PROFILE_VISUALS[p.tipo] || PROFILE_VISUALS.visualizador;
      const permAtivas = p.tipo === 'admin'
        ? parseInt(p.perm_total, 10) || 0
        : parseInt(p.perm_ativas, 10) || 0;
      const permTotal = parseInt(p.perm_total, 10) || 0;
      return {
        id: p.id,
        nome: p.nome,
        descricao: p.descricao || '',
        tipo: p.tipo,
        ativo: !!p.ativo,
        membros: parseInt(p.user_count, 10) || 0,
        permAtivas,
        permTotal,
        cor: visuals.cor,
        createdAt: p.created_at,
      };
    });

    return { ok: true, perfis: result };
  } catch (e) {
    console.error('[AdminProfiles] listProfiles:', e.message);
    return { ok: false, error: 'Erro ao listar perfis' };
  }
}

function sortMasterPages(masterPages, categoryOrder, routeOrder) {
  const panelOrder = {};
  ADMIN_PANEL_MANIFEST.forEach((item, idx) => {
    panelOrder[item.paginaId] = idx;
  });

  masterPages.sort((a, b) => {
    const panelA = panelOrder[a.pagina_id];
    const panelB = panelOrder[b.pagina_id];
    if (panelA != null && panelB != null) return panelA - panelB;
    if (panelA != null) return -1;
    if (panelB != null) return 1;

    const catA = categoryOrder[a.categoria] ?? PANEL_CATEGORY_ORDER.indexOf(a.categoria);
    const catB = categoryOrder[b.categoria] ?? PANEL_CATEGORY_ORDER.indexOf(b.categoria);
    if (catA !== catB) return (catA === -1 ? 999 : catA) - (catB === -1 ? 999 : catB);

    const ordA = routeOrder[a.pagina_id] ?? 999;
    const ordB = routeOrder[b.pagina_id] ?? 999;
    return ordA - ordB;
  });
}

async function getMasterPages(db) {
  const adminPerfil = await db('perfis_acesso').where('tipo', 'admin').orderBy('id').first();
  if (adminPerfil) {
    const rows = await db('permissoes_pagina').where('perfil_id', adminPerfil.id);
    if (rows.length) return rows;
  }
  return db('permissoes_pagina').distinct('pagina_id', 'pagina_nome', 'categoria');
}

async function getPermissions(perfilId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const id = parseInt(perfilId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Perfil inválido' };
  }

  try {
    await syncAdminPanelPermissions();

    const perfil = await db('perfis_acesso').where('id', id).first();
    if (!perfil) return { ok: false, error: 'Perfil não encontrado' };

    let menuRows = [];
    try {
      menuRows = await db('menus').select('categoria', 'rota', 'ordem').where('ativo', 1).orderBy('ordem');
    } catch (_) {}

    const categoryOrder = {};
    const routeOrder = {};
    for (const m of menuRows) {
      const cat = m.categoria;
      if (!(cat in categoryOrder) || m.ordem < categoryOrder[cat]) {
        categoryOrder[cat] = m.ordem;
      }
      const routeKey = String(m.rota || '')
        .replace(/^\//, '')
        .replace(/^admin\//, '');
      routeOrder[routeKey] = m.ordem;
    }

    const masterPages = await getMasterPages(db);
    sortMasterPages(masterPages, categoryOrder, routeOrder);

    const profileRows = await db('permissoes_pagina').where('perfil_id', id);
    const profilePermsMap = {};
    for (const row of profileRows) {
      profilePermsMap[row.pagina_id] = row.permitido === 1;
    }

    const permissions = {};
    const pages = [];
    const orderedCategories = [];

    for (const mp of masterPages) {
      if (!orderedCategories.includes(mp.categoria)) {
        orderedCategories.push(mp.categoria);
      }
      const paginaId = mp.pagina_id;
      const enabled =
        perfil.tipo === 'admin' ? true : (profilePermsMap[paginaId] ?? false);
      permissions[paginaId] = enabled;
      pages.push({
        paginaId,
        paginaNome: mp.pagina_nome,
        categoria: mp.categoria,
        permitido: enabled,
      });
    }

    orderedCategories.sort((a, b) => {
      const idxA = PANEL_CATEGORY_ORDER.indexOf(a);
      const idxB = PANEL_CATEGORY_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'pt-BR');
    });

    return {
      ok: true,
      perfilId: id,
      perfil: {
        id: perfil.id,
        nome: perfil.nome,
        descricao: perfil.descricao || '',
        tipo: perfil.tipo,
        ativo: !!perfil.ativo,
      },
      permissions,
      pages,
      orderedCategories,
    };
  } catch (e) {
    console.error('[AdminProfiles] getPermissions:', e.message);
    return { ok: false, error: 'Erro ao carregar permissões' };
  }
}

async function updatePermissions(perfilId, updates) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const id = parseInt(perfilId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Perfil inválido' };
  }

  try {
    const perfil = await db('perfis_acesso').where('id', id).first();
    if (!perfil) return { ok: false, error: 'Perfil não encontrado' };
    if (perfil.tipo === 'admin') {
      return { ok: false, error: 'Não é permitido alterar permissões do perfil Administrador' };
    }

    const masterPagesRows = await getMasterPages(db);
    const masterMap = {};
    for (const mp of masterPagesRows) {
      masterMap[mp.pagina_id] = { pagina_nome: mp.pagina_nome, categoria: mp.categoria };
    }

    let updatedCount = 0;
    let insertedCount = 0;
    const keys = Object.keys(updates || {});

    for (const paginaId of keys) {
      const permitido = updates[paginaId] ? 1 : 0;
      const exists = await db('permissoes_pagina').where({ perfil_id: id, pagina_id: paginaId }).first();

      if (exists) {
        await db('permissoes_pagina')
          .where({ perfil_id: id, pagina_id: paginaId })
          .update({ permitido });
        updatedCount += 1;
      } else {
        const master = masterMap[paginaId];
        if (master) {
          await db('permissoes_pagina').insert({
            perfil_id: id,
            pagina_id: paginaId,
            pagina_nome: master.pagina_nome,
            categoria: master.categoria,
            permitido,
          });
          insertedCount += 1;
        }
      }
    }

    return {
      ok: true,
      updated: updatedCount,
      inserted: insertedCount,
      message: `Permissões salvas (${updatedCount} atualizada(s), ${insertedCount} nova(s))`,
    };
  } catch (e) {
    console.error('[AdminProfiles] updatePermissions:', e.message);
    return { ok: false, error: 'Erro ao salvar permissões' };
  }
}

async function updateProfile(perfilId, { nome, descricao }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const id = parseInt(perfilId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Perfil inválido' };
  }

  try {
    const perfil = await db('perfis_acesso').where('id', id).first();
    if (!perfil) return { ok: false, error: 'Perfil não encontrado' };
    if (perfil.tipo === 'admin' && nome && nome !== perfil.nome) {
      return { ok: false, error: 'Não é permitido renomear o perfil Administrador' };
    }

    const payload = {};
    if (nome != null && String(nome).trim()) payload.nome = String(nome).trim().slice(0, 50);
    if (descricao != null) payload.descricao = String(descricao).trim().slice(0, 255) || null;
    if (!Object.keys(payload).length) {
      return { ok: false, error: 'Nenhuma alteração informada' };
    }

    await db('perfis_acesso').where('id', id).update({ ...payload, updated_at: new Date() });
    return { ok: true, message: 'Perfil atualizado' };
  } catch (e) {
    if (String(e.message || '').includes('uq_perfis_nome')) {
      return { ok: false, error: 'Já existe um perfil com este nome' };
    }
    console.error('[AdminProfiles] updateProfile:', e.message);
    return { ok: false, error: 'Erro ao atualizar perfil' };
  }
}

async function createProfile({ nome, descricao, tipo }) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const nomeTrim = String(nome || '').trim();
  if (!nomeTrim) return { ok: false, error: 'Nome do perfil é obrigatório' };

  const tipoValido = ['gestor', 'analista', 'visualizador', 'colaborador'].includes(
    String(tipo || '').toLowerCase(),
  )
    ? String(tipo).toLowerCase()
    : 'visualizador';

  try {
    const [newId] = await db('perfis_acesso').insert({
      nome: nomeTrim.slice(0, 50),
      descricao: String(descricao || '').trim().slice(0, 255) || null,
      tipo: tipoValido,
      ativo: 1,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const masterPages = await getMasterPages(db);
    if (masterPages.length) {
      const rows = masterPages.map((mp) => ({
        perfil_id: newId,
        pagina_id: mp.pagina_id,
        pagina_nome: mp.pagina_nome,
        categoria: mp.categoria,
        permitido: 0,
      }));
      await db('permissoes_pagina').insert(rows);
    }

    return { ok: true, id: newId, message: 'Perfil criado com sucesso' };
  } catch (e) {
    if (String(e.message || '').includes('uq_perfis_nome')) {
      return { ok: false, error: 'Já existe um perfil com este nome' };
    }
    console.error('[AdminProfiles] createProfile:', e.message);
    return { ok: false, error: 'Erro ao criar perfil' };
  }
}

async function deleteProfile(perfilId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const id = parseInt(perfilId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Perfil inválido' };
  }

  try {
    const perfil = await db('perfis_acesso').where('id', id).first();
    if (!perfil) return { ok: false, error: 'Perfil não encontrado' };
    if (perfil.tipo === 'admin') {
      return { ok: false, error: 'Não é permitido excluir o perfil Administrador' };
    }

    const countRow = await db('usuarios')
      .where('perfil_id', id)
      .whereNull('deleted_at')
      .count({ total: '*' })
      .first();
    const membros = parseInt(countRow?.total || '0', 10);
    if (membros > 0) {
      return {
        ok: false,
        error: `Perfil possui ${membros} usuário(s) vinculado(s). Reatribua antes de excluir.`,
      };
    }

    await db('perfis_acesso').where('id', id).update({ ativo: 0, updated_at: new Date() });
    return { ok: true, message: 'Perfil desativado' };
  } catch (e) {
    console.error('[AdminProfiles] deleteProfile:', e.message);
    return { ok: false, error: 'Erro ao excluir perfil' };
  }
}

module.exports = {
  listProfiles,
  getPermissions,
  updatePermissions,
  updateProfile,
  createProfile,
  deleteProfile,
};
