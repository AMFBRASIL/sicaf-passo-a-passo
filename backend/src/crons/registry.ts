import { healthCheckJob } from "@/crons/jobs/health-check.job";
import type { CronJob } from "@/crons/types";

/**
 * Registro central de cron jobs.
 * Adicione novos jobs aqui — cada um expõe rota POST /api/cron/{name}
 */
const jobs: CronJob[] = [
  healthCheckJob,
  // Futuros: google-ads-conversoes, certidoes-vencimento, pagamentos-pendentes, etc.
];

const jobMap = new Map(jobs.map((j) => [j.name, j]));

export function listCronJobs(): Pick<CronJob, "name" | "description" | "schedule">[] {
  return jobs.map(({ name, description, schedule }) => ({ name, description, schedule }));
}

export function getCronJob(name: string): CronJob | undefined {
  return jobMap.get(name);
}

export function getAllCronJobNames(): string[] {
  return jobs.map((j) => j.name);
}
