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

function formatCpf(digits) {
  const d = normalizeDocumento(digits);
  if (d.length !== 11) return digits || "";
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function formatDocumento(doc) {
  const d = normalizeDocumento(doc);
  if (d.length === 14) return formatCnpj(d);
  if (d.length === 11) return formatCpf(d);
  return String(doc || "").trim();
}

function isCpfDigits(digits) {
  const d = normalizeDocumento(digits);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  return true;
}

function extractCpfFromText(text) {
  const src = String(text || "");
  const patterns = [
    /CPF(?:\/CNPJ)?[:\s]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i,
    /(\d{3}\.\d{3}\.\d{3}-\d{2})/,
    /CPF[:\s]*(\d{11})/i,
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (m?.[1]) {
      const digits = normalizeDocumento(m[1]);
      if (isCpfDigits(digits)) return formatCpf(digits);
    }
  }
  return null;
}

function extractCnpjFromText(text) {
  const src = String(text || "");
  const patterns = [
    /CNPJ(?:\/CPF)?[:\s]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i,
    /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,
    /CNPJ[:\s]*(\d{14})/i,
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

function extractDocumentoFromText(text) {
  const src = String(text || "");

  const cpfCnpjHeader = src.match(/CPF\/CNPJ[:\s]*([\d.\-\/]+)/i);
  if (cpfCnpjHeader?.[1]) {
    const digits = normalizeDocumento(cpfCnpjHeader[1]);
    if (digits.length === 11 && isCpfDigits(digits)) {
      return { documento: formatCpf(digits), tipo: "CPF" };
    }
    if (digits.length === 14) {
      return { documento: formatCnpj(digits), tipo: "CNPJ" };
    }
  }

  const cnpj = extractCnpjFromText(text);
  if (cnpj) return { documento: cnpj, tipo: "CNPJ" };
  const cpf = extractCpfFromText(text);
  if (cpf) return { documento: cpf, tipo: "CPF" };
  return { documento: null, tipo: null };
}

function resolveDocumentoFromPdf(jsonData, pdfText) {
  const fromText = extractDocumentoFromText(pdfText);
  const iaCnpj = jsonData?.cnpj ? formatDocumento(jsonData.cnpj) : null;
  const iaCpf = jsonData?.cpf ? formatDocumento(jsonData.cpf) : null;
  const iaDoc = jsonData?.documento ? formatDocumento(jsonData.documento) : null;

  const pick = (doc, metodo) => {
    const digits = normalizeDocumento(doc);
    if (digits.length !== 11 && digits.length !== 14) return null;
    return { documento: formatDocumento(doc), metodo, tipo: digits.length === 11 ? "CPF" : "CNPJ" };
  };

  if (iaCpf && normalizeDocumento(iaCpf).length === 11) {
    return pick(iaCpf, "extração via IA (CPF)");
  }
  if (iaCnpj && normalizeDocumento(iaCnpj).length === 14) {
    return pick(iaCnpj, "extração via IA (CNPJ)");
  }
  if (iaDoc) {
    const digits = normalizeDocumento(iaDoc);
    return pick(iaDoc, `extração via IA (${digits.length === 11 ? "CPF" : "CNPJ"})`);
  }
  if (fromText.documento) {
    return {
      documento: fromText.documento,
      metodo: `regex no texto do PDF (${fromText.tipo})`,
      tipo: fromText.tipo,
    };
  }

  return { documento: null, metodo: null, tipo: null };
}

function applyDocumentoToPdfJson(jsonData, pdfText) {
  const resolved = resolveDocumentoFromPdf(jsonData, pdfText);
  if (resolved.documento && jsonData) {
    jsonData.documento = resolved.documento;
    if (resolved.tipo === "CPF") {
      jsonData.cpf = resolved.documento;
      delete jsonData.cnpj;
    } else {
      jsonData.cnpj = resolved.documento;
      delete jsonData.cpf;
    }
  }
  return resolved;
}

function getDocumentoFromPdfJson(jsonData) {
  const doc = jsonData?.documento || jsonData?.cpf || jsonData?.cnpj;
  return doc ? formatDocumento(doc) : null;
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
  if (!t || t === 'cliente') return false;
  return (
    t === 'admin' ||
    t === 'colaborador' ||
    t === 'gestor' ||
    t === 'analista' ||
    t === 'visualizador'
  );
}

function isEquipePerfilTipo(tipo) {
  return String(tipo || '').toLowerCase() !== 'cliente';
}

/**
 * Equipe interna: fonte da verdade é usuarios.perfil_id → perfis_acesso.tipo.
 * Perfil "cliente" nunca acessa /admin, mesmo com tipo_usuario legado incorreto.
 */
async function isUsuarioStaff(db, usuarioId, _jwtTipo) {
  if (!db) return false;

  try {
    const u = await db('usuarios')
      .where('id', usuarioId)
      .whereNull('deleted_at')
      .select('perfil_id', 'tipo_usuario')
      .first();
    if (!u) return false;

    if (u.perfil_id) {
      const perfil = await db('perfis_acesso')
        .where('id', u.perfil_id)
        .select('tipo', 'ativo')
        .first();

      if (!perfil || !perfil.ativo) return false;
      const perfilTipo = String(perfil.tipo || '').toLowerCase();
      if (perfilTipo === 'cliente') return false;
      return isEquipePerfilTipo(perfilTipo);
    }

    // Sem perfil_id: fallback legado em tipo_usuario
    return isStaffTipo(u.tipo_usuario);
  } catch (_) {
    return false;
  }
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
  if (!db) {
    // Sem banco: só confia no JWT se não for cliente
    return String(jwtTipo || '').toLowerCase() !== 'cliente' && isStaffTipo(jwtTipo);
  }
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
  formatCpf,
  formatDocumento,
  extractCnpjFromText,
  extractCpfFromText,
  extractDocumentoFromText,
  resolveDocumentoFromPdf,
  applyDocumentoToPdfJson,
  getDocumentoFromPdfJson,
  listClientesForUsuario,
  findClienteByDocumentoForUsuario,
};
