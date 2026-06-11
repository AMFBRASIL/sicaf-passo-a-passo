/**
 * Serviço central de Armazenamento — ponto único de entrada para todo o projeto.
 *
 * Configuração: configuracoes_sistema (categoria armazenamento), com fallback STORAGE_* no .env.
 * Implementação interna: storage-config.service.js (não importar diretamente fora deste arquivo).
 *
 * Uso:
 *   const storage = require('./services/storage.service');
 *   storage.init();
 *   if (!(await storage.isReady())) return { ok: false, error: 'Storage não configurado' };
 *   const result = await storage.uploadFile(file, req, 'documentos');
 *   await storage.deleteFile(url, req);
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const storageConfig = require('./storage-config.service');

const LOG_PREFIX = '[StorageService]';
const log = (msg, detail) => {
  const d = detail != null ? ` | ${typeof detail === 'object' ? JSON.stringify(detail) : detail}` : '';
  console.log(`${LOG_PREFIX} ${msg}${d}`);
};

function generateFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}_${hash}${ext}`;
}

function validateExtension(originalName, allowed) {
  if (!allowed || allowed.length === 0) return true;
  const ext = path.extname(originalName).replace('.', '').toLowerCase();
  return allowed.includes(ext);
}

function validateSize(sizeBytes, maxFileSizeMb) {
  const maxBytes = maxFileSizeMb * 1024 * 1024;
  return sizeBytes <= maxBytes;
}

function serverRoot() {
  return config.paths.root;
}

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.CADBRASIL_API_MODE === 'next',
  );
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getWritableStorageRoot() {
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), 'cadbrasil-storage');
  }
  return serverRoot();
}

function getMulterTempDir() {
  return path.join(getWritableStorageRoot(), 'uploads', '_temp');
}

async function resolveLocalUploadDir(folder = '', runtime) {
  const rt = runtime || (await storageConfig.getStorageRuntime());
  return storageConfig.resolveLocalUploadDir(rt, folder);
}

/** Resolve caminho físico seguro a partir de URL pública /uploads/... */
function resolvePublicFilePath(publicUrlPath) {
  const safe = decodeURIComponent(String(publicUrlPath || '')).replace(/\.\./g, '');
  const clean = safe.startsWith('/') ? safe.slice(1) : safe;
  const fullPath = path.resolve(serverRoot(), clean);
  const root = path.resolve(serverRoot());
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/** Adapta Request do Next/fetch para o formato usado em uploadFile (host/protocol). */
function adaptWebRequest(request) {
  if (!request?.url) return null;
  try {
    const url = new URL(request.url);
    return {
      protocol: url.protocol.replace(':', ''),
      get: (name) => {
        if (typeof request.headers?.get === 'function') {
          return request.headers.get(name) || request.headers.get(name.toLowerCase()) || '';
        }
        return '';
      },
    };
  } catch {
    return null;
  }
}

/** Monta objeto compatível com multer a partir de buffer (rotas Next.js). */
function fileFromBuffer({ buffer, originalName, mimetype }) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return {
    buffer: buf,
    originalname: originalName || 'arquivo',
    mimetype: mimetype || 'application/octet-stream',
    size: buf.length,
    path: null,
  };
}

let _s3Client = null;

async function getS3Client() {
  if (_s3Client) return _s3Client;

  const { S3Client } = require('@aws-sdk/client-s3');
  const cfg = await storageConfig.getStorageRuntime();

  if (!cfg.s3AccessKeyId || !cfg.s3SecretAccessKey) {
    throw new Error('S3 Access Key / Secret não configurados (banco ou .env)');
  }

  const clientOpts = {
    region: cfg.s3Region,
    credentials: {
      accessKeyId: cfg.s3AccessKeyId,
      secretAccessKey: cfg.s3SecretAccessKey,
    },
  };

  if (cfg.s3Endpoint) clientOpts.endpoint = cfg.s3Endpoint;
  if (cfg.s3UsePathStyle) clientOpts.forcePathStyle = true;

  _s3Client = new S3Client(clientOpts);
  log('S3 Client inicializado', {
    region: cfg.s3Region,
    bucket: cfg.s3Bucket,
    endpoint: cfg.s3Endpoint || 'AWS default',
    pathStyle: cfg.s3UsePathStyle,
  });
  return _s3Client;
}

