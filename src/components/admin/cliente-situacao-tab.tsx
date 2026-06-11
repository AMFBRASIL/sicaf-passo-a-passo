import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import type { ClienteDetalhe } from "./cliente-detalhe-modal";
import { fetchAdminClienteDetalhe, updateSicafStatusManual } from "@/lib/admin-clientes-api";

const SICAF_STATUSES = [
  {
    value: "Ativo",
    label: "Ativo",
    description: "Cadastro regular e em dia. Todas as obrigações estão cumpridas.",
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-500",
    ring: "ring-emerald-500/40",
  },
  {
    value: "Vencendo",
    label: "Vencendo",
    description: "Cadastro próximo do vencimento. Necessário renovar em breve.",
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-600 dark:text-amber-500",
    ring: "ring-amber-500/40",
  },
  {
    value: "Vencido",
    label: "Vencido",
    description: "Cadastro vencido. Renovação imediata necessária para operar.",
    icon: XCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-600 dark:text-red-500",
    ring: "ring-red-500/40",
  },
  {
    value: "Pendente",
    label: "Pendente",
    description: "Aguardando regularização de documentos ou pagamento.",
    icon: CircleDot,
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-600 dark:text-orange-500",
    ring: "ring-orange-500/40",
  },
  {
    value: "Suspenso",
    label: "Suspenso",
    description: "Cadastro temporariamente suspenso por decisão administrativa.",
    icon: Pause,
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-600 dark:text-purple-500",
    ring: "ring-purple-500/40",
  },
  {
    value: "Cancelado",
    label: "Cancelado",
    description: "Cadastro cancelado definitivamente. Necessário novo cadastramento.",
    icon: Ban,
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    text: "text-gray-600 dark:text-gray-400",
    ring: "ring-gray-500/40",
  },
] as const;

/** Exige data do pagamento + motivo (SICAF e financeiro). */
const STATUS_COM_MODAL_PAGAMENTO = new Set(["Ativo", "Vencendo"]);
const STATUS_CANCELADO = "Cancelado";

function statusBadgeClass(status: string) {
  if (status === "Ativo" || status === "Vencendo") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500";
  if (status === "Pendente") return "bg-amber-500/10 text-amber-600 dark:text-amber-500";
  return "bg-red-500/10 text-red-600 dark:text-red-500";
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
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [historicoMsg, setHistoricoMsg] = useState("");
  const [dataInicioSicaf, setDataInicioSicaf] = useState(() => new Date().toISOString().slice(0, 10));
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const carregar = useCallback(async () => {
    if (!Number.isFinite(clienteId)) return;
    setCarregando(true);
    try {
      const res = await fetchAdminClienteDetalhe(clienteId);
      if (res.ok && res.client?.sicaf) {
        setSicafId(res.client.sicaf.id ?? null);
        setStatusAtual(res.client.sicaf.status || "Pendente");
      } else {
        setSicafId(null);
        setStatusAtual("Sem SICAF");
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
      if (res.financeiro?.taxaAtualizada) {
        toast.success("Pagamento registrado no financeiro do cliente.");
      }
      if (res.emailNotificacao?.enviado) {
        toast.success(
          newStatus === STATUS_CANCELADO
            ? "E-mail de cancelamento enviado ao cliente."
            : "E-mail de notificação enviado ao cliente.",
        );
      } else if (res.emailNotificacao?.simulado) {
        toast.warning("E-mail registrado (SMTP não configurado — modo simulação).");
      } else if (res.emailNotificacao && !res.emailNotificacao.enviado && newStatus !== "Ativo") {
        const motivo =
          res.emailNotificacao.motivo === "sem_email_destino"
            ? "Cliente sem e-mail cadastrado"
            : res.emailNotificacao.motivo === "template_nao_encontrado"
              ? "Template de cancelamento não encontrado no sistema"
              : res.emailNotificacao.erro || "Falha no envio do e-mail";
        toast.warning(motivo);
      }

      setStatusAtual(newStatus);
      setShowConfirmDialog(false);
      setPendingStatus(null);
      setHistoricoMsg("");
      onUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro de conexão ao alterar status.");
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

  const pendingMeta = SICAF_STATUSES.find((s) => s.value === pendingStatus);
  const isPendingCancelamento = pendingStatus === STATUS_CANCELADO;
  const dialogTitulo = isPendingCancelamento
    ? "Cancelar SICAF"
    : pendingStatus === "Vencendo"
      ? "Regularizar SICAF"
      : "Ativar SICAF";
  const dialogSubtitulo = isPendingCancelamento
    ? "O cliente receberá o e-mail de cancelamento. Informe o motivo para o histórico."
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
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold">Situação do SICAF</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Selecione o novo status para alterar a situação do cadastro SICAF
        </p>
      </div>

      <Card className="border-blue-500/30 bg-blue-500/5 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate">{cliente.razao}</p>
            <p className="text-xs text-muted-foreground font-mono">{cliente.cnpj}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground">Status atual</p>
            <Badge className={`text-xs px-2.5 py-0.5 ${statusBadgeClass(statusAtual)}`}>
              {statusAtual}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="p-4">
                {isCurrent && (
                  <div className="absolute top-2 right-2">
                    <Badge className={`text-[9px] px-1.5 py-0 border-0 ${st.bg} ${st.text}`}>
                      ATUAL
                    </Badge>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${st.bg}`}>
                    <Icon className={`h-5 w-5 ${st.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold text-sm ${isCurrent ? st.text : ""}`}>{st.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{st.description}</p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {salvando && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground">Alterando status...</p>
        </div>
      )}

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-amber-600 dark:text-amber-500">Atenção:</strong> A alteração manual do status
          será registrada no histórico. O status pode ser recalculado automaticamente quando um novo documento for
          analisado.
        </p>
      </div>

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

            {!isPendingCancelamento && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Data do pagamento <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={dataInicioSicaf}
                  onChange={(e) => setDataInicioSicaf(e.target.value)}
                  disabled={salvando}
                  max={new Date().toISOString().slice(0, 10)}
                />
                <p className="text-[11px] text-muted-foreground">
                  O SICAF passa a valer por 1 ano a partir desta data. O financeiro (taxa/pagamento) será
                  atualizado com a mesma data.
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
