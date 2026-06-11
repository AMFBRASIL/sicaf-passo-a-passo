export type CronJobResult = {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
};

export type CronJob = {
  name: string;
  description: string;
  /** Expressão cron ou horários fixos (ex: "08:00,18:00") — documentação / vercel.json */
  schedule: string;
  enabled: () => boolean;
  run: () => Promise<CronJobResult>;
};