function resetS3Client() {
  _s3Client = null;
  log('S3 Client resetado');
}

async function uploadFile(file, req, folder = 'general') {
  const cfg = await storageConfig.getStorageRuntime();
  log('═══════════════════════════════════════════');
  log('INICIANDO UPLOAD', { original: file.originalname, folder, provider: cfg.provider });

  if (!validateExtension(file.originalname, cfg.allowedExtensions)) {
    cleanupTempFile(file.path);
    throw new Error(
      `Extensão não permitida: ${path.extname(file.originalname)}. Permitidas: ${cfg.allowedExtensions.join(', ')}`,
    );
  }
  if (!validateSize(file.size, cfg.maxFileSizeMb)) {
    cleanupTempFile(file.path);
    throw new Error(`Arquivo excede o tamanho máximo de ${cfg.maxFileSizeMb}MB`);
  }

  if (cfg.provider === 's3') {
    log('Provider: S3');
    return await _uploadToS3(file, req, folder, cfg);
  }

  log('Provider: LOCAL');
  return await _uploadToLocal(file, req, folder, cfg);
}

async function uploadFiles(files, req, folder = 'general') {
  return Promise.all(files.map((f) => uploadFile(f, req, folder)));
}

async function _uploadToLocal(file, req, folder, cfg) {
  const uploadDir = await resolveLocalUploadDir(folder, cfg);
  ensureDir(uploadDir);

  const filename = generateFilename(file.originalname);
  const destPath = path.join(uploadDir, filename);

  if (file.path && fs.existsSync(file.path)) {
    fs.renameSync(file.path, destPath);
  } else if (file.buffer) {
    fs.writeFileSync(destPath, file.buffer);
  }

  const baseUrl = cfg.localBaseUrl.endsWith('/') ? cfg.localBaseUrl.slice(0, -1) : cfg.localBaseUrl;
  const fileUrl = `${baseUrl}/${folder}/${filename}`;

  let fullUrl;
  if (cfg.cdnUrl) {
    const cleanCdn = cfg.cdnUrl.endsWith('/') ? cfg.cdnUrl.slice(0, -1) : cfg.cdnUrl;
    fullUrl = `${cleanCdn}${fileUrl}`;
  } else {
    const host = req ? `${req.protocol}://${req.get('host')}` : `http://localhost:${config.port}`;
    fullUrl = `${host}${fileUrl}`;
  }

  const result = {
    url: fileUrl,
    fullUrl,
    filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
  };

  log('Upload LOCAL concluído', { filename, folder, url: fileUrl });
  log('═══════════════════════════════════════════');
  return result;
}

