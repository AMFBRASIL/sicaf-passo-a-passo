import pino from "pino";
import { getEnv, isProduction } from "@/lib/config/env";

const env = getEnv();

export const logger = pino({
  level: isProduction() ? "info" : "debug",
  base: { service: "cadbrasil-backend" },
  transport: isProduction()
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createModuleLogger(module: string) {
  return logger.child({ module });
}

export function logCronStart(jobName: string) {
  logger.info({ job: jobName, tz: env.TZ }, "Cron job iniciado");
}

export function logCronEnd(jobName: string, durationMs: number, ok: boolean) {
  logger.info({ job: jobName, durationMs, ok }, "Cron job finalizado");
}
