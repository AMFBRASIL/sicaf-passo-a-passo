/**
 * Configuração NFS-e Nacional — lê configuracoes_sistema com fallback para .env.
 * Runtime usado por nfse.service / nfse-fiscal.service.
 */
const fs = require('fs');
const { getDb } = require('../database/connection');

const NFSE_KEYS = [
  'nfse_enabled',
  'nfse_ambiente',
  'nfse_cert_pfx_path',
  'nfse_cert_pfx_password',
  'nfse_cert_pfx_base64',
  'nfse_prestador_cnpj',
  'nfse_c_mun_emi',
  'nfse_serie',
  'nfse_im_prestador',
  'nfse_incluir_im',
  'nfse_prestador_email',
  'nfse_prestador_fone',
  'nfse_ctrib_nac',
  'nfse_ctrib_mun',
  'nfse_cnbs',
  'nfse_op_simp_nac',
  'nfse_reg_ap_trib_sn',
  'nfse_reg_esp_trib',
  'nfse_p_tot_trib_sn',
  'nfse_cst',
  'nfse_tp_ret_pis_cofins',
  'nfse_tomador_ibge_padrao',
  'nfse_sefin_url',
  'nfse_adn_contribuintes_url',
  'nfse_danfse_url',
];

const SECRET_KEYS = new Set(['nfse_cert_pfx_password', 'nfse_cert_pfx_base64']);
const MASK = '__UNCHANGED__';

const DEFAULTS = {
  nfse_enabled: 'true',
  nfse_ambiente: 'producaorestrita',
  nfse_cert_pfx_path: '',
  nfse_cert_pfx_password: '',
  nfse_cert_pfx_base64: '',
  nfse_prestador_cnpj: '52841613000155',
  nfse_c_mun_emi: '3550308',
  nfse_serie: '1',
  nfse_im_prestador: '',
  nfse_incluir_im: 'false',
  nfse_prestador_email: 'PROMAUTONE@GMAIL.COM',
  nfse_prestador_fone: '1184401158',
  nfse_ctrib_nac: '010501',
  nfse_ctrib_mun: '001',
  nfse_cnbs: '111032200',
  nfse_op_simp_nac: '3',
  nfse_reg_ap_trib_sn: '1',
  nfse_reg_esp_trib: '0',
  nfse_p_tot_trib_sn: '6',
  nfse_cst: '00',
  nfse_tp_ret_pis_cofins: '0',
  nfse_tomador_ibge_padrao: '3550308',
  nfse_sefin_url: '',
  nfse_adn_contribuintes_url: '',
  nfse_danfse_url: '',
};

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 30 * 1000;

