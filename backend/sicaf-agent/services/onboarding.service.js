/**
 * Onboarding público — valida protocolo em clientes.protocolo_cadbrasil.
 */
const { getDb } = require('../database/connection');
const {
  resolveFinancialReleased,
  resolveSicafDisplayStatus,
} = require('../utils/sicaf-status');

const PROTOCOLO_COL = 'protocolo_cadbrasil';

function normalizeProtocolo(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function maskRazaoSocial(nome) {
  const parts = String(nome || 'Empresa')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'Empresa';
  if (parts.length === 1) return `${parts[0].slice(0, 3)}***`;
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}***`;
}

async function resolveClienteFromProtocolo(db, protocoloRaw) {
  const protocolo = normalizeProtocolo(protocoloRaw);
  if (protocolo.length < 6) return null;

  const hasCol = await db.schema.hasColumn('clientes', PROTOCOLO_COL);
  if (!hasCol) return null;

  const cliente = await db('clientes')
    .whereRaw(`UPPER(TRIM(${PROTOCOLO_COL})) = ?`, [protocolo])
    .first();

  if (!cliente?.id) return null;

  return {
    clienteId: cliente.id,
    protocolo: normalizeProtocolo(cliente[PROTOCOLO_COL]) || protocolo,
  };
}

function buildCheck(label, detail, ok, statusLabelOk = 'OK', statusLabelPending = 'Pendente') {
  return {
    label,
    detail,
    status: ok ? 'ok' : 'pendente',
    statusLabel: ok ? statusLabelOk : statusLabelPending,
  };
}

async function buildDiagnosticoChecks(db, clienteId) {
  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return null;

  const sicaf = await db('sicaf_cadastros').where('cliente_id', clienteId).first();
  const niveis = sicaf
    ? await db('sicaf_niveis').where('sicaf_id', sicaf.id).select('nivel', 'habilitado', 'status', 'observacao')
    : [];
  const niveisMap = Object.fromEntries(niveis.map((n) => [String(n.nivel), n]));

  const taxaPagaRow = await db('taxas_sicaf')
    .where('cliente_id', clienteId)
    .whereIn('status', ['pago', 'paga', 'aprovado', 'aprovada', 'paid', 'quitado', 'liberado', 'liberada'])
    .orderBy('id', 'desc')
    .first();

  const sicafStatus = sicaf
    ? resolveSicafDisplayStatus(sicaf.status, sicaf.data_validade, true)
    : 'Sem SICAF';
  const financialReleased = resolveFinancialReleased({
    hasSicaf: !!sicaf,
    sicafStatus,
    dataValidade: sicaf?.data_validade || null,
    taxaReleased: !!taxaPagaRow,
  });

  let docsOk = false;
  try {
    const certidoesService = require('./certidoes.service');
    const checklist = await certidoesService.getChecklistDocumentosAdmin(clienteId);
    if (checklist?.ok && Array.isArray(checklist.items)) {
      const total = checklist.items.length;
      const prontos = checklist.items.filter((i) => i.status === 'ok').length;
      docsOk = total > 0 && prontos / total >= 0.5;
    }
  } catch (_) {
    docsOk = false;
  }

  const nivelI = niveisMap.I;
  const nivelIII = niveisMap.III;
  const comprasNetOk =
    !!nivelI &&
    (Number(nivelI.habilitado) === 1 ||
      String(nivelI.status || '').toLowerCase() === 'validado');
  const nivelIIIOk =
    !!nivelIII &&
    (String(nivelIII.status || '').toLowerCase() === 'validado' || Number(nivelIII.habilitado) === 1);

  const protocoloSalvo = normalizeProtocolo(cliente[PROTOCOLO_COL]);

  return {
    empresa: {
      razao: maskRazaoSocial(cliente.razao_social || cliente.nome_fantasia),
      protocolo: protocoloSalvo,
    },
    checks: [
      buildCheck('Validar protocolo', 'Protocolo CADBRASIL confirmado', true),
      buildCheck(
        'Documentos',
        docsOk ? 'Documentos básicos identificados no cadastro' : 'Contrato social, balanços e declarações',
        docsOk,
      ),
      buildCheck(
        'Conectar ao ComprasNet',
        comprasNetOk ? 'Credenciamento inicial identificado' : 'Vincular cadastro ao governo federal',
        comprasNetOk,
      ),
      buildCheck(
        'Atualizar Nível III Receita Federal',
        nivelIIIOk ? 'Nível III validado ou habilitado' : 'Certificação de capacidade técnica',
        nivelIIIOk,
      ),
      buildCheck(
        'Validação de Taxa',
        financialReleased ? 'Taxa SICAF confirmada' : 'Conferência de taxas e emissões',
        financialReleased,
        'OK',
        financialReleased ? 'OK' : 'Pendente',
      ),
    ],
  };
}

async function getOnboardingDiagnostico(protocoloRaw) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const protocolo = normalizeProtocolo(protocoloRaw);
  if (protocolo.length < 6) {
    return { ok: false, error: 'Informe um protocolo válido (mínimo 6 caracteres).' };
  }

  try {
    const resolved = await resolveClienteFromProtocolo(db, protocolo);
    if (!resolved) {
      return {
        ok: false,
        error: 'Protocolo não encontrado. Verifique o número enviado pela CADBRASIL no seu e-mail.',
      };
    }

    const diagnostico = await buildDiagnosticoChecks(db, resolved.clienteId);
    if (!diagnostico) {
      return { ok: false, error: 'Cadastro não encontrado para este protocolo.' };
    }

    return {
      ok: true,
      protocolo: resolved.protocolo,
      empresa: diagnostico.empresa,
      checks: diagnostico.checks,
    };
  } catch (e) {
    console.error('[Onboarding] Erro getOnboardingDiagnostico:', e.message);
    return { ok: false, error: 'Erro ao consultar protocolo. Tente novamente em instantes.' };
  }
}

module.exports = {
  normalizeProtocolo,
  getOnboardingDiagnostico,
};
