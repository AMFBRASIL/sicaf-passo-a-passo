import pino from "pino";
import { isProduction } from "@/lib/config/env";

/** pino-pretty usa worker thread — quebra `next build` na Vercel. */
function usePrettyLogs(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return process.env.NODE_ENV === "development";
}

export const logger = pino({
  level: isProduction() ? "info" : "debug",
  base: { service: "cadbrasil-backend" },
  transport: usePrettyLogs()
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      }
    : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createModuleLogger(module: string) {
  return logger.child({ module });
}

export function logCronStart(jobName: string) {
  logger.info({ job: jobName }, "Cron job iniciado");
}

export function logCronEnd(jobName: string, durationMs: number, ok: boolean) {
  logger.info({ job: jobName, durationMs, ok }, "Cron job finalizado");
}
