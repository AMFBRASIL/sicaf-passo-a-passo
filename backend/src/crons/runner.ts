import { getCronJob } from "@/crons/registry";
import type { CronJobResult } from "@/crons/types";
import { notFound } from "@/lib/http/errors";
import { logCronEnd, logCronStart } from "@/lib/logger/logger";

export async function runCronJob(jobName: string): Promise<CronJobResult> {
  const job = getCronJob(jobName);
  if (!job) throw notFound(`Cron job '${jobName}' não encontrado`);

  if (!job.enabled()) {
    return { ok: true, message: `Job '${jobName}' desabilitado por configuração` };
  }

  const started = Date.now();
  logCronStart(jobName);

  try {
    const result = await job.run();
    logCronEnd(jobName, Date.now() - started, result.ok);
    return result;
  } catch (error) {
    logCronEnd(jobName, Date.now() - started, false);
    throw error;
  }
}
