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
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminProcessos,
  runGoogleAdsConversoesSync,
  type AdminProcesso,
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

function scheduleIcon(id: string) {
  if (id === "manha") return Sun;
  if (id === "tarde") return Sunset;
  if (id === "noite") return Moon;
  return Clock;
}

function statusBadge(status: string) {
  if (status === "success") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Sucesso
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="bg-red-500/15 text-red-700 border-red-500/30 hover:bg-red-500/15">
        <XCircle className="w-3 h-3 mr-1" /> Erro
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge className="bg-amber-500/15 text-amber-800 border-amber-500/30 hover:bg-amber-500/15">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Em execução
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

function ProcessosPage() {
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [processos, setProcessos] = useState<AdminProcesso[]>([]);

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
    if (processoId !== "google-ads-conversoes") return;
    setRunningId(processoId);
    try {
      const res = await runGoogleAdsConversoesSync();
      if (!res.ok) {
        toast.error(res.error || "Falha ao iniciar o processo");
        return;
      }
      toast.success(res.message || "Processo iniciado");
      window.setTimeout(() => void carregar(true), 2000);
      window.setTimeout(() => void carregar(true), 8000);
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setRunningId(null);
    }
  };

  const enabledCount = processos.filter((p) => p.enabled).length;
  const runningAny = processos.some((p) => p.cron?.running || p.lastRun?.status === "running");
  const horariosDia = useMemo(
    () => processos[0]?.schedules?.length ?? 2,
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
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                        Cron ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Cron desativado</Badge>
                    )}
                    {proc.cron?.running && (
                      <Badge className="bg-amber-500/15 text-amber-800 border-amber-500/30">
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
                <Button
                  className="shrink-0 bg-blue-600 hover:bg-blue-700"
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
                  Horários configuráveis via{" "}
                  <code className="rounded bg-muted px-1 text-[11px]">
                    CRON_GOOGLE_ADS_CONVERSOES_SCHEDULE
                  </code>{" "}
                  no servidor (padrão: 08:00 e 18:00). Em VPS/PM2 use TZ=America/Sao_Paulo.
                </p>
              </div>

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
                            <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                              {h.message ||
                                (h.details?.inserted != null ? `${h.details.inserted} inseridas` : "—")}
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
    </div>
  );
}
