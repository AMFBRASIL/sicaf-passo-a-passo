import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  TrendingUp,
  CalendarDays,
  ChevronRight,
  History,
  Gavel,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchAdminProcessos,
  runEfiPagamentosValidacao,
  runGoogleAdsConversoesSync,
  runLicitacoesBoletim,
  runLicitacoesBoletimTeste,
  type BoletimTesteResult,
  type AdminProcesso,
  type BoletimEnvioCliente,
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

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function historyToday(history: ProcessHistory[]) {
  const now = new Date();
  return history.filter((h) => {
    const d = new Date(h.startedAt);
    return !Number.isNaN(d.getTime()) && isSameDay(d, now);
  });
}

function isEfiProcess(id: string) {
  return id === "efi-pagamentos";
}

function isGoogleAdsProcess(id: string) {
  return id === "google-ads-conversoes";
}

function isBoletimProcess(id: string) {
  return id === "licitacoes-boletim";
}

function hasEfiDetails(details?: ProcessHistoryDetails | null) {
  return !!details && (details.validadosAgora != null || Array.isArray(details.validados));
}

type ProcessDayMetrics = {
  runs: number;
  success: number;
  errors: number;
  primary: number;
  primaryLabel: string;
  secondary?: number;
  secondaryLabel?: string;
};

