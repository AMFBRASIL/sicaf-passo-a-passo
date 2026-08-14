import { apiFetch } from "@/lib/api-fetch";

export type ProcessScheduleSlot = { id: string; label: string; hour: number; minute: number };

export type EfiPagamentoConferencia = {
  id: number;
  clienteId: number | null;
  clienteNome: string;
  origem: string | null;
  tipo: string | null;
  valor: number;
  statusSistema: string;
  statusEfi?: string;
  txid?: string | null;
  chargeId?: string | null;
  dataPagamento?: string | null;
  acao?: string;
  erro?: string;
};

export type ProcessHistoryDetails = {
  inserted?: number;
  skipped?: number;
  duplicatesRemoved?: number;
  stats?: { clientesElegiveis?: number; comGclid?: number };
  consultados?: number;
  validadosAgora?: number;
  jaPagosSistema?: number;
  pendentesEfi?: number;
  cancelados?: number;
  erros?: number;
  validados?: EfiPagamentoConferencia[];
  pagosSistema?: EfiPagamentoConferencia[];
  pendentes?: EfiPagamentoConferencia[];
  encerrados?: EfiPagamentoConferencia[];
  falhas?: EfiPagamentoConferencia[];
  message?: string;
};

export type ProcessHistory = {
  id: number;
  triggerType: string;
  scheduleSlot: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
  details?: ProcessHistoryDetails | null;
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
      result?: { inserted?: number; validadosAgora?: number };
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

export async function runEfiPagamentosValidacao(): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const res = await apiFetch("/api/admin/processos/efi-pagamentos/run", {
    method: "POST",
  });
  return res.json();
}
