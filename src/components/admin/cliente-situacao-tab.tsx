import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CircleDot,
  Pause,
  Ban,
  Loader2,
  Calendar,
  CalendarPlus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import type { ClienteDetalhe } from "./cliente-detalhe-modal";
import {
  fetchAdminClienteDetalhe,
  updateSicafStatusManual,
  updateSicafVigencia,
} from "@/lib/admin-clientes-api";

const SICAF_STATUSES = [
  {
    value: "Ativo",
    label: "Ativo",
    description: "Cadastro regular e em dia.",
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-500",
    ring: "ring-emerald-500/40",
  },
  {
    value: "Vencendo",
    label: "Vencendo",
    description: "Próximo do vencimento.",
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-600 dark:text-amber-500",
    ring: "ring-amber-500/40",
  },
  {
    value: "Vencido",
    label: "Vencido",
    description: "Renovação imediata necessária.",
    icon: XCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-600 dark:text-red-500",
    ring: "ring-red-500/40",
  },
  {
    value: "Pendente",
    label: "Pendente",
    description: "Aguardando regularização.",
    icon: CircleDot,
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-600 dark:text-orange-500",
    ring: "ring-orange-500/40",
  },
  {
    value: "Suspenso",
    label: "Suspenso",
    description: "Suspenso administrativamente.",
    icon: Pause,
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-600 dark:text-purple-500",
    ring: "ring-purple-500/40",
  },
  {
    value: "Cancelado",
    label: "Cancelado",
    description: "Cancelado definitivamente.",
    icon: Ban,
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    text: "text-gray-600 dark:text-gray-400",
    ring: "ring-gray-500/40",
  },
] as const;

const STATUS_COM_MODAL_PAGAMENTO = new Set(["Ativo", "Vencendo"]);
const STATUS_CANCELADO = "Cancelado";

const STATUS_EMAIL_LABELS: Record<string, string> = {
  Vencendo: "E-mail de SICAF vencendo enviado ao cliente.",
  Vencido: "E-mail de SICAF vencido enviado ao cliente.",
  Pendente: "E-mail de pendências SICAF enviado ao cliente.",
  Suspenso: "E-mail de suspensão SICAF enviado ao cliente.",
  Cancelado: "E-mail de cancelamento enviado ao cliente.",
  Ativo: "E-mail de licença ativada enviado ao cliente.",
};

function statusBadgeClass(status: string) {
  if (status === "Ativo" || status === "Vencendo") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500";
  if (status === "Pendente") return "bg-amber-500/10 text-amber-600 dark:text-amber-500";
  return "bg-red-500/10 text-red-600 dark:text-red-500";
}

function formatDateBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const part = iso.slice(0, 10);
  const [y, m, d] = part.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

