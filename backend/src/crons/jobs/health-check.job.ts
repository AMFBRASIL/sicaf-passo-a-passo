import { pingPool, getLegacyPool, getWritePool } from "@/lib/db/mysql";
import type { CronJob } from "@/crons/types";

export const healthCheckJob: CronJob = {
  name: "health-check",
  description: "Verifica conectividade com bancos legado e v2",
  schedule: "*/15 * * * *",
  enabled: () => true,
  async run() {
    const [legacyOk, writeOk] = await Promise.all([
      pingPool(getLegacyPool()),
      pingPool(getWritePool()),
    ]);

    return {
      ok: legacyOk && writeOk,
      message: legacyOk && writeOk ? "Bancos acessíveis" : "Falha em um ou mais bancos",
      details: { legacy: legacyOk, write: writeOk },
    };
  },
};
