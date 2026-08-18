/**
 * Certificado digital A1 (PFX/P12) por cliente.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');
const { spawnSync } = require('child_process');
const multer = require('multer');
const forge = require('node-forge');
const { getDb } = require('../database/connection');
const config = require('../config');

const ENC_ALGO = 'aes-256-gcm';
const DB_PATH_PREFIX = 'db://';
const PRIVATE_DIR = path.resolve(__dirname, '..', '..', 'private', 'certificados');

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.CADBRASIL_API_MODE === 'next',
  );
}

function getEncryptionKey() {
  const secret = config.jwt?.secret || process.env.JWT_SECRET || 'cadbrasil_default_secret_change_me';
  return crypto.scryptSync(secret, 'cadbrasil-certificado-digital', 32);
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(payload) {
  if (!payload) return '';
  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  if (!ivB64 || !tagB64 || !dataB64) return '';
  try {
    const decipher = crypto.createDecipheriv(ENC_ALGO, getEncryptionKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (_) {
    return '';
  }
}

function getStoredSenha(row) {
  if (!row?.senha_criptografada) return null;
  const raw = String(row.senha_criptografada);
  const decrypted = decryptSecret(raw);
  if (decrypted) return decrypted;
  return raw || null;
}

function encryptPfxBuffer(pfxBuffer) {
  return encryptSecret(pfxBuffer.toString('base64'));
}

function decryptPfxBuffer(stored) {
  if (!stored) return null;
  const b64 = decryptSecret(stored);
  if (!b64) return null;
  return Buffer.from(b64, 'base64');
}

function ensurePrivateDir() {
  if (isServerlessRuntime()) return;
  if (!fs.existsSync(PRIVATE_DIR)) {
    fs.mkdirSync(PRIVATE_DIR, { recursive: true });
  }
}

function isDbStoredPath(arquivoPath) {
  return String(arquivoPath || '').startsWith(DB_PATH_PREFIX);
}

function getClientCertPath(clienteId) {
  return path.join(PRIVATE_DIR, `cliente_${clienteId}.pfx`);
}

function loadPfxBuffer(row) {
  if (!row) return null;
  if (row.arquivo_pfx_armazenado) {
    const buf = decryptPfxBuffer(row.arquivo_pfx_armazenado);
    if (buf && buf.length > 0) return buf;
  }
  const filePath = row.arquivo_path;
  if (filePath && !isDbStoredPath(filePath) && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  const fallback = getClientCertPath(row.cliente_id);
  if (fs.existsSync(fallback)) {
    return fs.readFileSync(fallback);
  }
  return null;
}

async function resolveCertTable(db) {
  if (await db.schema.hasTable('clientes_certificados_digitais')) {
    return 'clientes_certificados_digitais';
  }
  if (await db.schema.hasTable('clientes_certificado_digital')) {
    return 'clientes_certificado_digital';
  }
  return null;
}

function extractAttribute(cert, shortName) {
  const attr = cert.subject.getField(shortName);
  return attr ? String(attr.value || '').trim() : '';
}

function extractDocumentoFromCert(cert) {
  const cn = extractAttribute(cert, 'CN') || extractAttribute(cert, 'commonName');
  const digits = cn.replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 14) return digits;
  for (const ext of cert.extensions || []) {
    if (ext.name !== 'subjectAltName' || !ext.altNames) continue;
    for (const alt of ext.altNames) {
      const altDigits = String(alt.value || '').replace(/\D/g, '');
      if (altDigits.length === 11 || altDigits.length === 14) return altDigits;
    }
  }
  return null;
}

function certStatusFromDates(validoDe, validoAte) {
  const now = new Date();
  if (validoAte && validoAte <= now) return 'expirado';
  if (validoAte && validoAte.getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000) return 'vencendo';
  return 'valido';
}

function digitsFromText(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 14) return digits;
  return null;
}

function isLegacyAlgoError(msg) {
  const m = String(msg || '').toLowerCase();
  return m.includes('unsupported') || m.includes('digital envelope') || m.includes('legacy provider');
}

function isWrongPasswordError(msg) {
  const m = String(msg || '').toLowerCase();
  if (isLegacyAlgoError(m)) return false;
  return (
    m.includes('mac verify failure') ||
    m.includes('mac verification failed') ||
    m.includes('invalid password') ||
    m.includes('bad decrypt') ||
    m.includes('senha incorreta')
  );
}

function mapForgeCert(cert) {
  const titularNome = extractAttribute(cert, 'CN') || extractAttribute(cert, 'O') || null;
  const emissor = cert.issuer.getField('CN')?.value || cert.issuer.getField('O')?.value || null;
  const validoDe = cert.validity.notBefore;
  const validoAte = cert.validity.notAfter;
  return {
    ok: true,
    certInfo: {
      titularNome,
      titularDocumento: extractDocumentoFromCert(cert),
      emissor: emissor ? String(emissor) : null,
      validoDe,
      validoAte,
      serialNumber: cert.serialNumber || null,
      status: certStatusFromDates(validoDe, validoAte),
    },
  };
}

function parseCertificateInfo(pfxBuffer, password) {
  try {
    const binary = forge.util.createBuffer(pfxBuffer.toString('binary'));
    const asn1 = forge.asn1.fromDer(binary);
    let p12;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password || '');
    } catch (e) {
      const msg = String(e.message || e).toLowerCase();
      if (msg.includes('password') || msg.includes('shroud') || msg.includes('mac')) {
        return { ok: false, error: 'Senha incorreta para este certificado.' };
      }
      return { ok: false, error: 'Arquivo PFX/P12 inválido ou corrompido.' };
    }

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certList = certBags[forge.pki.oids.certBag] || [];
    if (!certList.length || !certList[0].cert) {
      return { ok: false, error: 'Nenhum certificado encontrado no arquivo.' };
    }

    const cert = certList[0].cert;
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyList = [
      ...(keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
      ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
    ];
    if (!keyList.length || !keyList[0].key) {
      return { ok: false, error: 'Certificado sem chave privada. Envie um certificado A1 completo (.pfx/.p12).' };
    }

    return mapForgeCert(cert);
  } catch (e) {
    const msg = String(e.message || e);
    if (isWrongPasswordError(msg)) {
      return { ok: false, error: 'Senha incorreta para este certificado.' };
    }
    return { ok: false, error: 'Arquivo PFX/P12 inválido ou corrompido.' };
  }
}

function tryOpenSslPfx(pfxBuffer, password) {
  try {
    tls.createSecureContext({
      pfx: pfxBuffer,
      passphrase: password || '',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function mapX509Certificate(x509) {
  const subject = String(x509.subject || '');
  const issuer = String(x509.issuer || '');
  const cnMatch = /(?:^|,)\s*CN\s*=\s*([^,]+)/i.exec(subject);
  const issuerCn = /(?:^|,)\s*CN\s*=\s*([^,]+)/i.exec(issuer);
  const titularNome = cnMatch ? cnMatch[1].trim() : subject || null;
  const validoDe = x509.validFrom ? new Date(x509.validFrom) : null;
  const validoAte = x509.validTo ? new Date(x509.validTo) : null;
  return {
    ok: true,
    certInfo: {
      titularNome,
      titularDocumento: digitsFromText(titularNome) || digitsFromText(subject),
      emissor: issuerCn ? issuerCn[1].trim() : issuer || null,
      validoDe: validoDe && !Number.isNaN(validoDe.getTime()) ? validoDe : null,
      validoAte: validoAte && !Number.isNaN(validoAte.getTime()) ? validoAte : null,
      serialNumber: x509.serialNumber || null,
      status: certStatusFromDates(validoDe, validoAte),
    },
  };
}

function extractWithOpensslCli(pfxBuffer, password, { legacy = false } = {}) {
  const args = ['pkcs12', '-nokeys', '-clcerts', '-passin', 'env:CADBRASIL_PFX_PASS'];
  if (legacy) args.splice(1, 0, '-legacy');
  const result = spawnSync('openssl', args, {
    input: pfxBuffer,
    encoding: 'utf8',
    env: { ...process.env, CADBRASIL_PFX_PASS: String(password ?? '') },
    windowsHide: true,
    timeout: 8000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const err = String(result.stderr || result.error?.message || '');
    return { ok: false, error: err || 'openssl falhou ao ler o PFX' };
  }
  const pem = String(result.stdout || '').match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
  if (!pem) return { ok: false, error: 'openssl não retornou o certificado' };
  try {
    return mapX509Certificate(new crypto.X509Certificate(pem[0]));
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function acceptedWithoutDetails() {
  return {
    ok: true,
    certInfo: {
      titularNome: null,
      titularDocumento: null,
      emissor: null,
      validoDe: null,
      validoAte: null,
      serialNumber: null,
      status: 'valido',
    },
  };
}

function validatePfxBuffer(pfxBuffer, password) {
  if (!pfxBuffer || !Buffer.isBuffer(pfxBuffer) || pfxBuffer.length < 100) {
    return { ok: false, error: 'Arquivo inválido. Selecione um certificado .pfx ou .p12.' };
  }

  const ssl = tryOpenSslPfx(pfxBuffer, password);
  const forgeResult = parseCertificateInfo(pfxBuffer, password);
  if (forgeResult.ok) return forgeResult;

  if (ssl.ok) {
    const extracted = extractWithOpensslCli(pfxBuffer, password);
    if (extracted.ok) return extracted;
    const legacy = extractWithOpensslCli(pfxBuffer, password, { legacy: true });
    if (legacy.ok) return legacy;
    return acceptedWithoutDetails();
  }

  if (isLegacyAlgoError(ssl.error)) {
    const legacy = extractWithOpensslCli(pfxBuffer, password, { legacy: true });
    if (legacy.ok) return legacy;
    return {
      ok: false,
      error:
        'Este certificado usa um formato antigo. Exporte novamente o e-CNPJ A1 em .pfx (com a chave privada) e tente de novo.',
    };
  }

  if (isWrongPasswordError(ssl.error)) {
    return { ok: false, error: 'Senha incorreta para este certificado.' };
  }

  return {
    ok: false,
    error:
      'Não foi possível ler o certificado. Use um e-CNPJ A1 exportado em .pfx/.p12, com a senha de exportação do arquivo.',
  };
}

function mapRowToResponse(row) {
  if (!row) return null;
  const now = new Date();
  const validoAte = row.valido_ate ? new Date(row.valido_ate) : null;
  let status = row.status || 'valido';
  if (validoAte) {
    if (validoAte <= now) status = 'expirado';
    else if (validoAte.getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000) status = 'vencendo';
  }

  return {
    id: row.id,
    clienteId: row.cliente_id,
    arquivoNome: row.arquivo_nome,
    titularNome: row.titular_nome,
    titularDocumento: row.titular_documento,
    emissor: row.emissor,
    validoDe: row.valido_de,
    validoAte: row.valido_ate,
    serialNumber: row.serial_number,
    validadoEm: row.validado_em,
    status,
    cadastrado: true,
    armazenamento: row.arquivo_pfx_armazenado || isDbStoredPath(row.arquivo_path) ? 'banco' : 'disco',
  };
}

async function ensureCertificadoDigitalTable() {
  const db = getDb();
  if (!db) return;
  const has = await db.schema.hasTable('clientes_certificado_digital');
  if (!has) {
    await db.raw(`
    CREATE TABLE clientes_certificado_digital (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT NOT NULL,
      arquivo_path VARCHAR(500) NULL,
      arquivo_nome VARCHAR(255) NOT NULL,
      arquivo_pfx_armazenado MEDIUMTEXT NULL,
      senha_criptografada TEXT NOT NULL,
      titular_nome VARCHAR(255) NULL,
      titular_documento VARCHAR(20) NULL,
      emissor VARCHAR(255) NULL,
      valido_de DATE NULL,
      valido_ate DATE NULL,
      serial_number VARCHAR(120) NULL,
      validado_em DATETIME NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'valido',
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cliente_certificado (cliente_id),
      KEY idx_cert_cliente (cliente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    return;
  }

  const hasBlobCol = await db.schema.hasColumn('clientes_certificado_digital', 'arquivo_pfx_armazenado');
  if (!hasBlobCol) {
    await db.schema.alterTable('clientes_certificado_digital', (table) => {
      table.mediumText('arquivo_pfx_armazenado').nullable().after('arquivo_nome');
    });
  }
}

async function getCertificadoDigital(clienteId, options = {}) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureCertificadoDigitalTable();
  const table = await resolveCertTable(db);
  if (!table) return { ok: true, certificado: null };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  const row = await db(table).where('cliente_id', clienteId).first();
  const certificado = mapRowToResponse(row);
  if (certificado && options.includeSenha && row?.senha_criptografada) {
    certificado.senha = getStoredSenha(row);
  }
  return { ok: true, certificado };
}

async function saveCertificadoDigital(clienteId, file, senha) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureCertificadoDigitalTable();
  const table = await resolveCertTable(db);
  if (!table) return { ok: false, error: 'Tabela de certificado digital indisponível' };

  const cliente = await db('clientes').where('id', clienteId).first();
  if (!cliente) return { ok: false, error: 'Cliente não encontrado' };

  if (!file?.buffer && !file?.path) {
    return { ok: false, error: 'Envie o arquivo do certificado (.pfx ou .p12).' };
  }
  if (!senha || !String(senha).trim()) {
    return { ok: false, error: 'Informe a senha do certificado.' };
  }

  const originalName = file.originalname || file.filename || 'certificado.pfx';
  const ext = path.extname(originalName).toLowerCase();
  if (!['.pfx', '.p12'].includes(ext)) {
    return { ok: false, error: 'Formato inválido. Use arquivo .pfx ou .p12.' };
  }

  const pfxBuffer = file.buffer || fs.readFileSync(file.path);
  const validation = validatePfxBuffer(pfxBuffer, String(senha));
  if (!validation.ok) return validation;

  const useDbStorage = isServerlessRuntime();
  let arquivoPath;
  let arquivoPfxArmazenado = null;

  if (useDbStorage) {
    arquivoPath = `${DB_PATH_PREFIX}${clienteId}`;
    arquivoPfxArmazenado = encryptPfxBuffer(pfxBuffer);
  } else {
    ensurePrivateDir();
    arquivoPath = getClientCertPath(clienteId);
    fs.writeFileSync(arquivoPath, pfxBuffer);
  }

  const info = validation.certInfo;
  const payload = {
    cliente_id: clienteId,
    arquivo_path: arquivoPath,
    arquivo_nome: originalName,
    arquivo_pfx_armazenado: arquivoPfxArmazenado,
    senha_criptografada: String(senha).trim(),
    titular_nome: info.titularNome,
    titular_documento: info.titularDocumento,
    emissor: info.emissor,
    valido_de: info.validoDe ? info.validoDe.toISOString().slice(0, 10) : null,
    valido_ate: info.validoAte ? info.validoAte.toISOString().slice(0, 10) : null,
    serial_number: info.serialNumber,
    validado_em: db.fn.now(),
    status: info.status,
    updated_at: db.fn.now(),
  };

  const existing = await db(table).where('cliente_id', clienteId).first();
  if (existing) {
    await db(table).where('id', existing.id).update(payload);
  } else {
    await db(table).insert(payload);
  }

  const row = await db(table).where('cliente_id', clienteId).first();
  const certificado = mapRowToResponse(row);
  if (certificado) certificado.senha = getStoredSenha(row);
  return {
    ok: true,
    message: useDbStorage
      ? 'Certificado digital validado e salvo com sucesso (armazenamento em nuvem).'
      : 'Certificado digital validado e salvo com sucesso.',
    certificado,
    validation: {
      senhaValida: true,
      titularNome: info.titularNome,
      titularDocumento: info.titularDocumento,
      emissor: info.emissor,
      validoDe: payload.valido_de,
      validoAte: payload.valido_ate,
      status: info.status,
    },
  };
}

async function validateCertificadoDigital(clienteId, senhaInformada) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureCertificadoDigitalTable();
  const table = await resolveCertTable(db);
  if (!table) return { ok: false, error: 'Nenhum certificado digital cadastrado para este cliente.' };

  const row = await db(table).where('cliente_id', clienteId).first();
  if (!row) return { ok: false, error: 'Nenhum certificado digital cadastrado para este cliente.' };

  const senha = senhaInformada != null && String(senhaInformada).length > 0
    ? String(senhaInformada)
    : getStoredSenha(row);

  if (!senha) {
    return { ok: false, error: 'Senha do certificado não informada.' };
  }

  const pfxBuffer = loadPfxBuffer(row);
  if (!pfxBuffer) {
    return { ok: false, error: 'Arquivo do certificado não encontrado. Envie o certificado novamente.' };
  }

  const validation = validatePfxBuffer(pfxBuffer, senha);
  if (!validation.ok) return validation;

  await db(table).where('id', row.id).update({
    validado_em: db.fn.now(),
    status: validation.certInfo.status,
    updated_at: db.fn.now(),
  });

  const updated = await db(table).where('id', row.id).first();
  const certificado = mapRowToResponse(updated);
  if (certificado) certificado.senha = getStoredSenha(updated);
  return {
    ok: true,
    message: 'Certificado digital validado com sucesso.',
    certificado,
  };
}

async function getCertificadoDownload(clienteId) {
  const db = getDb();
  if (!db) return { ok: false, error: 'Banco de dados não disponível' };

  await ensureCertificadoDigitalTable();
  const table = await resolveCertTable(db);
  if (!table) return { ok: false, error: 'Certificado digital não cadastrado' };

  const row = await db(table).where('cliente_id', clienteId).first();
  if (!row) return { ok: false, error: 'Certificado digital não cadastrado' };

  const buffer = loadPfxBuffer(row);
  if (!buffer || buffer.length === 0) {
    return { ok: false, error: 'Arquivo do certificado não encontrado' };
  }

  return {
    ok: true,
    buffer,
    filename: row.arquivo_nome || `certificado_cliente_${clienteId}.pfx`,
  };
}

function parseCertificadoUpload(req, res) {
  return new Promise((resolve, reject) => {
    if (!req.get) req.get = (h) => req.headers[h.toLowerCase()];
    if (!res.status) res.status = (code) => { res.statusCode = code; return res; };
    if (!res.json) res.json = (data) => {
      res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!['.pfx', '.p12'].includes(ext)) {
          return cb(new Error('Formato inválido. Use arquivo .pfx ou .p12.'), false);
        }
        cb(null, true);
      },
    }).single('file');

    upload(req, res, (err) => {
      if (err) return reject(err);
      resolve(req.file || null);
    });
  });
}

module.exports = {
  ensureCertificadoDigitalTable,
  getCertificadoDigital,
  saveCertificadoDigital,
  validateCertificadoDigital,
  validatePfxBuffer,
  parseCertificadoUpload,
  getCertificadoDownload,
  loadPfxBuffer,
};
