/**
 * Contratos digitais — cadastro, atualização e consulta (admin + criação automática).
 */
const { getDb } = require('../database/connection');
const { assertClienteAcessivel } = require('./client-access.service');

function defaultVencimento(dataInicio) {
  const d = new Date(dataInicio || new Date().toISOString().slice(0, 10));
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + 1);
    return fallback.toISOString().slice(0, 10);
  }
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function parseAssinadoEm(value) {
  if (!value) return new Date();
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00`);
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function parseObservacoes(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch (_) {
    return { nota: String(raw) };
  }
}

function buildObservacoes(extra = {}) {
  const clean = {};
  if (extra.valorMensal != null) clean.valorMensal = Number(extra.valorMensal);
  if (extra.vigenciaMeses != null) clean.vigenciaMeses = Number(extra.vigenciaMeses);
  if (extra.emailSignatario) clean.emailSignatario = String(extra.emailSignatario);
  if (extra.nota) clean.nota = String(extra.nota);
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

function mapContratoRow(row) {
  if (!row) return null;
  const meta = parseObservacoes(row.observacoes);
  return {
    id: row.id,
    clienteId: row.cliente_id,
    plano: row.plano,
    dataInicio: row.data_inicio,
    dataVencimento: row.data_vencimento,
    status: row.status,
    assinadoEm: row.assinado_em,
    assinadoPor: row.assinado_por,
    observacoes: row.observacoes,
    valorMensal: meta.valorMensal ?? null,
    vigenciaMeses: meta.vigenciaMeses ?? 12,
    emailSignatario: meta.emailSignatario ?? null,
    razaoSocial: row.razao_social,
    documento: row.documento,
    tipoDocumento: row.tipo_documento,
    email: row.email,
    telefone: row.telefone,
    cidade: row.cidade,
    estado: row.estado,
    responsavelNome: row.responsavel_nome,
    createdAt: row.created_at,
  };
}

async function getContratoAdmin(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  const row = await db('contratos_digitais as cd')
    .join('clientes as c', 'cd.cliente_id', 'c.id')
    .where('cd.cliente_id', clienteId)
    .whereNull('cd.deleted_at')
    .select(
      'cd.*',
      'c.razao_social',
      'c.documento',
      'c.tipo_documento',
      'c.email',
      'c.telefone',
      'c.cidade',
      'c.estado',
      'c.responsavel_nome',
    )
    .orderBy('cd.created_at', 'desc')
    .first();

  return { ok: true, contrato: mapContratoRow(row) };
}

async function salvarContratoAdmin({
  clienteId,
  contratoId,
  plano,
  dataInicio,
  dataVencimento,
  status,
  assinadoPor,
  assinadoEm,
  valorMensal,
  vigenciaMeses,
  emailSignatario,
  observacoes,
}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  const inicio = dataInicio || new Date().toISOString().slice(0, 10);
  const vencimento = dataVencimento || defaultVencimento(inicio);
  const statusFinal = status === 'Assinado' ? 'Assinado' : 'Pendente Assinatura';

  if (statusFinal === 'Assinado' && !assinadoPor?.trim()) {
    return { ok: false, error: 'Informe o nome de quem assinou o contrato' };
  }

  let existingId = contratoId || null;
  if (!existingId) {
    const existing = await db('contratos_digitais')
      .where('cliente_id', clienteId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .first();
    existingId = existing?.id || null;
  }

  const obsJson = buildObservacoes({
    valorMensal,
    vigenciaMeses,
    emailSignatario,
    nota: observacoes,
  });

  const payload = {
    plano: plano || 'Licença + Manutenção',
    data_inicio: inicio,
    data_vencimento: vencimento,
    status: statusFinal,
    observacoes: obsJson,
  };

  if (statusFinal === 'Assinado') {
    payload.assinado_em = parseAssinadoEm(assinadoEm || inicio);
    payload.assinado_por = assinadoPor.trim();
  } else {
    payload.assinado_em = null;
    payload.assinado_por = null;
    payload.ip_assinatura = null;
  }

  if (existingId) {
    await db('contratos_digitais').where('id', existingId).update(payload);
    const updated = await getContratoAdmin(clienteId);
    return {
      ok: true,
      contratoId: existingId,
      contrato: updated.contrato,
      message: 'Contrato atualizado com sucesso!',
      created: false,
    };
  }

  const [id] = await db('contratos_digitais').insert({
    cliente_id: clienteId,
    ...payload,
  });
  const created = await getContratoAdmin(clienteId);
  return {
    ok: true,
    contratoId: id,
    contrato: created.contrato,
    message: 'Contrato criado com sucesso!',
    created: true,
  };
}

async function criarContrato({ clienteId, plano, dataInicio, dataVencimento, status, assinadoPor, assinadoEm }) {
  return salvarContratoAdmin({
    clienteId,
    plano,
    dataInicio,
    dataVencimento,
    status,
    assinadoPor,
    assinadoEm,
  });
}

async function getContratoForUsuario(clienteId, usuarioId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const cliente = await assertClienteAcessivel(db, clienteId, usuarioId);
  if (!cliente) return { ok: false, error: 'Cliente não encontrado ou sem permissão' };

  return getContratoAdmin(clienteId);
}

module.exports = {
  criarContrato,
  getContratoAdmin,
  getContratoForUsuario,
  salvarContratoAdmin,
};