async function _uploadToS3(file, req, folder, cfg) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');

  if (!cfg.s3Bucket) {
    throw new Error('Bucket S3 não configurado (storage_s3_bucket no banco ou STORAGE_S3_BUCKET no .env)');
  }

  const s3 = await getS3Client();
  const filename = generateFilename(file.originalname);
  const s3Key = `${folder}/${filename}`;

  let fileBody;
  if (file.buffer) {
    fileBody = file.buffer;
  } else if (file.path && fs.existsSync(file.path)) {
    fileBody = fs.readFileSync(file.path);
  } else {
    throw new Error('Arquivo sem conteúdo (nem buffer nem path)');
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.s3Bucket,
      Key: s3Key,
      Body: fileBody,
      ContentType: file.mimetype,
    }),
  );

  cleanupTempFile(file.path);

  const fileUrl = `/${s3Key}`;
  let fullUrl;

  if (cfg.cdnUrl) {
    const cleanCdn = cfg.cdnUrl.endsWith('/') ? cfg.cdnUrl.slice(0, -1) : cfg.cdnUrl;
    fullUrl = `${cleanCdn}/${s3Key}`;
  } else if (cfg.s3Endpoint) {
    const cleanEndpoint = cfg.s3Endpoint.endsWith('/') ? cfg.s3Endpoint.slice(0, -1) : cfg.s3Endpoint;
    fullUrl = cfg.s3UsePathStyle
      ? `${cleanEndpoint}/${cfg.s3Bucket}/${s3Key}`
      : `${cleanEndpoint}/${s3Key}`;
  } else {
    fullUrl =
      cfg.s3Region === 'us-east-1'
        ? `https://${cfg.s3Bucket}.s3.amazonaws.com/${s3Key}`
        : `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${s3Key}`;
  }

  const result = {
    url: fileUrl,
    fullUrl,
    filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
  };

  log('Upload S3 concluído', { bucket: cfg.s3Bucket, key: s3Key, fullUrl });
  log('═══════════════════════════════════════════');
  return result;
}

async function deleteFile(fileUrl, req) {
  const cfg = await storageConfig.getStorageRuntime();
  log('═══════════════════════════════════════════');
  log('INICIANDO DELEÇÃO', { fileUrl, provider: cfg.provider });

  if (!fileUrl) {
    log('URL vazia, nada a deletar');
    return false;
  }

  const provider = cfg.provider;

  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    if (provider === 's3') return await _deleteFromS3ByUrl(fileUrl, cfg);
    try {
      const urlObj = new URL(fileUrl);
      return await _deleteFromLocal(urlObj.pathname);
    } catch {
      return await _deleteFromLocal(fileUrl);
    }
  }

  if (provider === 's3') {
    const s3Key = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
    return await _deleteFromS3ByKey(s3Key, cfg);
  }

  return await _deleteFromLocal(fileUrl);
}

async function _deleteFromLocal(fileUrl) {
  try {
    const fullPath = resolvePublicFilePath(fileUrl);
    if (!fullPath || !fs.existsSync(fullPath)) {
      log('Arquivo não encontrado para deleção', fileUrl);
      return false;
    }

    fs.unlinkSync(fullPath);
    log('Arquivo LOCAL deletado', fullPath);
    log('═══════════════════════════════════════════');
    return true;
  } catch (err) {
    log('Erro ao deletar arquivo local', err.message);
    log('═══════════════════════════════════════════');
    return false;
  }
}

async function _deleteFromS3ByUrl(fileUrl, cfg) {
  try {
    const urlObj = new URL(fileUrl);
    let key;

    if (cfg.s3UsePathStyle && cfg.s3Endpoint) {
      const parts = urlObj.pathname.split('/').filter(Boolean);
      key = parts.slice(1).join('/');
    } else if (urlObj.hostname.includes('.s3.') || urlObj.hostname.includes('.s3-')) {
      key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    } else {
      key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    }

    return await _deleteFromS3ByKey(key, cfg);
  } catch (err) {
    log('Erro ao extrair key S3 da URL', err.message);
    return false;
  }
}

async function _deleteFromS3ByKey(key, cfg) {
  try {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

    if (!cfg.s3Bucket) throw new Error('Bucket S3 não configurado (banco ou .env)');

    const s3 = await getS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: cfg.s3Bucket, Key: key }));
    log('Arquivo S3 deletado', { key });
    return true;
  } catch (err) {
    log('Erro ao deletar do S3', err.message);
    return false;
  }
}

function getMulterUpload() {
  const tempDir = getMulterTempDir();
  ensureDir(tempDir);
  const envCfg = storageConfig.getStorageRuntimeFromEnv();

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempDir),
    filename: (_req, file, cb) => cb(null, generateFilename(file.originalname)),
  });

  return multer({
    storage,
    limits: { fileSize: envCfg.maxFileSizeMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!validateExtension(file.originalname, envCfg.allowedExtensions)) {
        return cb(new Error(`Extensão não permitida: ${path.extname(file.originalname)}`), false);
      }
      cb(null, true);
    },
  });
}

function cleanupTempFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

async function getStorageInfo() {
  const cfg = await storageConfig.getStorageRuntime();
  const info = {
    provider: cfg.provider,
    uiProvider: cfg.uiProvider,
    maxFileSizeMb: cfg.maxFileSizeMb,
    allowedExtensions: cfg.allowedExtensions,
    retencaoMeses: cfg.retencaoMeses,
    versoesPorArquivo: cfg.versoesPorArquivo,
    versionamentoAtivo: cfg.versionamentoAtivo,
    configSource: cfg.configSource,
  };

  if (cfg.provider === 's3') {
    info.s3Bucket = cfg.s3Bucket;
    info.s3Region = cfg.s3Region;
    info.s3Endpoint = cfg.s3Endpoint || 'AWS default';
    info.s3UsePathStyle = cfg.s3UsePathStyle;
    info.cdnUrl = cfg.cdnUrl || null;
    info.hasCredentials = !!(cfg.s3AccessKeyId && cfg.s3SecretAccessKey);
  } else {
    info.localPath = cfg.localPath;
    info.localBaseUrl = cfg.localBaseUrl;
    info.localFullPath = await resolveLocalUploadDir('', cfg);
    info.serverless = isServerlessRuntime();
  }

  try {
    info.usage = await storageConfig.getStorageUsage();
  } catch (_) {}

  return info;
}

function ensureLocalDirs() {
  const cfg = storageConfig.getStorageRuntimeFromEnv();
  if (cfg.provider === 'local') {
    const dir = storageConfig.resolveLocalUploadDir(cfg);
    ensureDir(dir);
    ensureDir(getMulterTempDir());
    log('Diretórios de upload prontos', dir);
  }
}

/** Pré-carrega config do banco e garante pastas locais. */
function init() {
  ensureLocalDirs();
  void storageConfig.getStorageRuntime();
}

async function getRuntime(forceRefresh = false) {
  return storageConfig.getStorageRuntime(forceRefresh);
}

async function getUsage(forceRefresh = false) {
  return storageConfig.getStorageUsage(forceRefresh);
}

async function isReady(forceRefresh = false) {
  const rt = await getRuntime(forceRefresh);
  if (rt.provider === 's3') {
    return !!(rt.s3Bucket && rt.s3AccessKeyId && rt.s3SecretAccessKey);
  }
  return true;
}

async function getStatus(forceRefresh = false) {
  const rt = await getRuntime(forceRefresh);
  const ready = await isReady(forceRefresh);
  let usage = null;
  try {
    usage = await getUsage(forceRefresh);
  } catch (_) {}
  return {
    ok: true,
    configured: ready,
    ready,
    provider: rt.uiProvider || rt.provider,
    runtimeProvider: rt.provider,
    configSource: rt.configSource || 'env',
    maxFileSizeMb: rt.maxFileSizeMb,
    usage,
  };
}

function invalidateCache() {
  storageConfig.invalidateStorageConfigCache();
  resetS3Client();
}

async function testConnection() {
  invalidateCache();
  return storageConfig.testStorageConnection();
}

module.exports = {
  init,
  getRuntime,
  getUsage,
  isReady,
  getStatus,
  invalidateCache,
  testConnection,
  STORAGE_KEYS: storageConfig.STORAGE_KEYS,
  DEFAULTS: storageConfig.DEFAULTS,
  loadRawFromDb: storageConfig.loadRawFromDb,
  hasDbS3Secret: storageConfig.hasDbS3Secret,
  envFallback: storageConfig.envFallback,
  uploadFile,
  uploadFiles,
  deleteFile,
  getMulterUpload,
  getStorageInfo,
  ensureLocalDirs,
  resetS3Client,
  adaptWebRequest,
  fileFromBuffer,
  resolvePublicFilePath,
  getMimeType,
  generateFilename,
  validateExtension,
  validateSize,
};
