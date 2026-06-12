/**
 * Configuração do agente SICAF — lê backend/.env (banco v2 operacional + OpenAI).
 */
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env"), override: true });

const backendRoot = path.resolve(__dirname, "..", "..");
const projectRoot = path.resolve(backendRoot, "..");

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.APP_PORT || "3001", 10),

  jwt: {
    secret: process.env.JWT_SECRET || "cadbrasil_default_secret_change_me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  api: {
    cnpjConsultaApiKey: process.env.CNPJ_CONSULTA_API_KEY || "",
  },

  db: {
    host: process.env.DB_WRITE_HOST || process.env.DB_LEGACY_HOST || process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_WRITE_PORT || process.env.DB_LEGACY_PORT || process.env.DB_PORT || "3306", 10),
    user: process.env.DB_WRITE_USER || process.env.DB_LEGACY_USER || process.env.DB_USER || "root",
    password: process.env.DB_WRITE_PASSWORD || process.env.DB_LEGACY_PASSWORD || process.env.DB_PASSWORD || "",
    database:
      process.env.DB_WRITE_NAME ||
      process.env.DB_V2_SCHEMA_NAME ||
      process.env.DB_LEGACY_NAME ||
      process.env.DB_NAME ||
      "cadbrasilv2",
    poolMin: parseInt(process.env.DB_WRITE_POOL_MIN || process.env.DB_LEGACY_POOL_MIN || process.env.DB_POOL_MIN || "1", 10),
    poolMax: parseInt(process.env.DB_WRITE_POOL_MAX || process.env.DB_LEGACY_POOL_MAX || process.env.DB_POOL_MAX || "10", 10),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "600", 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.3"),
  },

  sicaf: {
    cdpPort: parseInt(process.env.CDP_PORT || "9222", 10),
    assistantPort: parseInt(process.env.ASSISTANT_PORT || "9333", 10),
    baseUrl:
      process.env.SICAF_BASE_URL ||
      "https://www3.comprasnet.gov.br/sicaf-web/index.jsf",
  },

  cert: {
    pfxPath: process.env.CERT_PFX_PATH || "",
    pfxPassword: process.env.CERT_PFX_PASSWORD || "",
    autoCleanup: process.env.CERT_AUTO_CLEANUP === "true",
  },

  storage: {
    provider: (process.env.STORAGE_PROVIDER || "local").toLowerCase(),
    localPath: process.env.STORAGE_LOCAL_PATH || "uploads",
    localBaseUrl: process.env.STORAGE_LOCAL_BASE_URL || "/uploads",
    s3Bucket: process.env.STORAGE_S3_BUCKET || "",
    s3Region: process.env.STORAGE_S3_REGION || "us-east-1",
    s3AccessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID || "",
    s3SecretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY || "",
    s3Endpoint: process.env.STORAGE_S3_ENDPOINT || "",
    s3UsePathStyle: process.env.STORAGE_S3_USE_PATH_STYLE === "true",
    cdnUrl: process.env.STORAGE_CDN_URL || "",
    maxFileSizeMb: parseInt(process.env.STORAGE_MAX_FILE_SIZE_MB || "10", 10),
    allowedExtensions: (process.env.STORAGE_ALLOWED_EXTENSIONS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  },

  email: {
    metodo: process.env.SMTP_METODO || process.env.EMAIL_METODO || "",
    provider: process.env.SMTP_PROVIDER || process.env.EMAIL_PROVIDER || "",
    host: process.env.SMTP_HOST || "",
    port: process.env.SMTP_PORT || "587",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
    tls: process.env.SMTP_TLS !== "false" && process.env.SMTP_SECURE !== "false",
    apiKey:
      process.env.MAILGUN_API_KEY ||
      process.env.SMTP_API_KEY ||
      process.env.MAILGUN_KEY ||
      "",
    secretKey: process.env.SMTP_SECRET_KEY || "",
    fromEmail: process.env.SMTP_FROM_EMAIL || "",
    fromName: process.env.SMTP_FROM_NAME || "CadBrasil",
  },

  paths: {
    root: backendRoot,
    data: path.join(backendRoot, "data"),
    chromeProfile: path.join(backendRoot, "data", "chrome-profile"),
    screenshots: path.join(backendRoot, "data", "screenshots", "assistido"),
    welcomeFile: path.join(backendRoot, "data", "welcome.html"),
    certs: path.join(projectRoot, "certs"),
  },
};

module.exports = config;