function envFallback() {
  return {
    nfse_enabled: process.env.NFSE_ENABLED !== 'false' ? 'true' : 'false',
    nfse_ambiente: process.env.NFSE_AMBIENTE || DEFAULTS.nfse_ambiente,
    nfse_cert_pfx_path: process.env.NFSE_CERT_PFX_PATH || process.env.CERT_PFX_PATH || '',
    nfse_cert_pfx_password: process.env.NFSE_CERT_PFX_PASSWORD || process.env.CERT_PFX_PASSWORD || '',
    nfse_cert_pfx_base64: process.env.NFSE_CERT_PFX_BASE64 || '',
    nfse_prestador_cnpj: process.env.NFSE_PRESTADOR_CNPJ || process.env.NFSE_SP_CNPJ_PRESTADOR || DEFAULTS.nfse_prestador_cnpj,
    nfse_c_mun_emi: process.env.NFSE_C_MUN_EMI || DEFAULTS.nfse_c_mun_emi,
    nfse_serie: process.env.NFSE_SERIE || DEFAULTS.nfse_serie,
    nfse_im_prestador: process.env.NFSE_IM_PRESTADOR || process.env.NFSE_SP_INSCRICAO_MUNICIPAL || '',
    nfse_incluir_im: process.env.NFSE_INCLUIR_IM === 'true' ? 'true' : 'false',
    nfse_prestador_email: process.env.NFSE_PRESTADOR_EMAIL || DEFAULTS.nfse_prestador_email,
    nfse_prestador_fone: process.env.NFSE_PRESTADOR_FONE || DEFAULTS.nfse_prestador_fone,
    nfse_ctrib_nac: process.env.NFSE_CTRIB_NAC || DEFAULTS.nfse_ctrib_nac,
    nfse_ctrib_mun: process.env.NFSE_CTRIB_MUN || DEFAULTS.nfse_ctrib_mun,
    nfse_cnbs: process.env.NFSE_CNBS || DEFAULTS.nfse_cnbs,
    nfse_op_simp_nac: process.env.NFSE_OP_SIMP_NAC || DEFAULTS.nfse_op_simp_nac,
    nfse_reg_ap_trib_sn: process.env.NFSE_REG_AP_TRIB_SN || DEFAULTS.nfse_reg_ap_trib_sn,
    nfse_reg_esp_trib: process.env.NFSE_REG_ESP_TRIB || DEFAULTS.nfse_reg_esp_trib,
    nfse_p_tot_trib_sn: process.env.NFSE_P_TOT_TRIB_SN || DEFAULTS.nfse_p_tot_trib_sn,
    nfse_cst: process.env.NFSE_CST || DEFAULTS.nfse_cst,
    nfse_tp_ret_pis_cofins: process.env.NFSE_TP_RET_PIS_COFINS || DEFAULTS.nfse_tp_ret_pis_cofins,
    nfse_tomador_ibge_padrao: process.env.NFSE_TOMADOR_IBGE_PADRAO || process.env.NFSE_SP_TOMADOR_IBGE_PADRAO || DEFAULTS.nfse_tomador_ibge_padrao,
    nfse_sefin_url: process.env.NFSE_SEFIN_URL || '',
    nfse_adn_contribuintes_url: process.env.NFSE_ADN_CONTRIBUINTES_URL || '',
    nfse_danfse_url: process.env.NFSE_DANFSE_URL || '',
  };
}

async function loadRawFromDb() {
  const db = getDb();
  if (!db) return {};
  try {
    const has = await db.schema.hasTable('configuracoes_sistema');
    if (!has) return {};
    const rows = await db('configuracoes_sistema').whereIn('chave', NFSE_KEYS);
    const raw = {};
    for (const row of rows) raw[row.chave] = row.valor ?? '';
    return raw;
  } catch (_) {
    return {};
  }
}

function hasDbValue(raw, key) {
  return raw[key] != null && String(raw[key]).trim() !== '';
}

function mergeRuntime(raw, env) {
  const out = { ...DEFAULTS, ...env };
  for (const key of NFSE_KEYS) {
    if (hasDbValue(raw, key)) out[key] = String(raw[key]);
  }
  return out;
}

function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

async function getNfseRuntime(force = false) {
  const now = Date.now();
  if (!force && _cache && now - _cacheTime < CACHE_TTL) return _cache;
  const env = envFallback();
  const raw = await loadRawFromDb();
  const merged = mergeRuntime(raw, env);
  _cache = {
    ...merged,
    _meta: {
      configSource: Object.keys(raw).some((k) => hasDbValue(raw, k)) ? 'database' : 'env',
      hasDbSecrets: [...SECRET_KEYS].some((k) => hasDbValue(raw, k)),
    },
  };
  _cacheTime = now;
  return _cache;
}

function getAmbienteFromRuntime(rt) {
  const raw = String(rt.nfse_ambiente || 'producaorestrita').toLowerCase().trim();
  if (raw === 'producao' || raw === 'prod' || raw === 'production') return 'producao';
  return 'producaorestrita';
}

function toPublicSettings(rt) {
  const out = {};
  for (const key of NFSE_KEYS) {
    if (SECRET_KEYS.has(key)) {
      out[key] = rt[key] ? MASK : '';
    } else {
      out[key] = rt[key] ?? '';
    }
  }
  return out;
}

async function getNfseSettings() {
  const rt = await getNfseRuntime(true);
  const ambiente = getAmbienteFromRuntime(rt);
  const certConfigured = Boolean(
    (rt.nfse_cert_pfx_path && fs.existsSync(rt.nfse_cert_pfx_path)) || rt.nfse_cert_pfx_base64,
  );
  return {
    ok: true,
    settings: toPublicSettings(rt),
    status: {
      configured: certConfigured && rt.nfse_enabled !== 'false',
      enabled: rt.nfse_enabled !== 'false',
      ambiente,
      configSource: rt._meta?.configSource || 'env',
      certificadoConfigurado: certConfigured,
      certPathInformado: Boolean(rt.nfse_cert_pfx_path),
      certPathExiste: Boolean(rt.nfse_cert_pfx_path && fs.existsSync(rt.nfse_cert_pfx_path)),
      prestadorCnpj: rt.nfse_prestador_cnpj || '',
      cTribNac: rt.nfse_ctrib_nac || '',
    },
  };
}