function diasAteVencimento(validade: string | null | undefined): number | null {
  if (!validade) return null;
  const fim = new Date(validade.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(fim.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  fim.setHours(12, 0, 0, 0);
  return Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000);
}

function addYearsToDate(iso: string, years: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCFullYear(dt.getUTCFullYear() + years);
  return dt.toISOString().slice(0, 10);
}

function subtractOneYear(iso: string): string {
  return addYearsToDate(iso, -1);
}

function vigenciaResumo(validade: string | null, dias: number | null): string {
  if (!validade) return "Sem data de validade cadastrada";
  if (dias === null) return `Validade: ${formatDateBr(validade)}`;
  if (dias <= 0) return `Venceu em ${formatDateBr(validade)}`;
  if (dias === 1) return `Vence amanhã (${formatDateBr(validade)})`;
  if (dias <= 30) return `Vence em ${dias} dias (${formatDateBr(validade)})`;
  return `Válido até ${formatDateBr(validade)} · ${dias} dias restantes`;
}

export function SituacaoTab({
  cliente,
  clienteId,
  onUpdated,
}: {
  cliente: ClienteDetalhe;
  clienteId: number;
  onUpdated?: () => void;
}) {
  const [sicafId, setSicafId] = useState<number | null>(null);
  const [statusAtual, setStatusAtual] = useState<string>("Pendente");
  const [dataValidade, setDataValidade] = useState<string | null>(null);
  const [diasValidade, setDiasValidade] = useState<number | null>(null);
  const [credenciamentoAnual, setCredenciamentoAnual] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [historicoMsg, setHistoricoMsg] = useState("");
  const [dataInicioSicaf, setDataInicioSicaf] = useState(() => new Date().toISOString().slice(0, 10));
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showVigenciaDialog, setShowVigenciaDialog] = useState(false);
  const [vigenciaMotivo, setVigenciaMotivo] = useState("");
  const [novaDataValidade, setNovaDataValidade] = useState("");
  const [vigenciaModo, setVigenciaModo] = useState<"manual" | "add1">("add1");

  const carregar = useCallback(async () => {
    if (!Number.isFinite(clienteId)) return;
    setCarregando(true);
    try {
      const res = await fetchAdminClienteDetalhe(clienteId);
      if (res.ok && res.client?.sicaf) {
        const s = res.client.sicaf;
        setSicafId(s.id ?? null);
        setStatusAtual(s.status || "Pendente");
        const val = s.data_validade ? s.data_validade.slice(0, 10) : null;
        setDataValidade(val);
        setDiasValidade(
          val != null ? (diasAteVencimento(val) ?? s.dias_validade ?? null) : (s.dias_validade ?? null),
        );
        setCredenciamentoAnual(s.credenciamento_anual === 1);
      } else {
        setSicafId(null);
        setStatusAtual("Sem SICAF");
        setDataValidade(null);
        setDiasValidade(null);
      }
    } catch {
      toast.error("Erro ao carregar situação SICAF");
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const dataInicioEstimada = useMemo(() => {
    if (!dataValidade) return null;
    return subtractOneYear(dataValidade);
  }, [dataValidade]);

  const previewAdd1Ano = useMemo(() => {
    const base = dataValidade || new Date().toISOString().slice(0, 10);
    return addYearsToDate(base, 1);
  }, [dataValidade]);

  const previewDiasAdd1 = useMemo(() => diasAteVencimento(previewAdd1Ano), [previewAdd1Ano]);

  const submitStatusChange = async (newStatus: string, mensagem?: string) => {
    if (!sicafId || newStatus === statusAtual) return;
    const exigePagamento = STATUS_COM_MODAL_PAGAMENTO.has(newStatus);
    const isCancelamento = newStatus === STATUS_CANCELADO;
    if (exigePagamento && !dataInicioSicaf) {
      toast.error("Informe a data do pagamento.");
      return;
    }
    if ((exigePagamento || isCancelamento) && !mensagem?.trim()) {
      toast.error(
        isCancelamento
          ? "Informe o motivo do cancelamento."
          : "Informe o motivo/observação para o histórico.",
      );
      return;
    }

    setSalvando(true);
    try {
      const res = await updateSicafStatusManual({
        sicafId,
        status: newStatus,
        mensagem,
        dataInicio: exigePagamento ? dataInicioSicaf : undefined,
      });
      if (!res.ok) {
        toast.error(res.error || "Erro ao alterar status.");
        return;
      }

      toast.success(res.message || `Status alterado para ${newStatus}`);
      if (res.novaValidade) {
        setDataValidade(res.novaValidade.slice(0, 10));
        setDiasValidade(res.diasValidade ?? diasAteVencimento(res.novaValidade));
      }
      if (res.financeiro?.taxaAtualizada) {
        toast.success("Pagamento registrado no financeiro do cliente.");
      }
      if (res.emailNotificacao?.enviado) {
        toast.success(STATUS_EMAIL_LABELS[newStatus] || "E-mail de notificação enviado ao cliente.");
      } else if (res.emailNotificacao?.simulado) {
        toast.warning("E-mail registrado (SMTP não configurado — modo simulação).");
      } else if (res.emailNotificacao && !res.emailNotificacao.enviado) {
        const motivo =
          res.emailNotificacao.motivo === "sem_email_destino"
            ? "Cliente sem e-mail cadastrado"
            : res.emailNotificacao.motivo === "template_nao_encontrado"
              ? newStatus === STATUS_CANCELADO
                ? "Template de cancelamento não encontrado no sistema"
                : "Template de e-mail não encontrado — verifique templates_email"
              : res.emailNotificacao.erro || "Falha no envio do e-mail";
        toast.warning(motivo);
      }

      setStatusAtual(newStatus);
      setShowConfirmDialog(false);
      setPendingStatus(null);
      setHistoricoMsg("");
      onUpdated?.();
      void carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro de conexão ao alterar status.");
    } finally {
      setSalvando(false);
    }
  };

  const submitVigenciaChange = async () => {
    if (!sicafId || !vigenciaMotivo.trim()) {
      toast.error("Informe o motivo da alteração de vigência.");
      return;
    }
    if (vigenciaModo === "manual" && !novaDataValidade) {
      toast.error("Informe a nova data de validade.");
      return;
    }

    setSalvando(true);
    try {
      const res = await updateSicafVigencia({
        sicafId,
        clienteId,
        adicionarAnos: vigenciaModo === "add1" ? 1 : undefined,
        novaDataValidade: vigenciaModo === "manual" ? novaDataValidade : undefined,
        mensagem: vigenciaMotivo.trim(),
      });
      if (!res.ok) {
        toast.error(res.error || "Erro ao alterar vigência.");
        return;
      }

      toast.success(res.message || "Vigência atualizada com sucesso.");
      if (res.novaValidade) {
        setDataValidade(res.novaValidade);
        setDiasValidade(res.diasValidade ?? diasAteVencimento(res.novaValidade));
      }
      if (res.newStatus) setStatusAtual(res.newStatus);
      setShowVigenciaDialog(false);
      setVigenciaMotivo("");
      setNovaDataValidade("");
      onUpdated?.();
      void carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro de conexão ao alterar vigência.");
    } finally {
      setSalvando(false);
    }
  };

  const handleChangeStatus = (newStatus: string) => {
    if (!sicafId || newStatus === statusAtual || salvando) return;
    if (STATUS_COM_MODAL_PAGAMENTO.has(newStatus) || newStatus === STATUS_CANCELADO) {
      setPendingStatus(newStatus);
      if (STATUS_COM_MODAL_PAGAMENTO.has(newStatus)) {
        setDataInicioSicaf(new Date().toISOString().slice(0, 10));
      }
      setHistoricoMsg("");
      setShowConfirmDialog(true);
      return;
    }
    void submitStatusChange(newStatus);
  };

  const openVigenciaDialog = () => {
    setVigenciaModo("add1");
    setVigenciaMotivo("");
    setNovaDataValidade(previewAdd1Ano);
    setShowVigenciaDialog(true);
  };

  const pendingMeta = SICAF_STATUSES.find((s) => s.value === pendingStatus);
  const isPendingCancelamento = pendingStatus === STATUS_CANCELADO;
  const dialogTitulo = isPendingCancelamento
    ? "Cancelar SICAF"
    : pendingStatus === "Vencendo"
      ? "Regularizar SICAF"
      : "Ativar SICAF";
  const dialogSubtitulo = isPendingCancelamento
    ? "O cliente receberá o e-mail de cancelamento. Informe o motivo para o histórico."
    : pendingStatus === "Ativo"
      ? "Informe a data de ativação e o motivo. O cliente receberá um e-mail informando que o processo foi iniciado, a licença está ativa a partir dessa data e que já pode enviar documentos."
      : "Informe a data do pagamento e o motivo — a vigência do SICAF e o financeiro serão atualizados.";

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando situação...
      </div>
    );
  }

  if (!sicafId) {
    return (
      <Card className="p-6 text-center">
        <Shield className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium">Este cliente ainda não possui cadastro SICAF.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Conclua o onboarding ou renove o SICAF para habilitar a alteração manual de status.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-2">
      <div>
        <h3 className="text-base font-bold">Situação do SICAF</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Status manual e vigência do cadastro SICAF
        </p>
      </div>

      <Card className="border-blue-500/30 bg-blue-500/5 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate">{cliente.razao}</p>
            <p className="text-xs text-muted-foreground font-mono">{cliente.cnpj}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground">Status atual</p>
            <Badge className={`text-xs px-2 py-0.5 ${statusBadgeClass(statusAtual)}`}>
              {statusAtual}
            </Badge>
          </div>
        </div>
      </Card>

      <Card className="border-emerald-500/25 bg-emerald-500/5 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Vigência do cadastro</p>
              <p className="text-xs text-muted-foreground mt-0.5">{vigenciaResumo(dataValidade, diasValidade)}</p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Validade:</span>{" "}
                  <span className="font-medium">{formatDateBr(dataValidade)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Dias restantes:</span>{" "}
                  <span className="font-medium">
                    {diasValidade !== null ? (diasValidade <= 0 ? "Vencido" : diasValidade) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Início estimado:</span>{" "}
                  <span className="font-medium">
                    {dataInicioEstimada && credenciamentoAnual ? formatDateBr(dataInicioEstimada) : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1.5 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
            onClick={openVigenciaDialog}
            disabled={salvando}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar vigência
          </Button>
        </div>
      </Card>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Alterar status manualmente</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {SICAF_STATUSES.map((st) => {
            const isCurrent = statusAtual === st.value;
            const Icon = st.icon;
            return (
              <Card
                key={st.value}
                className={`relative cursor-pointer transition-all ${
                  isCurrent
                    ? `${st.border} ${st.bg} ring-2 ${st.ring}`
                    : "hover:border-blue-500/40 hover:bg-blue-500/5"
                } ${salvando ? "opacity-50 pointer-events-none" : ""}`}
                onClick={() => handleChangeStatus(st.value)}
              >
                <div className="p-2.5">
                  {isCurrent && (
                    <div className="absolute top-1.5 right-1.5">
                      <Badge className={`text-[8px] px-1 py-0 border-0 ${st.bg} ${st.text}`}>
                        ATUAL
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${st.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${st.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-xs leading-tight ${isCurrent ? st.text : ""}`}>
                        {st.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {st.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {salvando && (
        <div className="flex items-center justify-center gap-2 py-1">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground">Salvando...</p>
        </div>
      )}

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground">
          <strong className="text-amber-600 dark:text-amber-500">Atenção:</strong> Alterações de status e vigência
          são registradas no histórico. O status exibido pode ser recalculado automaticamente conforme a validade.
        </p>
      </div>

      <Dialog
        open={showVigenciaDialog}
        onOpenChange={(v) => {
          if (!salvando) {
            setShowVigenciaDialog(v);
            if (!v) {
              setVigenciaMotivo("");
              setNovaDataValidade("");
            }
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Editar vigência SICAF</DialogTitle>
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
                <CalendarPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Editar vigência</h3>
                <p className="text-sm text-muted-foreground">
                  Estenda a validade do SICAF (ex.: pagamento adicional de +1 ano).
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-muted bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Validade atual:</span>
                <span className="font-medium">{formatDateBr(dataValidade)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Status atual:</span>
                <Badge className={statusBadgeClass(statusAtual)}>{statusAtual}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Como deseja alterar?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVigenciaModo("add1")}
                  className={`rounded-lg border p-3 text-left transition ${
                    vigenciaModo === "add1"
                      ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-semibold">+ 1 ano</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    A partir de {formatDateBr(dataValidade || new Date().toISOString().slice(0, 10))} →{" "}
                    <strong>{formatDateBr(previewAdd1Ano)}</strong>
                    {previewDiasAdd1 != null && previewDiasAdd1 > 0 && (
                      <span> ({previewDiasAdd1} dias)</span>
                    )}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVigenciaModo("manual");
                    if (!novaDataValidade) setNovaDataValidade(previewAdd1Ano);
                  }}
                  className={`rounded-lg border p-3 text-left transition ${
                    vigenciaModo === "manual"
                      ? "border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-semibold">Data específica</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Informe manualmente a nova validade</p>
                </button>
              </div>
            </div>

            {vigenciaModo === "manual" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Nova data de validade <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={novaDataValidade}
                  onChange={(e) => setNovaDataValidade(e.target.value)}
                  disabled={salvando}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Motivo / Observação <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={vigenciaMotivo}
                onChange={(e) => setVigenciaMotivo(e.target.value)}
                placeholder="Ex: Cliente pagou renovação antecipada de +1 ano via transferência..."
                rows={3}
                className="resize-none"
                disabled={salvando}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowVigenciaDialog(false)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!vigenciaMotivo.trim() || (vigenciaModo === "manual" && !novaDataValidade) || salvando}
                onClick={() => void submitVigenciaChange()}
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Confirmar vigência"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showConfirmDialog}
        onOpenChange={(v) => {
          if (!salvando) {
            setShowConfirmDialog(v);
            if (!v) {
              setPendingStatus(null);
              setHistoricoMsg("");
            }
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">{dialogTitulo}</DialogTitle>
          <div className="space-y-5 py-1">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  isPendingCancelamento ? "bg-gray-500/10" : "bg-emerald-500/10"
                }`}
              >
                {isPendingCancelamento ? (
                  <Ban className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg">{dialogTitulo}</h3>
                <p className="text-sm text-muted-foreground">{dialogSubtitulo}</p>
              </div>
            </div>

            <div
              className={`rounded-lg border p-3 space-y-2 ${
                isPendingCancelamento
                  ? "border-gray-500/20 bg-gray-500/5"
                  : "border-emerald-500/20 bg-emerald-500/5"
              }`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status atual:</span>
                <Badge className={statusBadgeClass(statusAtual)}>{statusAtual}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Novo status:</span>
                <Badge
                  className={
                    pendingMeta
                      ? `${pendingMeta.bg} ${pendingMeta.text}`
                      : "bg-emerald-500/10 text-emerald-500"
                  }
                >
                  {pendingStatus || "—"}
                </Badge>
              </div>
            </div>

            {isPendingCancelamento && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Será enviado automaticamente o <strong>template de cancelamento</strong> para{" "}
                  <strong>{cliente.email || "o e-mail do cliente"}</strong>.
                </p>
              </div>
            )}

            {!isPendingCancelamento && pendingStatus === "Ativo" && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Será enviado automaticamente um <strong>e-mail de licença ativada</strong> para{" "}
                  <strong>{cliente.email || "o e-mail do cliente"}</strong>, informando o início do processo,
                  a data de ativação e a orientação para enviar a documentação no portal.
                </p>
              </div>
            )}

            {!isPendingCancelamento && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {pendingStatus === "Ativo" ? "Data de ativação" : "Data do pagamento"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={dataInicioSicaf}
                  onChange={(e) => setDataInicioSicaf(e.target.value)}
                  disabled={salvando}
                  max={new Date().toISOString().slice(0, 10)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {pendingStatus === "Ativo"
                    ? "A licença SICAF fica ativa por 1 ano a partir desta data. Essa data será informada ao cliente no e-mail."
                    : "O SICAF passa a valer por 1 ano a partir desta data. O financeiro (taxa/pagamento) será atualizado com a mesma data."}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Motivo / Observação <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={historicoMsg}
                onChange={(e) => setHistoricoMsg(e.target.value)}
                placeholder={
                  isPendingCancelamento
                    ? "Ex: Cancelamento solicitado pelo cliente, inadimplência recorrente, encerramento de atividades..."
                    : "Ex: Pagamento confirmado via transferência bancária, comprovante recebido por e-mail..."
                }
                rows={3}
                className="resize-none"
                disabled={salvando}
              />
              <p className="text-[11px] text-muted-foreground">
                {isPendingCancelamento
                  ? "Registrado no histórico e incluído no e-mail de cancelamento."
                  : "Registrado no histórico do cliente e no financeiro."}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingStatus(null);
                  setHistoricoMsg("");
                }}
                disabled={salvando}
              >
                Voltar
              </Button>
              <Button
                className={`flex-1 ${
                  isPendingCancelamento
                    ? "bg-gray-700 hover:bg-gray-800"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                disabled={
                  !historicoMsg.trim() ||
                  (!isPendingCancelamento && !dataInicioSicaf) ||
                  salvando
                }
                onClick={() => pendingStatus && void submitStatusChange(pendingStatus, historicoMsg.trim())}
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : isPendingCancelamento ? (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Confirmar cancelamento
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar alteração
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
