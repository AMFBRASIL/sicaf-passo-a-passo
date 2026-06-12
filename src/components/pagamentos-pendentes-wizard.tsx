import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Receipt,
  QrCode,
  CreditCard,
  ChevronRight,
  ArrowLeft,
  Plus,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Sparkles,
  Lock,
  Building2,
  RefreshCw,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import bgPagamento from "@/assets/sicaf-pagamento.jpg";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchPagamentosSicafGerados,
  isFormaPix,
  type PagamentoSicafItem,
} from "@/lib/cliente-financeiro-api";
import { BoletoGeradoPanel, type BoletoData } from "@/components/sicaf/BoletoGeradoPanel";
import { PixPaymentModal } from "@/components/sicaf/PixPaymentModal";
import { cn } from "@/lib/utils";

type WizardStep = "lista" | "detalhe";

const STEPS: { key: WizardStep; label: string; desc: string }[] = [
  { key: "lista", label: "Pagamentos", desc: "Cobranças em aberto" },
  { key: "detalhe", label: "Detalhes", desc: "Boleto ou PIX" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: { nome: string; cnpj: string; clienteId: number };
  onNovoPagamento: () => void;
  onPago?: () => void;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const parts = iso.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  }
  return d.toLocaleDateString("pt-BR");
}

function statusBadge(item: PagamentoSicafItem) {
  if (item.vencido) return { label: "Vencido", className: "bg-danger/15 text-danger border-danger/30" };
  const s = String(item.status || "").toLowerCase();
  if (s.includes("gerado") || s.includes("aguardando")) {
    return { label: "Aguardando pagamento", className: "bg-warning/15 text-warning-foreground border-warning/30" };
  }
  return { label: item.status || "Pendente", className: "bg-muted text-muted-foreground border-border" };
}

function toBoletoData(item: PagamentoSicafItem): BoletoData {
  const venc = item.dataVencimento || new Date().toISOString().slice(0, 10);
  return {
    barcode: item.barcode || "",
    link: item.linkBoleto || "",
    pdf: item.linkPdf || item.linkBoleto || "",
    valor: item.valor,
    vencimento: venc.includes("T") ? venc.slice(0, 10) : venc,
    protocolo: item.protocolo || "",
    chargeId: item.chargeId != null ? Number(item.chargeId) : undefined,
  };
}