async function updateNfseSettings(updates) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  const allowed = {};
  for (const key of NFSE_KEYS) {
    if (updates[key] !== undefined) allowed[key] = updates[key];
  }

  let updatedCount = 0;
  for (const [chave, rawValor] of Object.entries(allowed)) {
    let valor = rawValor == null ? '' : String(rawValor);
    if (SECRET_KEYS.has(chave)) valor = valor.trim();
    if (SECRET_KEYS.has(chave) && (!valor || valor === MASK)) continue;

    const existing = await db('configuracoes_sistema').where({ chave }).first();
    if (existing) {
      await db('configuracoes_sistema').where({ chave }).update({
        valor,
        categoria: 'fiscal',
        tipo_valor: SECRET_KEYS.has(chave) ? 'secret' : 'string',
        updated_at: db.fn.now(),
      });
    } else {
      await db('configuracoes_sistema').insert({
        chave,
        valor,
        categoria: 'fiscal',
        descricao: '',
        tipo_valor: SECRET_KEYS.has(chave) ? 'secret' : 'string',
      });
    }
    updatedCount += 1;
  }

  invalidateCache();
  return {
    ok: true,
    updated: updatedCount,
    message: `${updatedCount} configuração(ões) fiscal(is) atualizada(s)`,
  };
}

async function testNfseSettings() {
  const rt = await getNfseRuntime(true);
  if (rt.nfse_enabled === 'false') {
    return { ok: false, error: 'NFS-e está desabilitada (nfse_enabled=false).' };
  }

  let pfxBuffer = null;
  if (rt.nfse_cert_pfx_base64) {
    try {
      pfxBuffer = Buffer.from(rt.nfse_cert_pfx_base64, 'base64');
    } catch (_) {
      return { ok: false, error: 'nfse_cert_pfx_base64 inválido' };
    }
  } else if (rt.nfse_cert_pfx_path) {
    if (!fs.existsSync(rt.nfse_cert_pfx_path)) {
      return { ok: false, error: `Arquivo PFX não encontrado: ${rt.nfse_cert_pfx_path}` };
    }
    pfxBuffer = fs.readFileSync(rt.nfse_cert_pfx_path);
  } else {
    return { ok: false, error: 'Informe o caminho do PFX ou o Base64 do certificado.' };
  }

  try {
    const nfse = require('./nfse.service');
    await nfse.refreshRuntime(true);

    const forge = require('node-forge');
    const der = forge.util.createBuffer(pfxBuffer.toString('binary'));
    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, String(rt.nfse_cert_pfx_password || ''));
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
    if (!certBag?.cert) return { ok: false, error: 'Não foi possível ler o certificado do PFX (senha?)' };

    const cn = certBag.cert.subject.getField('CN')?.value || '—';
    const notAfter = certBag.cert.validity.notAfter;
    const ambiente = getAmbienteFromRuntime(rt);
    const urls = nfse.getBaseUrls(ambiente);

    const ping = await nfse.mtlsRequest(`${urls.sefin}/swagger/docs/v1`, {
      method: 'GET',
      credentials: {
        pfxBuffer,
        passphrase: String(rt.nfse_cert_pfx_password || ''),
      },
    });

    return {
      ok: true,
      message: `Certificado OK (${cn}). SEFIN respondeu HTTP ${ping.status}. Ambiente: ${ambiente}.`,
      status: ping.status,
      ambiente,
      sefin: urls.sefin,
      certificado: {
        cn,
        validoAte: notAfter ? notAfter.toISOString?.() || String(notAfter) : null,
      },
    };
  } catch (e) {
    return { ok: false, error: e.message || 'Falha no teste NFS-e' };
  }
}

module.exports = {
  NFSE_KEYS,
  SECRET_KEYS,
  MASK,
  DEFAULTS,
  getNfseRuntime,
  getAmbienteFromRuntime,
  getNfseSettings,
  updateNfseSettings,
  testNfseSettings,
  invalidateCache,
  envFallback,
};
