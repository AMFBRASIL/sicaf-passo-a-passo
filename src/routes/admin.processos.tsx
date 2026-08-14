import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Loader2,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Cog,
  Sun,
  Sunset,
  Moon,
  ListChecks,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminProcessos,
  runEfiPagamentosValidacao,
  runGoogleAdsConversoesSync,
  type AdminProcesso,
  type EfiPagamentoConferencia,
  type ProcessHistory,
  type ProcessHistoryDetails,
} from "@/lib/admin-processos-api";

export const Route = createFileRoute("/admin/processos")({
  component: ProcessosPage,
});

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function scheduleIcon(id: string) {
  if (id === "manha") return Sun;
  if (id === "tarde") return Sunset;
  if (id === "noite") return Moon;
  return Clock;
}

function statusBadge(status: string) {
  if (status === "success") {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Sucesso
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="border-red-500/30 bg-red-500/15 text-red-700 hover:bg-red-500/15">
        <XCircle className="mr-1 h-3 w-3" /> Erro
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-800 hover:bg-amber-500/15">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Em execução
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function slotLabel(slot: string | null) {
  if (!slot) return "—";
  const map: Record<string, string> = {
    manha: "Manhã",
    tarde: "Tarde",
    noite: "Noite",
    startup: "Inicialização",
    manual: "Manual",
    "vercel-cron": "Vercel Cron",
  };
  return map[slot] || slot;
}

function isEfiProcess(id: string) {
  return id === "efi-pagamentos";
}

function hasEfiDetails(details?: ProcessHistoryDetails | null) {
  return !!details && (details.validadosAgora != null || Array.isArray(details.validados));
}

function ConferenciaTable({
  rows,
  empty,
}: {
  rows: EfiPagamentoConferencia[];
  empty: string;
}) {
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Sistema</TableHead>
            <TableHead>Efí</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.id}-${r.acao || ""}`}>
              <TableCell className="max-w-[220px] truncate text-xs font-medium">{r.clienteNome}</TableCell>
              <TableCell className="text-xs uppercase">{r.tipo || "—"}</TableCell>
              <TableCell className="text-xs">{r.origem || "—"}</TableCell>
              <TableCell className="text-right text-xs">{formatMoney(r.valor)}</TableCell>
              <TableCell className="text-xs">{r.statusSistema || "—"}</TableCell>
              <TableCell className="text-xs">{r.statusEfi || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EfiConferenciaModal({
  open,
  onOpenChange,
  history,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: ProcessHistory | null;
}) {
  const d = history?.details;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Conferência de pagamentos Efí × sistema</DialogTitle>
          <DialogDescription>
            {history?.message ||
              "Pagamentos confirmados na Efí nesta execução versus os já marcados como pagos no CADBRASIL."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-emerald-50 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{d?.validadosAgora ?? 0}</p>
            <p className="text-xs text-emerald-800">Validados agora na Efí</p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3 text-center">
            <p className="text-2xl font-bold text-slate-800">{d?.jaPagosSistema ?? 0}</p>
            <p className="text-xs text-slate-600">Já pagos no sistema (30d)</p>
          </div>
          <div className="rounded-lg border bg-amber-50 p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{d?.pendentesEfi ?? 0}</p>
            <p className="text-xs text-amber-800">Ainda pendentes na Efí</p>
          </div>
          <div className="rounded-lg border bg-rose-50 p-3 text-center">
            <p className="text-2xl font-bold text-rose-700">{(d?.erros ?? 0) + (d?.cancelados ?? 0)}</p>
            <p className="text-xs text-rose-800">Erros / encerrados</p>
          </div>
        </div>

        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-emerald-800">Validados na Efí e baixados agora</h3>
            <ConferenciaTable
              rows={d?.validados || []}
              empty="Nenhum pagamento novo foi confirmado na Efí nesta execução."
            />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Já pagos no sistema (últimos 30 dias)</h3>
            <ConferenciaTable
              rows={d?.pagosSistema || []}
              empty="Nenhum pagamento marcado como pago no sistema nos últimos 30 dias."
            />
          </section>
          {(d?.pendentes?.length || 0) > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-amber-800">Consultados na Efí e ainda em aberto</h3>
              <ConferenciaTable rows={d?.pendentes || []} empty="" />
            </section>
          )}
          {(d?.falhas?.length || 0) > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-rose-800">Falhas ao consultar a Efí</h3>
              <ConferenciaTable rows={d?.falhas || []} empty="" />
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProcessosPage() {
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [processos, setProcessos] = useState<AdminProcesso[]>([]);
  const [conferencia, setConferencia] = useState<ProcessHistory | null>(null);

  const carregar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchAdminProcessos();
      if (!res.ok) {
        toast.error(res.error || "Não foi possível carregar os processos");
        return;
      }
      setProcessos(res.processos || []);
    } catch {
      toast.error("Erro de conexão ao carregar processos");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const interval = window.setInterval(() => void carregar(true), 15000);
    return () => window.clearInterval(interval);
  }, [carregar]);

  const handleRun = async (processoId: string) => {
    setRunningId(processoId);
    try {
      const res =
        processoId === "efi-pagamentos"
          ? await runEfiPagamentosValidacao()
          : processoId === "google-ads-conversoes"
            ? await runGoogleAdsConversoesSync()
            : { ok: false, error: "Processo sem execução manual" };
      if (!res.ok) {
        toast.error(res.error || "Falha ao iniciar o processo");
        return;
      }
      toast.success(res.message || "Processo iniciado");
      window.setTimeout(() => void carregar(true), 2000);
      window.setTimeout(() => void carregar(true), 8000);
      window.setTimeout(() => void carregar(true), 20000);
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setRunningId(null);
    }
  };

  const enabledCount = processos.filter((p) => p.enabled).length;
  const runningAny = processos.some((p) => p.cron?.running || p.lastRun?.status === "running");
  const horariosDia = useMemo(
    () => Math.max(...processos.map((p) => p.schedules?.length ?? 0), 0),
    [processos],
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Cog className="h-7 w-7 text-blue-600" />
            Processos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tarefas automáticas do sistema — execução agendada e histórico
          </p>
        </div>
        <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">{processos.length}</p>
            <p className="text-sm text-muted-foreground">Processos cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-500">{enabledCount}</p>
            <p className="text-sm text-muted-foreground">Ativos (cron)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{horariosDia}</p>
            <p className="text-sm text-muted-foreground">Horários/dia (padrão)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-purple-500">{runningAny ? "1" : "0"}</p>
            <p className="text-sm text-muted-foreground">Em execução agora</p>
          </CardContent>
        </Card>
      </div>

      {loading && processos.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        processos.map((proc) => (
          <Card key={proc.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    {proc.name}
                    {proc.enabled ? (
                      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700">
                        Cron ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Cron desativado</Badge>
                    )}
                    {proc.cron?.running && (
                      <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-800">
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Rodando
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{proc.description}</CardDescription>
                  {proc.npmScript && (
                    <p className="pt-1 font-mono text-xs text-muted-foreground">
                      CLI: npm run {proc.npmScript}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {isEfiProcess(proc.id) && hasEfiDetails(proc.lastRun?.details) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConferencia(proc.lastRun)}
                    >
                      <ListChecks className="mr-2 h-4 w-4" />
                      Ver conferência
                    </Button>
                  )}
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!!proc.cron?.running || runningId === proc.id}
                    onClick={() => void handleRun(proc.id)}
                  >
                    {proc.cron?.running || runningId === proc.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Executar agora
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4" />
                  Agendamento diário
                </h3>
                <div className="flex flex-wrap gap-2">
                  {proc.schedules.map((s) => {
                    const Icon = scheduleIcon(s.id);
                    const time = `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <Icon className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{s.label}</span>
                        <span className="text-muted-foreground">{time}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {isEfiProcess(proc.id) ? (
                    <>
                      Horários via{" "}
                      <code className="rounded bg-muted px-1 text-[11px]">CRON_EFI_PAGAMENTOS_SCHEDULE</code>{" "}
                      (padrão: mesmos 08:00 e 18:00).
                    </>
                  ) : (
                    <>
                      Horários via{" "}
                      <code className="rounded bg-muted px-1 text-[11px]">
                        CRON_GOOGLE_ADS_CONVERSOES_SCHEDULE
                      </code>{" "}
                      no servidor (padrão: 08:00 e 18:00).
                    </>
                  )}
                </p>
              </div>

              {isEfiProcess(proc.id) && proc.lastRun?.details && hasEfiDetails(proc.lastRun.details) && (
                <button
                  type="button"
                  onClick={() => setConferencia(proc.lastRun)}
                  className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-left transition hover:bg-emerald-50"
                >
                  <Banknote className="h-5 w-5 text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-emerald-900">
                      {proc.lastRun.details.validadosAgora ?? 0} pagamento(s) validados na Efí
                    </p>
                    <p className="text-xs text-emerald-800/80">
                      {proc.lastRun.details.jaPagosSistema ?? 0} já pagos no sistema ·{" "}
                      {proc.lastRun.details.pendentesEfi ?? 0} pendentes na Efí · clique para conferir
                    </p>
                  </div>
                  <ListChecks className="h-5 w-5 text-emerald-700" />
                </button>
              )}

              {proc.lastRun && (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <span className="font-medium">Última execução: </span>
                  {statusBadge(proc.lastRun.status)}
                  <span className="ml-2 text-muted-foreground">
                    {formatDateTime(proc.lastRun.startedAt)}
                    {proc.lastRun.scheduleSlot ? ` · ${slotLabel(proc.lastRun.scheduleSlot)}` : ""}
                    {proc.lastRun.triggerType === "manual" ? " · manual" : ""}
                  </span>
                  {proc.lastRun.message && (
                    <p className="mt-1 text-muted-foreground">{proc.lastRun.message}</p>
                  )}
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Histórico recente</h3>
                {proc.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Início</TableHead>
                          <TableHead>Fim</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Horário</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {proc.history.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateTime(h.startedAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateTime(h.finishedAt)}
                            </TableCell>
                            <TableCell className="text-xs capitalize">{h.triggerType}</TableCell>
                            <TableCell className="text-xs">{slotLabel(h.scheduleSlot)}</TableCell>
                            <TableCell>{statusBadge(h.status)}</TableCell>
                            <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <span className="truncate">
                                  {h.message ||
                                    (h.details?.inserted != null ? `${h.details.inserted} inseridas` : "—")}
                                </span>
                                {isEfiProcess(proc.id) && hasEfiDetails(h.details) && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    title="Ver conferência"
                                    onClick={() => setConferencia(h)}
                                  >
                                    <ListChecks className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {!loading && processos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum processo configurado.
          </CardContent>
        </Card>
      )}

      <EfiConferenciaModal
        open={!!conferencia}
        onOpenChange={(open) => {
          if (!open) setConferencia(null);
        }}
        history={conferencia}
      />
    </div>
  );
}