function metricsForProcess(proc: AdminProcesso): ProcessDayMetrics {
  const today = historyToday(proc.history);
  const success = today.filter((h) => h.status === "success").length;
  const errors = today.filter((h) => h.status === "error").length;

  if (isEfiProcess(proc.id)) {
    const validados = today.reduce((acc, h) => acc + (h.details?.validadosAgora ?? 0), 0);
    const consultados = today.reduce((acc, h) => acc + (h.details?.consultados ?? 0), 0);
    return {
      runs: today.length,
      success,
      errors,
      primary: validados,
      primaryLabel: "Validados na Efí",
      secondary: consultados,
      secondaryLabel: "Consultados",
    };
  }

  if (isGoogleAdsProcess(proc.id)) {
    const inserted = today.reduce((acc, h) => acc + (h.details?.inserted ?? 0), 0);
    const skipped = today.reduce((acc, h) => acc + (h.details?.skipped ?? 0), 0);
    return {
      runs: today.length,
      success,
      errors,
      primary: inserted,
      primaryLabel: "Conversões inseridas",
      secondary: skipped,
      secondaryLabel: "Ignoradas",
    };
  }

  if (isBoletimProcess(proc.id)) {
    const emails = today.reduce((acc, h) => acc + (h.details?.emailsEnviados ?? 0), 0);
    const licitacoes = today.reduce((acc, h) => acc + (h.details?.licitacoesEnviadas ?? 0), 0);
    return {
      runs: today.length,
      success,
      errors,
      primary: emails,
      primaryLabel: "E-mails enviados",
      secondary: licitacoes,
      secondaryLabel: "Licitações",
    };
  }

  return {
    runs: today.length,
    success,
    errors,
    primary: success,
    primaryLabel: "Execuções OK",
  };
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
            <TableRow key={`${r.id}-${r.acao || ""}-${r.txid || r.chargeId || ""}`}>
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

function EfiConferenciaSection({ details }: { details?: ProcessHistoryDetails | null }) {
  const d = details;
  if (!hasEfiDetails(d)) return null;

  return (
    <div className="space-y-5">
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

      <section>
        <h3 className="mb-2 text-sm font-semibold text-emerald-800">Validados na Efí e baixados agora</h3>
        <ConferenciaTable rows={d?.validados || []} empty="Nenhum pagamento novo confirmado nesta execução." />
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Já pagos no sistema (últimos 30 dias)</h3>
        <ConferenciaTable rows={d?.pagosSistema || []} empty="Nenhum pagamento pago no sistema nos últimos 30 dias." />
      </section>
      {(d?.pendentes?.length || 0) > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-amber-800">Consultados e ainda em aberto</h3>
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
  );
}

function BoletimDetailsSection({ details }: { details?: ProcessHistoryDetails | null }) {
  if (!details) return null;
  const envios = details.envios || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-blue-50 p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{details.emailsEnviados ?? 0}</p>
          <p className="text-xs text-blue-800">E-mails enviados</p>
        </div>
        <div className="rounded-lg border bg-emerald-50 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{details.licitacoesEnviadas ?? 0}</p>
          <p className="text-xs text-emerald-800">Licitações no total</p>
        </div>
        <div className="rounded-lg border bg-violet-50 p-3 text-center">
          <p className="text-2xl font-bold text-violet-700">{details.clientesComMatch ?? 0}</p>
          <p className="text-xs text-violet-800">Clientes com match</p>
        </div>
        <div className="rounded-lg border bg-rose-50 p-3 text-center">
          <p className="text-2xl font-bold text-rose-700">{details.emailsErro ?? 0}</p>
          <p className="text-xs text-rose-800">Erros de envio</p>
        </div>
      </div>

      {envios.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead className="text-right">Licitações</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {envios.map((e: BoletimEnvioCliente) => (
                <TableRow key={`${e.clienteId}-${e.email}`}>
                  <TableCell className="max-w-[180px] truncate text-xs font-medium">
                    {e.clienteNome}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs">{e.email}</TableCell>
                  <TableCell className="text-xs">{e.segmento}</TableCell>
                  <TableCell className="text-right text-xs">{e.licitacoesEnviadas}</TableCell>
                  <TableCell className="text-xs capitalize">{e.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function GoogleAdsDetailsSection({ details }: { details?: ProcessHistoryDetails | null }) {
  if (!details) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border bg-blue-50 p-3 text-center">
        <p className="text-2xl font-bold text-blue-700">{details.inserted ?? 0}</p>
        <p className="text-xs text-blue-800">Inseridas</p>
      </div>
      <div className="rounded-lg border bg-slate-50 p-3 text-center">
        <p className="text-2xl font-bold text-slate-800">{details.skipped ?? 0}</p>
        <p className="text-xs text-slate-600">Ignoradas</p>
      </div>
      <div className="rounded-lg border bg-violet-50 p-3 text-center">
        <p className="text-2xl font-bold text-violet-700">{details.stats?.clientesElegiveis ?? 0}</p>
        <p className="text-xs text-violet-800">Clientes elegíveis</p>
      </div>
      <div className="rounded-lg border bg-emerald-50 p-3 text-center">
        <p className="text-2xl font-bold text-emerald-700">{details.stats?.comGclid ?? 0}</p>
        <p className="text-xs text-emerald-800">Com GCLID</p>
      </div>
    </div>
  );
}

function ProcessDetailModal({
  open,
  onOpenChange,
  processo,
  selectedHistory,
  onSelectHistory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: AdminProcesso | null;
  selectedHistory: ProcessHistory | null;
  onSelectHistory: (h: ProcessHistory | null) => void;
}) {
  const day = processo ? metricsForProcess(processo) : null;
  const active = selectedHistory || processo?.lastRun || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {processo?.name}
            {processo?.enabled ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700">Cron ativo</Badge>
            ) : (
              <Badge variant="secondary">Cron desativado</Badge>
            )}
          </DialogTitle>
          <DialogDescription>{processo?.description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-8rem)]">
          <div className="space-y-6 px-6 py-4">
            {day && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                  Resumo de hoje
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border bg-muted/30 p-3 text-center">
                    <p className="text-2xl font-bold">{day.runs}</p>
                    <p className="text-xs text-muted-foreground">Execuções</p>
                  </div>
                  <div className="rounded-xl border bg-emerald-50 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{day.primary}</p>
                    <p className="text-xs text-emerald-800">{day.primaryLabel}</p>
                  </div>
                  {day.secondaryLabel != null && (
                    <div className="rounded-xl border bg-slate-50 p-3 text-center">
                      <p className="text-2xl font-bold text-slate-800">{day.secondary ?? 0}</p>
                      <p className="text-xs text-slate-600">{day.secondaryLabel}</p>
                    </div>
                  )}
                  <div className="rounded-xl border bg-rose-50 p-3 text-center">
                    <p className="text-2xl font-bold text-rose-700">{day.errors}</p>
                    <p className="text-xs text-rose-800">Erros hoje</p>
                  </div>
                </div>
              </div>
            )}

            {processo && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4" />
                  Agendamento
                </h3>
                <div className="flex flex-wrap gap-2">
                  {processo.schedules.map((s) => {
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
              </div>
            )}

            {active && (
              <div className="rounded-xl border bg-muted/20 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="h-4 w-4" />
                  Detalhes da execução selecionada
                </h3>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  {statusBadge(active.status)}
                  <span className="text-muted-foreground">{formatDateTime(active.startedAt)}</span>
                  {active.scheduleSlot && (
                    <Badge variant="outline">{slotLabel(active.scheduleSlot)}</Badge>
                  )}
                  {active.triggerType === "manual" && <Badge variant="outline">Manual</Badge>}
                </div>
                {active.message && <p className="mb-3 text-sm text-muted-foreground">{active.message}</p>}
                {processo && isEfiProcess(processo.id) && (
                  <EfiConferenciaSection details={active.details} />
                )}
                {processo && isGoogleAdsProcess(processo.id) && (
                  <GoogleAdsDetailsSection details={active.details} />
                )}
                {processo && isBoletimProcess(processo.id) && (
                  <BoletimDetailsSection details={active.details} />
                )}
              </div>
            )}

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4" />
                Histórico completo
              </h3>
              {!processo?.history.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>
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
                        <TableHead>Resumo</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processo.history.map((h) => {
                        const selected = active?.id === h.id;
                        const resumo = isEfiProcess(processo.id)
                          ? `${h.details?.validadosAgora ?? 0} validados · ${h.details?.consultados ?? 0} consultados`
                          : isGoogleAdsProcess(processo.id)
                            ? `${h.details?.inserted ?? 0} inseridas`
                            : isBoletimProcess(processo.id)
                              ? `${h.details?.emailsEnviados ?? 0} e-mails · ${h.details?.licitacoesEnviadas ?? 0} licitações`
                              : h.message || "—";
                        return (
                          <TableRow
                            key={h.id}
                            className={cn(selected && "bg-primary/5")}
                          >
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateTime(h.startedAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateTime(h.finishedAt)}
                            </TableCell>
                            <TableCell className="text-xs capitalize">{h.triggerType}</TableCell>
                            <TableCell className="text-xs">{slotLabel(h.scheduleSlot)}</TableCell>
                            <TableCell>{statusBadge(h.status)}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                              {resumo}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant={selected ? "secondary" : "ghost"}
                                className="h-7 text-xs"
                                onClick={() => onSelectHistory(h)}
                              >
                                Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function BoletimTesteModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [identificador, setIdentificador] = useState("");
  const [simular, setSimular] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<BoletimTesteResult | null>(null);

  useEffect(() => {
    if (!open) {
      setIdentificador("");
      setSimular(true);
      setLoading(false);
      setResultado(null);
    }
  }, [open]);

  const executar = async () => {
    const id = identificador.trim();
    if (!id) {
      toast.error("Informe o e-mail ou CNPJ do cliente");
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const res = await runLicitacoesBoletimTeste(id, simular);
      setResultado(res);
      if (res.ok) {
        toast.success(res.message || "Teste concluído");
      } else {
        toast.error(res.error || "Falha no teste");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-violet-600" />
            Testar boletim — 1 cliente
          </DialogTitle>
          <DialogDescription>
            Informe o e-mail ou CNPJ do cliente. Só entra no boletim quem tem manutenção ativa ou está nos primeiros
            10 dias de cadastro (teste). Gere a prévia ou envie um e-mail real.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(92vh-11rem)]">
          <div className="space-y-5 px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="boletim-teste-id">E-mail ou CNPJ do cliente</Label>
              <Input
                id="boletim-teste-id"
                placeholder="ex.: cliente@empresa.com.br ou 29.753.637/0001-30"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="boletim-teste-simular"
                checked={simular}
                onCheckedChange={(v) => setSimular(v === true)}
                disabled={loading}
              />
              <Label htmlFor="boletim-teste-simular" className="cursor-pointer text-sm font-normal">
                Apenas simular (mostrar prévia sem enviar e-mail)
              </Label>
            </div>

            <Button
              type="button"
              variant={simular ? "outline" : "default"}
              disabled={loading}
              onClick={() => void executar()}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
              {simular ? "Gerar prévia" : "Enviar e-mail de teste"}
            </Button>

            {resultado && (
              <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                {resultado.cliente && (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Cliente:</span>{" "}
                      <strong>{resultado.cliente.nome}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">CNPJ:</span> {resultado.cliente.documento || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">E-mail:</span> {resultado.cliente.email || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Segmento:</span>{" "}
                      {resultado.cliente.segmento || resultado.cliente.ramoAtividade || "—"}
                    </p>
                    {resultado.elegibilidade?.motivo && (
                      <p className="sm:col-span-2">
                        <span className="text-muted-foreground">Elegibilidade:</span>{" "}
                        {resultado.elegibilidade.motivo === "manutencao_ativa"
                          ? "Plano de manutenção ativo"
                          : resultado.elegibilidade.motivo === "periodo_teste"
                            ? `Período de teste (${resultado.elegibilidade.diasTrialRestantes ?? "?"} dia(s) restante(s))`
                            : resultado.elegibilidade.motivo}
                      </p>
                    )}
                  </div>
                )}

                {resultado.error && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {resultado.error}
                  </p>
                )}

                {resultado.message && resultado.ok && (
                  <p className="text-sm text-emerald-700">{resultado.message}</p>
                )}

                {resultado.keywords && resultado.keywords.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Palavras-chave: {resultado.keywords.slice(0, 12).join(", ")}
                    {resultado.keywords.length > 12 ? "…" : ""}
                  </p>
                )}

                {(resultado.itens?.length || 0) > 0 && (
                  <div className="overflow-x-auto rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Objeto</TableHead>
                          <TableHead>UF</TableHead>
                          <TableHead>Modalidade</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultado.itens!.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="max-w-[280px] truncate text-xs">
                              {item.objeto || "—"}
                            </TableCell>
                            <TableCell className="text-xs">{item.uf || "—"}</TableCell>
                            <TableCell className="text-xs">{item.modalidade || "—"}</TableCell>
                            <TableCell className="text-right text-xs">{formatMoney(item.valor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {resultado.previewHtml && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">Prévia do e-mail</p>
                    {resultado.assunto && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        Assunto: <strong className="text-foreground">{resultado.assunto}</strong>
                      </p>
                    )}
                    <div className="overflow-hidden rounded-lg border bg-white">
                      <iframe
                        title="Prévia do boletim"
                        srcDoc={resultado.previewHtml}
                        className="h-[min(420px,50vh)] w-full border-0"
                        sandbox=""
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ProcessCard({
  proc,
  running,
  onRun,
  onDetails,
  onTest,
}: {
  proc: AdminProcesso;
  running: boolean;
  onRun: () => void;
  onDetails: () => void;
  onTest?: () => void;
}) {
  const day = metricsForProcess(proc);
  const Icon = isEfiProcess(proc.id)
    ? Banknote
    : isGoogleAdsProcess(proc.id)
      ? TrendingUp
      : isBoletimProcess(proc.id)
        ? Gavel
        : Cog;
  const accent = isEfiProcess(proc.id)
    ? "from-emerald-500/10 to-emerald-600/5 border-emerald-200/60"
    : isGoogleAdsProcess(proc.id)
      ? "from-blue-500/10 to-blue-600/5 border-blue-200/60"
      : isBoletimProcess(proc.id)
        ? "from-violet-500/10 to-violet-600/5 border-violet-200/60"
        : "from-slate-500/10 to-slate-600/5";

  return (
    <Card className={cn("overflow-hidden border bg-gradient-to-br shadow-sm", accent)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base leading-tight">{proc.name}</CardTitle>
              <CardDescription className="mt-1 line-clamp-2 text-xs">{proc.description}</CardDescription>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {proc.enabled ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 text-[10px]">
                Ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                Off
              </Badge>
            )}
            {(proc.cron?.running || running) && (
              <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-800 text-[10px]">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Rodando
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Hoje
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-background/70 px-2 py-2 text-center">
              <p className="text-xl font-bold">{day.runs}</p>
              <p className="text-[10px] text-muted-foreground">Execuções</p>
            </div>
            <div className="rounded-lg border bg-background/70 px-2 py-2 text-center">
              <p className="text-xl font-bold text-emerald-600">{day.primary}</p>
              <p className="text-[10px] text-muted-foreground">{day.primaryLabel}</p>
            </div>
            {day.secondaryLabel != null && (
              <div className="rounded-lg border bg-background/70 px-2 py-2 text-center">
                <p className="text-xl font-bold">{day.secondary ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">{day.secondaryLabel}</p>
              </div>
            )}
            <div className="rounded-lg border bg-background/70 px-2 py-2 text-center">
              <p className="text-xl font-bold text-rose-600">{day.errors}</p>
              <p className="text-[10px] text-muted-foreground">Erros</p>
            </div>
          </div>
        </div>

        {proc.lastRun && (
          <div className="rounded-lg border bg-background/60 px-3 py-2 text-xs">
            <span className="font-medium">Última execução: </span>
            {statusBadge(proc.lastRun.status)}
            <span className="ml-2 text-muted-foreground">{formatDateTime(proc.lastRun.startedAt)}</span>
            {proc.lastRun.message && (
              <p className="mt-1 line-clamp-2 text-muted-foreground">{proc.lastRun.message}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {isBoletimProcess(proc.id) && onTest && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1 gap-1 sm:flex-none"
              onClick={onTest}
            >
              <FlaskConical className="h-4 w-4" />
              Testar 1 cliente
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1 sm:flex-none"
            onClick={onDetails}
          >
            <ListChecks className="h-4 w-4" />
            Mais detalhes
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 gap-1 bg-blue-600 hover:bg-blue-700 sm:flex-none"
            disabled={!!proc.cron?.running || running}
            onClick={onRun}
          >
            {proc.cron?.running || running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Executar agora
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessosPage() {
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [processos, setProcessos] = useState<AdminProcesso[]>([]);
  const [detailProcess, setDetailProcess] = useState<AdminProcesso | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<ProcessHistory | null>(null);
  const [boletimTesteOpen, setBoletimTesteOpen] = useState(false);

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
            : processoId === "licitacoes-boletim"
              ? await runLicitacoesBoletim()
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

  const openDetails = (proc: AdminProcesso) => {
    setDetailProcess(proc);
    setSelectedHistory(proc.lastRun);
  };

  const dayTotals = useMemo(() => {
    let runs = 0;
    let success = 0;
    let errors = 0;
    let efiValidados = 0;
    let adsInserted = 0;
    let boletimEmails = 0;
    for (const p of processos) {
      const m = metricsForProcess(p);
      runs += m.runs;
      success += m.success;
      errors += m.errors;
      if (isEfiProcess(p.id)) efiValidados += m.primary;
      if (isGoogleAdsProcess(p.id)) adsInserted += m.primary;
      if (isBoletimProcess(p.id)) boletimEmails += m.primary;
    }
    return { runs, success, errors, efiValidados, adsInserted, boletimEmails };
  }, [processos]);

  const enabledCount = processos.filter((p) => p.enabled).length;
  const runningAny = processos.some((p) => p.cron?.running || p.lastRun?.status === "running");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Cog className="h-7 w-7 text-blue-600" />
            Processos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tarefas automáticas — resumo do dia e detalhes sob demanda
          </p>
        </div>
        <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{dayTotals.runs}</p>
            <p className="text-xs text-muted-foreground">Execuções hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{dayTotals.success}</p>
            <p className="text-xs text-muted-foreground">Sucesso hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-rose-600">{dayTotals.errors}</p>
            <p className="text-xs text-muted-foreground">Erros hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{dayTotals.efiValidados}</p>
            <p className="text-xs text-muted-foreground">Efí validados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{dayTotals.adsInserted}</p>
            <p className="text-xs text-muted-foreground">Ads inseridas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-700">{dayTotals.boletimEmails}</p>
            <p className="text-xs text-muted-foreground">Boletins enviados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{runningAny ? "1" : enabledCount}</p>
            <p className="text-xs text-muted-foreground">
              {runningAny ? "Em execução" : "Crons ativos"}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading && processos.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {processos.map((proc) => (
            <ProcessCard
              key={proc.id}
              proc={proc}
              running={runningId === proc.id}
              onRun={() => void handleRun(proc.id)}
              onDetails={() => openDetails(proc)}
              onTest={isBoletimProcess(proc.id) ? () => setBoletimTesteOpen(true) : undefined}
            />
          ))}
        </div>
      )}

      {!loading && processos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum processo configurado.
          </CardContent>
        </Card>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Horários configuráveis via{" "}
        <code className="rounded bg-muted px-1">CRON_EFI_PAGAMENTOS_SCHEDULE</code>,{" "}
        <code className="rounded bg-muted px-1">CRON_GOOGLE_ADS_CONVERSOES_SCHEDULE</code> e{" "}
        <code className="rounded bg-muted px-1">CRON_LICITACOES_BOLETIM_SCHEDULE</code> (padrão 06:00).
      </p>

      <BoletimTesteModal open={boletimTesteOpen} onOpenChange={setBoletimTesteOpen} />

      <ProcessDetailModal
        open={!!detailProcess}
        onOpenChange={(open) => {
          if (!open) {
            setDetailProcess(null);
            setSelectedHistory(null);
          }
        }}
        processo={detailProcess}
        selectedHistory={selectedHistory}
        onSelectHistory={setSelectedHistory}
      />
    </div>
  );
}
