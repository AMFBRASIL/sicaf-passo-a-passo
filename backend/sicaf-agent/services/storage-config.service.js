/**
 * Configuração de armazenamento — lê configuracoes_sistema com fallback para .env.
 *
 * Uso interno apenas. Todo o projeto deve importar `./services/storage.service`.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { getDb } = require('../database/connection');

const STORAGE_KEYS = [
  'storage_provedor',
  'storage_local_path',
  'storage_local_base_url',
  'storage_s3_bucket',
  'storage_s3_region',
  'storage_s3_access_key_id',
  'storage_s3_secret_access_key',
  'storage_s3_endpoint',
  'storage_s3_use_path_style',
  'storage_cdn_url',
  'storage_max_file_size_mb',
  'storage_allowed_extensions',
  'storage_retencao_meses',
  'storage_versoes_por_arquivo',
  'storage_versionamento_ativo',
  'storage_mover_frio',
  'storage_frio_dias',
  'storage_excluir_apos_retencao',
  'storage_quota_gb',
];

const SECRET_KEYS = new Set(['storage_s3_secret_access_key']);

const DEFAULTS = {
  storage_provedor: 'lovable_cloud',
  storage_local_path: 'uploads',
  storage_local_base_url: '/uploads',
  storage_s3_bucket: '',
  storage_s3_region: 'us-east-1',
  storage_s3_access_key_id: '',
  storage_s3_secret_access_key: '',
  storage_s3_endpoint: '',
  storage_s3_use_path_style: 'false',
  storage_cdn_url: '',
  storage_max_file_size_mb: '10',
  storage_allowed_extensions: 'jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv,zip,rar,xml',
  storage_retencao_meses: '60',
  storage_versoes_por_arquivo: '5',
  storage_versionamento_ativo: 'true',
  storage_mover_frio: 'false',
  storage_frio_dias: '180',
  storage_excluir_apos_retencao: 'false',
  storage_quota_gb: '500',
};

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60 * 1000;

function mapEnvProvider(raw) {
  const p = String(raw || 'local').toLowerCase();
  return p === 's3' ? 's3' : 'lovable_cloud';
}

function envFallback() {
  const st = config.storage || {};
  return {
    storage_provedor: mapEnvProvider(st.provider),
    storage_local_path: st.localPath || DEFAULTS.storage_local_path,
    storage_local_base_url: st.localBaseUrl || DEFAULTS.storage_local_base_url,
    storage_s3_bucket: st.s3Bucket || '',
    storage_s3_region: st.s3Region || DEFAULTS.storage_s3_region,
    storage_s3_access_key_id: st.s3AccessKeyId || '',
    storage_s3_secret_access_key: st.s3SecretAccessKey || '',
    storage_s3_endpoint: st.s3Endpoint || '',
    storage_s3_use_path_style: st.s3UsePathStyle ? 'true' : 'false',
    storage_cdn_url: st.cdnUrl || '',
    storage_max_file_size_mb: String(st.maxFileSizeMb || DEFAULTS.storage_max_file_size_mb),
    storage_allowed_extensions: (st.allowedExtensions || []).join(',') || DEFAULTS.storage_allowed_extensions,
    storage_retencao_meses: DEFAULTS.storage_retencao_meses,
    storage_versoes_por_arquivo: DEFAULTS.storage_versoes_por_arquivo,
    storage_versionamento_ativo: DEFAULTS.storage_versionamento_ativo,
    storage_mover_frio: DEFAULTS.storage_mover_frio,
    storage_frio_dias: DEFAULTS.storage_frio_dias,
    storage_excluir_apos_retencao: DEFAULTS.storage_excluir_apos_retencao,
    storage_quota_gb: DEFAULTS.storage_quota_gb,
  };
}

async function loadRawFromDb() {
  const db = getDb();
  if (!db) return {};
  const rows = await db('configuracoes_sistema').whereIn('chave', STORAGE_KEYS);
  const raw = {};
  for (const row of rows) raw[row.chave] = row.valor ?? '';
  return raw;
}

function hasDbValue(raw, key) {
  return raw[key] != null && String(raw[key]).trim() !== '';
}

function hasDbS3Secret(raw) {
  return hasDbValue(raw, 'storage_s3_secret_access_key');
}

function resolveConfigSource(raw, merged) {
  const dbKeys = STORAGE_KEYS.filter((k) => hasDbValue(raw, k));
  if (dbKeys.length >= 3) return 'database';
  if (merged.storage_s3_access_key_id || merged.storage_s3_bucket) return 'env';
  return dbKeys.length ? 'database' : 'env';
}

function mergeSettings(raw) {
  const env = envFallback();
  const merged = { ...DEFAULTS };
  for (const key of STORAGE_KEYS) {
    if (SECRET_KEYS.has(key)) continue;
    if (hasDbValue(raw, key)) {
      merged[key] = String(raw[key]);
    } else if (env[key] != null && String(env[key]).trim() !== '') {
      merged[key] = String(env[key]);
    }
  }
  if (hasDbS3Secret(raw)) {
    merged.storage_s3_secret_access_key = String(raw.storage_s3_secret_access_key).trim();
  } else if (env.storage_s3_secret_access_key) {
    merged.storage_s3_secret_access_key = env.storage_s3_secret_access_key;
  }
  return merged;
}

function toRuntime(merged) {
  const provedor = merged.storage_provedor === 's3' ? 's3' : 'local';
  const allowedExtensions = String(merged.storage_allowed_extensions || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return {
    provider: provedor,
    uiProvider: merged.storage_provedor || 'lovable_cloud',
    localPath: merged.storage_local_path || 'uploads',
    localBaseUrl: merged.storage_local_base_url || '/uploads',
    s3Bucket: merged.storage_s3_bucket || '',
    s3Region: merged.storage_s3_region || 'us-east-1',
    s3AccessKeyId: merged.storage_s3_access_key_id || '',
    s3SecretAccessKey: merged.storage_s3_secret_access_key || '',
    s3Endpoint: merged.storage_s3_endpoint || '',
    s3UsePathStyle: merged.storage_s3_use_path_style === 'true',
    cdnUrl: merged.storage_cdn_url || '',
    maxFileSizeMb: parseInt(merged.storage_max_file_size_mb || '10', 10) || 10,
    allowedExtensions,
    retencaoMeses: parseInt(merged.storage_retencao_meses || '60', 10) || 60,
    versoesPorArquivo: parseInt(merged.storage_versoes_por_arquivo || '5', 10) || 5,
    versionamentoAtivo: merged.storage_versionamento_ativo !== 'false',
    moverFrio: merged.storage_mover_frio === 'true',
    frioDias: parseInt(merged.storage_frio_dias || '180', 10) || 180,
    excluirAposRetencao: merged.storage_excluir_apos_retencao === 'true',
    quotaGb: parseFloat(merged.storage_quota_gb || '500') || 500,
  };
}

async function getStorageRuntime(forceRefresh = false) {
  if (!forceRefresh && _cache && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache;
  }
  const raw = await loadRawFromDb();
  const merged = mergeSettings(raw);
  const runtime = toRuntime(merged);
  runtime.configSource = resolveConfigSource(raw, merged);
  _cache = runtime;
  _cacheTime = Date.now();
  return _cache;
}

function getStorageRuntimeFromEnv() {
  const merged = mergeSettings({});
  return toRuntime(merged);
}

function invalidateStorageConfigCache() {
  _cache = null;
  _cacheTime = 0;
}

function dirSizeBytes(dir) {
  if (!dir || !fs.existsSync(dir)) return 0;
  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    try {
      if (ent.isDirectory()) total += dirSizeBytes(full);
      else if (ent.isFile()) total += fs.statSync(full).size;
    } catch (_) {}
  }
  return total;
}

function resolveLocalUploadDir(runtime, folder = '') {
  const rel = String(runtime.localPath || 'uploads').replace(/^\.\//, '');
  const os = require('os');
  const isServerless = Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.CADBRASIL_API_MODE === 'next',
  );
  const root = isServerless
    ? path.join(os.tmpdir(), 'cadbrasil-storage')
    : config.paths.root;
  const base = path.join(root, rel);
  return folder ? path.join(base, folder) : base;
}

async function sumS3Usage(runtime) {
  if (!runtime.s3Bucket || !runtime.s3AccessKeyId || !runtime.s3SecretAccessKey) {
    return { bytes: 0, objects: 0, partial: true };
  }
  try {
    const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const clientOpts = {
      region: runtime.s3Region,
      credentials: {
        accessKeyId: runtime.s3AccessKeyId,
        secretAccessKey: runtime.s3SecretAccessKey,
      },
    };
    if (runtime.s3Endpoint) clientOpts.endpoint = runtime.s3Endpoint;
    if (runtime.s3UsePathStyle) clientOpts.forcePathStyle = true;
    const s3 = new S3Client(clientOpts);

    let bytes = 0;
    let objects = 0;
    let token;
    do {
      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: runtime.s3Bucket,
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      );
      for (const obj of resp.Contents || []) {
        bytes += obj.Size || 0;
        objects += 1;
      }
      token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (token);

    return { bytes, objects, partial: false };
  } catch (e) {
    return { bytes: 0, objects: 0, partial: true, error: e.message };
  }
}

async function getStorageUsage(forceRefresh = false) {
  const rt = await getStorageRuntime(forceRefresh);
  let bytes = 0;
  let objects = 0;
  let method = 'local';

  if (rt.provider === 's3') {
    method = 's3';
    const s3 = await sumS3Usage(rt);
    bytes = s3.bytes;
    objects = s3.objects;
    if (s3.partial && s3.error) {
      const localDir = resolveLocalUploadDir(rt);
      bytes = dirSizeBytes(localDir);
      method = 'local_fallback';
    }
  } else {
    bytes = dirSizeBytes(resolveLocalUploadDir(rt));
  }

  const quotaBytes = rt.quotaGb * 1024 * 1024 * 1024;
  const usedGb = bytes / (1024 * 1024 * 1024);
  const pct = quotaBytes > 0 ? Math.min(100, Math.round((bytes / quotaBytes) * 100)) : 0;

  return {
    usedBytes: bytes,
    usedGb: Math.round(usedGb * 10) / 10,
    quotaGb: rt.quotaGb,
    percentUsed: pct,
    objects,
    method,
    provider: rt.uiProvider,
  };
}

function buildS3Client(rt) {
  const { S3Client } = require('@aws-sdk/client-s3');
  const clientOpts = {
    region: rt.s3Region,
    credentials: {
      accessKeyId: rt.s3AccessKeyId,
      secretAccessKey: rt.s3SecretAccessKey,
    },
  };
  if (rt.s3Endpoint) clientOpts.endpoint = rt.s3Endpoint;
  if (rt.s3UsePathStyle) clientOpts.forcePathStyle = true;
  return new S3Client(clientOpts);
}

function formatS3Error(err) {
  if (!err) return 'Falha ao conectar ao S3';
  const name = String(err.name || err.Code || '').trim();
  const msg = String(err.message || '').trim();
  const combined = [name, msg].filter(Boolean).join(': ');

  if (combined.includes('CompromisedKeyQuarantine')) {
    return 'AWS colocou esta Access Key em quarentena (chave comprometida). Gere novas credenciais no IAM e atualize no painel.';
  }
  if (name === 'AccessDenied' || err.$metadata?.httpStatusCode === 403) {
    return combined || 'Acesso negado — verifique credenciais e permissões (s3:ListBucket, s3:PutObject).';
  }
  if (name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
    return `Bucket não encontrado — confira nome "${err.Bucket || ''}" e região.`;
  }
  if (name === 'InvalidAccessKeyId') return 'Access Key ID inválida ou inexistente.';
  if (name === 'SignatureDoesNotMatch') return 'Secret Access Key incorreta.';
  if (msg && msg !== 'UnknownError' && msg !== 'Unknown') return combined;
  if (name) return `${name} — verifique bucket, região e permissões IAM.`;
  return 'Falha ao conectar ao S3 — verifique bucket, região e credenciais.';
}

async function testS3Connection(rt) {
  const {
    HeadBucketCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    DeleteObjectCommand,
  } = require('@aws-sdk/client-s3');
  const s3 = buildS3Client(rt);
  const bucket = rt.s3Bucket;
  const errors = [];

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true, message: `Bucket S3 "${bucket}" acessível (${rt.s3Region})` };
  } catch (e) {
    errors.push(formatS3Error(e));
  }

  try {
    await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
    return { ok: true, message: `Bucket S3 "${bucket}" acessível — listagem OK (${rt.s3Region})` };
  } catch (e) {
    errors.push(formatS3Error(e));
  }

  const probeKey = `_cadbrasil_probe_${Date.now()}.txt`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: probeKey,
        Body: 'ok',
        ContentType: 'text/plain',
      }),
    );
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: probeKey }));
    return { ok: true, message: `Bucket S3 "${bucket}" gravável — upload teste OK (${rt.s3Region})` };
  } catch (e) {
    errors.push(formatS3Error(e));
  }

  const unique = [...new Set(errors.filter(Boolean))].filter(
    (e) => !/^Unknown(: UnknownError)?$/i.test(String(e).trim()),
  );
  return {
    ok: false,
    error: unique.join(' | ') || 'Falha ao conectar ao S3',
  };
}

async function testStorageConnection() {
  const rt = await getStorageRuntime(true);
  if (rt.provider === 'local' || rt.uiProvider === 'lovable_cloud') {
    const dir = resolveLocalUploadDir(rt);
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const testFile = path.join(dir, `.probe_${Date.now()}.tmp`);
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return { ok: true, message: `Armazenamento local acessível (${dir})` };
    } catch (e) {
      return { ok: false, error: e.message || 'Falha ao acessar diretório local' };
    }
  }

  if (!rt.s3Bucket) return { ok: false, error: 'Bucket S3 não configurado' };
  if (!rt.s3AccessKeyId || !rt.s3SecretAccessKey) {
    return { ok: false, error: 'Credenciais S3 não configuradas (banco ou .env)' };
  }

  return testS3Connection(rt);
}

module.exports = {
  STORAGE_KEYS,
  SECRET_KEYS,
  DEFAULTS,
  loadRawFromDb,
  hasDbS3Secret,
  envFallback,
  getStorageRuntime,
  getStorageRuntimeFromEnv,
  invalidateStorageConfigCache,
  getStorageUsage,
  testStorageConnection,
  resolveLocalUploadDir,
};
