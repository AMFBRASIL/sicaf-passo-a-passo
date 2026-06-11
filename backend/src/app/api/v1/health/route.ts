import { createApiHandler } from "@/lib/http/api-handler";
import { pingPool, getLegacyPool, getWritePool } from "@/lib/db/mysql";
import { getEnv } from "@/lib/config/env";

export const GET = createApiHandler(async () => {
  const env = getEnv();
  const [legacyOk, writeOk] = await Promise.all([
    pingPool(getLegacyPool()).catch(() => false),
    pingPool(getWritePool()).catch(() => false),
  ]);

  return {
    status: legacyOk && writeOk ? "ok" : "degraded",
    version: "2.0.0",
    environment: env.NODE_ENV,
    databases: {
      legacy: { name: env.DB_LEGACY_NAME, connected: legacyOk },
      write: { name: env.DB_WRITE_NAME, connected: writeOk },
    },
    timestamp: new Date().toISOString(),
  };
});
