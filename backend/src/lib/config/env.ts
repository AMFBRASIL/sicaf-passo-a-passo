import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { z } from "zod";

// Em dev, backend/.env deve prevalecer sobre DB_* herdadas do shell/IDE.
if (process.env.NODE_ENV !== "production") {
  loadDotenv({ path: path.resolve(process.cwd(), ".env"), override: true });
}

const envSchema = z.object({
  NODE_ENV: z
    .string()
    .default("development")
    .transform((value) => {
      const v = value.trim().toLowerCase();
      if (v === "production") return "production" as const;
      if (v === "test") return "test" as const;
      return "development" as const;
    }),
  APP_URL: z.string().url().default("http://localhost:3001"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  /** Origens extras para CORS (separadas por vírgula). Ex.: previews Vercel, homolog. */
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  TZ: z.string().default("America/Sao_Paulo"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter no mínimo 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("30d"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET deve ter no mínimo 16 caracteres"),

  DB_LEGACY_HOST: z.string().min(1),
  DB_LEGACY_PORT: z.coerce.number().int().positive().default(3306),
  DB_LEGACY_USER: z.string().min(1),
  DB_LEGACY_PASSWORD: z.string().default(""),
  DB_LEGACY_NAME: z.string().min(1),
  DB_LEGACY_POOL_MIN: z.coerce.number().int().min(0).default(1),
  DB_LEGACY_POOL_MAX: z.coerce.number().int().positive().default(5),

  DB_WRITE_HOST: z.string().min(1),
  DB_WRITE_PORT: z.coerce.number().int().positive().default(3306),
  DB_WRITE_USER: z.string().min(1),
  DB_WRITE_PASSWORD: z.string().default(""),
  DB_WRITE_NAME: z.string().min(1),
  DB_WRITE_POOL_MIN: z.coerce.number().int().min(0).default(1),
  DB_WRITE_POOL_MAX: z.coerce.number().int().positive().default(10),

  DB_V2_SCHEMA_NAME: z.string().min(1).default("cadbrasilv2"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("CADBRASIL"),
  SMTP_FROM_EMAIL: z.string().email().optional(),

  STORAGE_PROVIDER: z
    .string()
    .optional()
    .transform((v) => (v || "local").trim().toLowerCase())
    .pipe(z.enum(["local", "s3"])),
  STORAGE_LOCAL_PATH: z.string().default("./uploads"),
  STORAGE_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}