export function PagamentosPendentesWizard({
  open,
  onOpenChange,
  empresa,
  onNovoPagamento,
  onPago,
}: Props) {
  const [step, setStep] = useState<WizardStep>("lista");
  const [pendentes, setPendentes] = useState<PagamentoSicafItem[]>([]);
  const [selecionado, setSelecionado] = useState<PagamentoSicafItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pixOpen, setPixOpen] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresa.clienteId) return;
    setLoading(true);
    setLoadError(null);
    const res = await fetchPagamentosSicafGerados(empresa.clienteId);
    setLoading(false);
    if (!res.ok) {
      setLoadError(res.error || "Erro ao carregar pagamentos");
      setPendentes([]);
      return;
    }
    setPendentes(res.pendentes);
    if (res.pendentes.length === 0) {
      onOpenChange(false);
      onNovoPagamento();
    }
  }, [empresa.clienteId, onNovoPagamento, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setStep("lista");
      setSelecionado(null);
      setLoadError(null);
      return;
    }
    void carregar();
  }, [open, carregar]);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progresso = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const totalPendente = pendentes.reduce((acc, p) => acc + (p.valor || 0), 0);

  const abrirDetalhe = (item: PagamentoSicafItem) => {
    setSelecionado(item);
    if (isFormaPix(item)) {
      setPixOpen(true);
    } else {
      setStep("detalhe");
    }
  };

  const voltar = () => {
    if (step === "detalhe") {
      setStep("lista");
      setSelecionado(null);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden sm:max-w-5xl sm:rounded-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Gerenciar pagamentos SICAF</DialogTitle>
          <DialogDescription className="sr-only">
            Visualize e pague boletos ou PIX pendentes da taxa SICAF.
          </DialogDescription>

          <div className="grid min-h-[min(580px,88dvh)] md:grid-cols-[300px_minmax(0,1fr)]">
            <aside
              className="relative hidden flex-col overflow-hidden text-white md:flex"
              style={{
                backgroundImage: `linear-gradient(165deg, rgba(10,25,55,0.94) 0%, rgba(15,35,80,0.88) 50%, rgba(20,50,100,0.82) 100%), url(${bgPagamento || wizardBg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="relative z-10 flex flex-1 flex-col p-6">
                <div className="mb-6">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/25">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                    CADBRASIL · Financeiro
                  </p>
                  <h2 className="mt-1 text-xl font-bold leading-tight">
                    Pagamentos pendentes
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-white/75">
                    Gerencie boletos e PIX já emitidos ou gere uma nova cobrança para liberar o SICAF.
                  </p>
                </div>

                <div className="mb-4 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-white/60">
                    <span>Progresso</span>
                    <span>{progresso}%</span>
                  </div>
                  <Progress value={progresso} className="h-1.5 bg-white/15 [&>div]:bg-emerald-400" />
                </div>

                <nav className="space-y-2">
                  {STEPS.map((s, i) => {
                    const done = i < stepIndex;
                    const active = s.key === step;
                    return (
                      <div
                        key={s.key}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                          active && "bg-white/15",
                          !active && !done && "opacity-50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            done && "bg-emerald-400 text-slate-900",
                            active && !done && "bg-white/25 ring-2 ring-white/40",
                            !done && !active && "bg-white/10",
                          )}
                        >
                          {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{s.label}</p>
                          <p className="text-[11px] text-white/65">{s.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </nav>

                <div className="mt-auto space-y-3 border-t border-white/15 pt-4">
                  <div className="rounded-xl bg-white/10 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Total em aberto</p>
                    <p className="text-2xl font-bold tabular-nums">{formatBRL(totalPendente)}</p>
                    <p className="text-[11px] text-white/65 mt-0.5">
                      {pendentes.length} cobrança{pendentes.length !== 1 ? "s" : ""} pendente
                      {pendentes.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-xs text-white/70">
                    <p className="font-semibold truncate">{empresa.nome}</p>
                    <p className="opacity-80">CNPJ {empresa.cnpj}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] opacity-75">
                      <Lock className="h-3 w-3" /> Pagamento seguro via Efí/Gerencianet
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 flex-col bg-background">
              <div className="border-b px-6 py-4 md:hidden">
                <p className="text-xs text-muted-foreground">
                  Etapa {stepIndex + 1} de {STEPS.length}
                </p>
                <h3 className="text-lg font-bold">{STEPS[stepIndex]?.label}</h3>
              </div>

              <ScrollArea className="flex-1 max-h-[min(68dvh,720px)]">
                <div className="p-6 sm:p-8">
                  {step === "lista" && (
                    <div className="space-y-6">
                      <div>
                        <Badge variant="secondary" className="mb-2 gap-1">
                          <CreditCard className="h-3 w-3" />
                          Taxa SICAF
                        </Badge>
                        <h3 className="text-2xl font-bold leading-tight">
                          Suas cobranças em aberto
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Escolha um pagamento para visualizar o boleto ou QR Code PIX, ou gere uma nova cobrança.
                        </p>
                      </div>

                      {loading && (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <p className="text-sm">Carregando pagamentos...</p>
                        </div>
                      )}

                      {loadError && !loading && (
                        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger flex gap-3">
                          <AlertCircle className="h-5 w-5 shrink-0" />
                          <div>
                            <p>{loadError}</p>
                            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => void carregar()}>
                              <RefreshCw className="h-3.5 w-3.5" />
                              Tentar novamente
                            </Button>
                          </div>
                        </div>
                      )}

                      {!loading && !loadError && pendentes.length > 0 && (
                        <div className="space-y-3">
                          {pendentes.map((item) => {
                            const badge = statusBadge(item);
                            const isPix = isFormaPix(item);
                            const Icon = isPix ? QrCode : Receipt;
                            return (
                              <button
                                key={`${item.id}-${item.pagamentoId}`}
                                type="button"
                                onClick={() => abrirDetalhe(item)}
                                className="group w-full rounded-2xl border-2 border-border bg-card p-5 text-left transition hover:border-primary/40 hover:shadow-md"
                              >
                                <div className="flex items-start gap-4">
                                  <div
                                    className={cn(
                                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                                      isPix ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary",
                                    )}
                                  >
                                    <Icon className="h-6 w-6" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-bold text-sm">{item.descricao || "Taxa SICAF"}</p>
                                      <Badge variant="outline" className={cn("text-[10px]", badge.className)}>
                                        {badge.label}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                                      {formatBRL(item.valor)}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                      <span className="inline-flex items-center gap-1">
                                        {isPix ? (
                                          <>
                                            <QrCode className="h-3.5 w-3.5" /> PIX
                                          </>
                                        ) : (
                                          <>
                                            <Receipt className="h-3.5 w-3.5" /> Boleto
                                          </>
                                        )}
                                      </span>
                                      {item.dataVencimento && (
                                        <span className="inline-flex items-center gap-1">
                                          <Clock className="h-3.5 w-3.5" />
                                          Vence {formatDateBR(item.dataVencimento)}
                                        </span>
                                      )}
                                      {item.protocolo && (
                                        <span className="font-mono">#{item.protocolo}</span>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary group-hover:translate-x-0.5" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="rounded-xl border border-dashed bg-muted/30 p-4 flex gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold">Precisa de outra forma de pagamento?</p>
                          <p className="text-muted-foreground mt-0.5">
                            Gere um novo boleto ou PIX com plano e vencimento atualizados — a cobrança anterior
                            permanece válida até o vencimento.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === "detalhe" && selecionado && !isFormaPix(selecionado) && (
                    <div className="space-y-6">
                      <div>
                        <Badge variant="secondary" className="mb-2">Boleto bancário</Badge>
                        <h3 className="text-2xl font-bold leading-tight">Pague seu boleto</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selecionado.descricao} · {formatBRL(selecionado.valor)}
                        </p>
                      </div>
                      <BoletoGeradoPanel
                        boletoData={toBoletoData(selecionado)}
                        documento={empresa.cnpj}
                        compact
                      />
                      <div className="rounded-xl bg-success/5 border border-success/30 p-4 text-sm flex gap-3">
                        <ShieldCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
                        <p className="text-muted-foreground">
                          Após a compensação do boleto (até 2 dias úteis), liberamos automaticamente a atualização
                          do seu cadastro SICAF.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t bg-muted/30 px-6 py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Button variant="ghost" onClick={voltar} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  {step === "detalhe" ? "Voltar à lista" : "Fechar"}
                </Button>
                <div className="flex flex-col sm:flex-row gap-2">
                  {step === "lista" && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2"
                      disabled={loading}
                      onClick={() => void carregar()}
                    >
                      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                      Atualizar
                    </Button>
                  )}
                  <Button
                    size="lg"
                    className="gap-2 shadow-sm"
                    onClick={() => {
                      onOpenChange(false);
                      onNovoPagamento();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Gerar novo pagamento
                    <Sparkles className="h-4 w-4 opacity-80" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selecionado && isFormaPix(selecionado) && (
        <PixPaymentModal
          open={pixOpen}
          onOpenChange={(v) => {
            setPixOpen(v);
            if (!v) setSelecionado(null);
          }}
          client={empresa.nome}
          documento={empresa.cnpj}
          pixData={{
            qrcodeText: selecionado.qrcodeText || "",
            qrcodeImage: selecionado.qrcodeImage || "",
            valor: selecionado.valor,
            protocolo: selecionado.protocolo || "",
            txid: selecionado.txid || "",
            pagamentoId: selecionado.pagamentoId ?? undefined,
          }}
          onPaymentConfirmed={() => {
            onPago?.();
            void carregar();
          }}
        />
      )}
    </>
  );
}
