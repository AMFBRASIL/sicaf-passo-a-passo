/**
 * Verifica se o usuário do portal pode acessar o cliente.
 */
const { getDb } = require('../database/connection');

function normalizeDocumento(doc) {
  return String(doc || "").replace(/\D/g, "");
}

function formatCnpj(digits) {
  const d = normalizeDocumento(digits);
  if (d.length !== 14) return digits || "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function extractCnpjFromText(text) {
  const src = String(text || "");
  const patterns = [
    /CNPJ[:\s]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
    /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,
    /(\d{14})/,
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (m?.[1]) {
      const digits = normalizeDocumento(m[1]);
      if (digits.length === 14) return formatCnpj(digits);
    }
  }
  return null;
}

async function getTipoUsuario(db, usuarioId) {
  try {
    const u = await db('usuarios').where('id', usuarioId).select('tipo_usuario').first();
    return String(u?.tipo_usuario || '').toLowerCase();
  } catch {
    return '';
  }
}

function isStaffTipo(tipo) {
  const t = String(tipo || '').toLowerCase();
  return (
    t === 'admin' ||
    t === 'colaborador' ||
    t === 'gestor' ||
    t === 'analista' ||
    t === 'visualizador'
  );
}

async function isUsuarioStaff(db, usuarioId, jwtTipo) {
  if (isStaffTipo(jwtTipo)) return true;

  const tipoUsuario = await getTipoUsuario(db, usuarioId);
  if (isStaffTipo(tipoUsuario)) return true;

  try {
    const u = await db('usuarios').where('id', usuarioId).select('perfil_id').first();
    if (u?.perfil_id) {
      const perfil = await db('perfis_acesso').where('id', u.perfil_id).select('tipo', 'nome').first();
      if (perfil && isStaffTipo(perfil.tipo)) return true;
      const nome = String(perfil?.nome || '').toLowerCase();
      if (nome.includes('admin') || nome.includes('gestor') || nome.includes('colaborador')) return true;
    }
  } catch (_) {}

  return false;
}

async function assertClienteAcessivel(db, clienteId, usuarioId, jwtTipo) {
  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return null;

  if (await isUsuarioStaff(db, usuarioId, jwtTipo)) return cliente;

  const tipoUsuario = await getTipoUsuario(db, usuarioId);

  if (tipoUsuario === 'colaborador') {
    try {
      const hasTable = await db.schema.hasTable('usuario_clientes');
      if (hasTable) {
        const vinculo = await db('usuario_clientes')
          .where({ usuario_id: usuarioId, cliente_id: clienteId })
          .first();
        if (vinculo) return cliente;
      }
    } catch (_) {}
    return null;
  }

  if (Number(cliente.usuario_id) === Number(usuarioId)) return cliente;
  return null;
}

async function listClientesForUsuario(db, usuarioId) {
  const tipoUsuario = await getTipoUsuario(db, usuarioId);
  let query = db("clientes").select("id", "razao_social", "nome_fantasia", "documento", "usuario_id");

  if (tipoUsuario === "colaborador") {
    try {
      const hasTable = await db.schema.hasTable("usuario_clientes");
      if (hasTable) {
        query = query.whereIn(
          "id",
          db("usuario_clientes").where("usuario_id", usuarioId).select("cliente_id"),
        );
      } else {
        return [];
      }
    } catch {
      return [];
    }
  } else {
    query = query.where("usuario_id", usuarioId);
  }

  return query.orderBy("id", "desc");
}

async function findClienteByDocumentoForUsuario(db, documento, usuarioId) {
  const docDigits = normalizeDocumento(documento);
  if (!docDigits) return null;

  const clientes = await listClientesForUsuario(db, usuarioId);
  return (
    clientes.find((c) => normalizeDocumento(c.documento) === docDigits) || null
  );
}

async function assertClienteAcessivelById(clienteId, usuarioId, jwtTipo) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };
  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId, jwtTipo);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };
  return { ok: true, cliente };
}

async function checkUsuarioIsStaff(usuarioId, jwtTipo) {
  const db = getDb();
  if (!db) return isStaffTipo(jwtTipo);
  return isUsuarioStaff(db, usuarioId, jwtTipo);
}

module.exports = {
  assertClienteAcessivel,
  assertClienteAcessivelById,
  isStaffTipo,
  isUsuarioStaff,
  checkUsuarioIsStaff,
  normalizeDocumento,
  formatCnpj,
  extractCnpjFromText,
  listClientesForUsuario,
  findClienteByDocumentoForUsuario,
};
