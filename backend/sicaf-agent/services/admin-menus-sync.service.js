/**
 * Garante páginas do painel /admin em menus e permissoes_pagina.
 * Espelha src/components/admin/admin-sidebar.tsx + rotas legadas do portal.
 */
const { getDb } = require('../database/connection');

const LOG_PREFIX = '[AdminMenusSync]';

/** Páginas do painel admin v2 — paginaId alinhado ao legado quando já existia. */
const ADMIN_PANEL_MANIFEST = [
  { paginaId: 'dashboard', paginaNome: 'Dashboard Executivo', categoria: 'Operação', rota: '/admin' },
  { paginaId: 'clients', paginaNome: 'Gestão de Clientes', categoria: 'Operação', rota: '/admin/clientes' },
  { paginaId: 'financeiro', paginaNome: 'Financeiro', categoria: 'Operação', rota: '/admin/financeiro' },
  { paginaId: 'cobranca', paginaNome: 'Cobrança', categoria: 'Operação', rota: '/admin/cobranca' },
  { paginaId: 'sicaf', paginaNome: 'Gestão SICAF', categoria: 'Operação', rota: '/admin/sicaf' },
  { paginaId: 'documents', paginaNome: 'Documentos', categoria: 'Operação', rota: '/admin/documentos' },
  { paginaId: 'tickets-admin', paginaNome: 'Suporte (Kanban)', categoria: 'Atendimento', rota: '/admin/suporte' },
  { paginaId: 'atendimento', paginaNome: 'Central de Atendimento', categoria: 'Atendimento', rota: '/admin/atendimento' },
  { paginaId: 'alerts', paginaNome: 'Central de Alertas', categoria: 'Atendimento', rota: '/admin/alertas' },
  { paginaId: 'crm-clientes', paginaNome: 'CRM Clientes', categoria: 'CRM', rota: '/admin/crm-clientes' },
  { paginaId: 'email-marketing', paginaNome: 'Email Marketing', categoria: 'CRM', rota: '/admin/email-marketing' },
  { paginaId: 'google-ads-tracking', paginaNome: 'Google Ads', categoria: 'Inteligência', rota: '/admin/google-ads' },
  { paginaId: 'processos', paginaNome: 'Processos', categoria: 'Inteligência', rota: '/admin/processos' },
  { paginaId: 'funil', paginaNome: 'Funil Comercial', categoria: 'Inteligência', rota: '/admin/funil' },
  { paginaId: 'ia-gerencial', paginaNome: 'IA Gerencial', categoria: 'Inteligência', rota: '/admin/ia' },
  { paginaId: 'automacoes', paginaNome: 'Automações', categoria: 'Inteligência', rota: '/admin/automacoes' },
  { paginaId: 'system-users', paginaNome: 'Gestão de Equipe', categoria: 'Gestão', rota: '/admin/equipe' },
  { paginaId: 'access-profiles', paginaNome: 'Gestão de Perfis', categoria: 'Gestão', rota: '/admin/perfis' },
  { paginaId: 'reports', paginaNome: 'Relatórios', categoria: 'Gestão', rota: '/admin/relatorios' },
  { paginaId: 'auditoria', paginaNome: 'Auditoria', categoria: 'Gestão', rota: '/admin/auditoria' },
  { paginaId: 'settings', paginaNome: 'Configurações', categoria: 'Gestão', rota: '/admin/configuracoes' },
];

async function ensureMenuRow(db, item, ordemBase) {
  const rota = item.rota;
  const existing = await db('menus').where('rota', rota).first();
  if (existing) {
    const updates = {};
    if (item.paginaNome && existing.titulo !== item.paginaNome) updates.titulo = item.paginaNome;
    if (item.categoria && existing.categoria !== item.categoria) updates.categoria = item.categoria;
    if (Object.keys(updates).length) {
      await db('menus').where('id', existing.id).update(updates);
    }
    return { action: 'exists', id: existing.id };
  }

  const [id] = await db('menus').insert({
    titulo: item.paginaNome,
    descricao: item.paginaNome,
    categoria: item.categoria,
    icone: 'LayoutDashboard',
    rota,
    ordem: ordemBase,
    ativo: 1,
    requer_autenticacao: 1,
    tipo_usuario: 'admin',
  });
  return { action: 'inserted', id };
}

async function ensurePermissionRow(db, perfilId, item, permitido) {
  const existing = await db('permissoes_pagina')
    .where({ perfil_id: perfilId, pagina_id: item.paginaId })
    .first();

  if (existing) {
    if (existing.pagina_nome !== item.paginaNome || existing.categoria !== item.categoria) {
      await db('permissoes_pagina').where('id', existing.id).update({
        pagina_nome: item.paginaNome,
        categoria: item.categoria,
      });
    }
    return { action: 'exists' };
  }

  await db('permissoes_pagina').insert({
    perfil_id: perfilId,
    pagina_id: item.paginaId,
    pagina_nome: item.paginaNome,
    categoria: item.categoria,
    permitido: permitido ? 1 : 0,
  });
  return { action: 'inserted' };
}

/**
 * Sincroniza manifest do painel admin no banco (idempotente).
 */
async function syncAdminPanelPermissions() {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  try {
    const hasMenus = await db.schema.hasTable('menus');
    const hasPerms = await db.schema.hasTable('permissoes_pagina');
    if (!hasPerms) return { ok: true, skipped: true };

    let ordem = 500;
    if (hasMenus) {
      for (const item of ADMIN_PANEL_MANIFEST) {
        await ensureMenuRow(db, item, ordem);
        ordem += 1;
      }
    }

    const adminPerfil = await db('perfis_acesso').where('tipo', 'admin').orderBy('id').first();
    if (!adminPerfil) return { ok: true, skipped: true };

    let insertedAdmin = 0;
    for (const item of ADMIN_PANEL_MANIFEST) {
      const r = await ensurePermissionRow(db, adminPerfil.id, item, true);
      if (r.action === 'inserted') insertedAdmin += 1;
    }

    const outrosPerfis = await db('perfis_acesso').whereNot('id', adminPerfil.id).where('ativo', 1);
    let insertedOthers = 0;
    for (const perfil of outrosPerfis) {
      for (const item of ADMIN_PANEL_MANIFEST) {
        const r = await ensurePermissionRow(db, perfil.id, item, false);
        if (r.action === 'inserted') insertedOthers += 1;
      }
    }

    if (insertedAdmin || insertedOthers) {
      console.log(
        `${LOG_PREFIX} ${insertedAdmin} permissão(ões) admin, ${insertedOthers} em outros perfis`,
      );
    }

    return { ok: true, insertedAdmin, insertedOthers };
  } catch (e) {
    console.error(`${LOG_PREFIX} Erro:`, e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  ADMIN_PANEL_MANIFEST,
  syncAdminPanelPermissions,
};
