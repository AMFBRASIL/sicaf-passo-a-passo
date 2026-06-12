import { apiFetch } from "@/lib/api-fetch";

export type ProcessScheduleSlot = { id: string; label: string; hour: number; minute: number };

export type ProcessHistory = {
  id: number;
  triggerType: string;
  scheduleSlot: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
  details?: {
    inserted?: number;
    skipped?: number;
    duplicatesRemoved?: number;
    stats?: { clientesElegiveis?: number; comGclid?: number };
  } | null;
};

export type AdminProcesso = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  schedules: ProcessScheduleSlot[];
  npmScript?: string;
  cron?: {
    running: boolean;
    runCount: number;
    timerActive: boolean;
    enabled: boolean;
    lastRun?: {
      startedAt?: string;
      finishedAt?: string;
      error?: string;
      result?: { inserted?: number };
    };
  };
  history: ProcessHistory[];
  lastRun: ProcessHistory | null;
};

export async function fetchAdminProcessos(): Promise<{
  ok: boolean;
  processos?: AdminProcesso[];
  error?: string;
}> {
  const res = await apiFetch("/api/admin/processos");
  return res.json();
}

export async function runGoogleAdsConversoesSync(): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const res = await apiFetch("/api/admin/processos/google-ads-conversoes/run", {
    method: "POST",
  });
  return res.json();
}
