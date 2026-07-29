import { useMemo, useState } from "react";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  X,
  Loader2,
  Building2,
  ArrowRight,
  Ban,
  Package,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import wizardBg from "@/assets/wizard-bg.jpg";
import { PagamentoModal } from "@/components/pagamento-modal";
import type { EmpresaData } from "@/lib/empresas-shared";
import {
  cancelarPropostaComercial,
  formatMoedaProposta,
  labelPeriodicidade,
  pagarPropostaComercial,
  type PropostaComercial,
  type PropostaModulo,
} from "@/lib/propostas-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propostas: PropostaComercial[];
  onAtualizado?: () => void;
};

type ModuloCard = PropostaModulo & { tipo: "base" | "extra" };

function ModuloCheckCard({ modulo }: { modulo: ModuloCard }) {
  const extra = modulo.tipo === "extra";
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col rounded-2xl border bg-card/95 p-4 shadow-soft backdrop-blur-sm transition sm:p-5",
        extra ? "border-amber-400/40 ring-1 ring-amber-400/15" : "border-success/35 shadow-success/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
            extra
              ? "from-amber-500 via-orange-500 to-rose-500"
              : "from-emerald-600 via-teal-600 to-cyan-600",
          )}
        >
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            extra
              ? "border-amber-400/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
              : "border-success/40 bg-success/10 text-success",
          )}
        >
          {extra ? "Extra" : "Incluído"}
        </Badge>
      </div>

      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {extra ? "Módulo adicional" : "Módulo base"}
      </p>
      <h3 className="mt-1 text-base font-bold leading-tight text-foreground">{modulo.nome}</h3>
      {modulo.descricao && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{modulo.descricao}</p>
      )}

      <div className={cn("mt-4 rounded-xl px-4 py-3", extra ? "bg-amber-500/10" : "bg-success/8")}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Valor do módulo
        </p>
        <p
          className={cn(
            "mt-0.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl",
            extra ? "text-amber-800 dark:text-amber-200" : "text-success",
          )}
        >
          {modulo.valor != null && modulo.valor > 0
            ? formatMoedaProposta(modulo.valor)
            : "Incluso"}
        </p>
      </div>
    </div>
  );
}

export function PropostaComercialModal({
  open,
  onOpenChange,
  propostas,
  onAtualizado,
}: Props) {
  const [idx, setIdx] = useState(0);
  const proposta = propostas[Math.min(idx, Math.max(propostas.length - 1, 0))] || null;

  const [pagarOpen, setPagarOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [cancelando, setCancelando] = useState(false);

  const todosModulos = useMemo<ModuloCard[]>(() => {
    if (!proposta) return [];
    return [
      ...proposta.modulosBase.map((m) => ({ ...m, tipo: "base" as const })),
      ...proposta.modulosExtras.map((m) => ({ ...m, tipo: "extra" as const })),
    ];
  }, [proposta]);

  const empresaPagamento = useMemo<EmpresaData | null>(() => {
    if (!proposta) return null;
    return {
      clienteId: proposta.clienteId,
      nome: proposta.razaoSocial || "Empresa",
      cnpj: proposta.documento || "",
      sicaf: "sem_cadastro",
      proximoPasso: "",
      acao: { label: "Pagar", icon: ArrowRight },
      endereco: "",
      cidade: "",
      uf: "",
      telefone: "",
      email: "",
      responsavel: "",
      inscricaoEstadual: "",
      inscricaoMunicipal: "",
      ramoAtividade: "",
    };
  }, [proposta]);

  const handleCancelar = async () => {
    if (!proposta) return;
    setCancelando(true);
    const res = await cancelarPropostaComercial(proposta.id, motivo.trim() || undefined);
    setCancelando(false);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível cancelar");
      return;
    }
    toast.success("Proposta cancelada");
    setCancelarOpen(false);
    setMotivo("");
    onAtualizado?.();
    if (propostas.length <= 1) onOpenChange(false);
    else setIdx((i) => Math.min(i, propostas.length - 2));
  };

  if (!proposta) return null;

  const periodLabel = labelPeriodicidade(proposta.periodicidade);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "max-w-5xl w-[96vw] gap-0 overflow-hidden border-0 p-0",
            "max-h-[92vh] flex flex-col",
          )}
        >
          <div
            className="relative shrink-0 overflow-hidden px-6 pb-8 pt-6 text-white sm:px-8 sm:pt-8"
            style={{
              backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,58,138,0.88)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="relative z-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
                      Proposta comercial CADBRASIL
                    </span>
                  </div>
                  <DialogTitle className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Sua proposta está pronta
                  </DialogTitle>
                  <DialogDescription className="mt-2 max-w-2xl text-sm text-white/80">
                    Confira os módulos escolhidos no cadastro, os valores e finalize com PIX ou
                    boleto.
                  </DialogDescription>
                </div>

                {propostas.length > 1 && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
                    {propostas.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Proposta ${i + 1}`}
                        onClick={() => setIdx(i)}
                        className={cn(
                          "h-2.5 rounded-full transition-all",
                          i === idx ? "w-6 bg-emerald-400" : "w-2.5 bg-white/35 hover:bg-white/55",
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {proposta.razaoSocial || "Empresa"}
                  </p>
                  <p className="font-mono text-xs text-white/70">
                    {proposta.documento || "—"}
                  </p>
                </div>
                <Badge className="shrink-0 border-0 bg-white/20 text-white">
                  {proposta.status.replace("_", " ")}
                </Badge>
              </div>

              <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 px-5 py-5 backdrop-blur-sm sm:px-6 sm:py-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                      Valor total · {periodLabel}
                    </p>
                    <p className="mt-1 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                      {formatMoedaProposta(proposta.valorTotal)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
                      <span>
                        Base{" "}
                        <strong className="text-white">
                          {formatMoedaProposta(proposta.valorBase)}
                        </strong>
                      </span>
                      {proposta.valorExtras > 0 && (
                        <span>
                          Extras{" "}
                          <strong className="text-amber-200">
                            +{formatMoedaProposta(proposta.valorExtras)}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                      Protocolo
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-sm font-semibold">
                      <FileText className="h-3.5 w-3.5 opacity-70" />
                      {proposta.protocoloProposta}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-muted/20 px-4 py-6 sm:px-8">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Módulos escolhidos
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {todosModulos.length} item{todosModulos.length === 1 ? "" : "s"} nesta proposta
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3.5 w-3.5 text-success" /> Base
                </span>
                <span className="inline-flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5 text-amber-600" /> Extra
                </span>
              </div>
            </div>

            {todosModulos.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
                Módulos da proposta serão detalhados no contrato.
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-4",
                  todosModulos.length === 1 && "sm:grid-cols-1",
                  todosModulos.length === 2 && "sm:grid-cols-2",
                  todosModulos.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3",
                )}
              >
                {todosModulos.map((m, i) => (
                  <ModuloCheckCard key={`${m.codigo || m.nome}-${i}`} modulo={m} />
                ))}
              </div>
            )}

            <div className="mt-6 rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Resumo financeiro
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Valor base</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoedaProposta(proposta.valorBase)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Módulos extras</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoedaProposta(proposta.valorExtras)}
                  </span>
                </div>
                <Separator />
                <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total a pagar</p>
                    <p className="text-xs text-muted-foreground">{periodLabel}</p>
                  </div>
                  <p className="text-3xl font-black tabular-nums tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                    {formatMoedaProposta(proposta.valorTotal)}
                  </p>
                </div>
              </div>
            </div>

            {proposta.observacoes && (
              <p className="mt-4 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                {proposta.observacoes}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <Button
              variant="ghost"
              className="order-2 gap-2 text-muted-foreground hover:text-danger sm:order-1"
              onClick={() => setCancelarOpen(true)}
            >
              <Ban className="h-4 w-4" />
              Cancelar proposta
            </Button>
            <Button
              size="lg"
              className="order-1 h-14 gap-2 px-8 text-base font-bold sm:order-2 sm:min-w-[280px]"
              onClick={() => setPagarOpen(true)}
            >
              Pagar {formatMoedaProposta(proposta.valorTotal)}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mesmo modal de pagamento do sistema (manutenção/SICAF), só com o valor da proposta */}
      <PagamentoModal
        open={pagarOpen}
        onOpenChange={setPagarOpen}
        empresa={empresaPagamento}
        clienteId={proposta.clienteId}
        descricao={`proposta ${proposta.protocoloProposta}`}
        valor={proposta.valorTotal}
        initialMethod="pix"
        onGerarCustom={async ({ metodo, dataVencimento }) => {
          const res = await pagarPropostaComercial(proposta.id, metodo, dataVencimento);
          if (!res.ok || !res.pagamento) {
            return { ok: false, error: res.error || "Erro ao gerar pagamento" };
          }
          return {
            ok: true,
            ...res.pagamento,
            barcode: res.pagamento.barcode || undefined,
            link: res.pagamento.link || undefined,
            pdf: res.pagamento.pdf || undefined,
            qrcodeText: res.pagamento.qrcodeText || undefined,
            qrcodeImage: res.pagamento.qrcodeImage || undefined,
            txid: res.pagamento.txid || undefined,
          };
        }}
        onPaymentGenerated={() => {
          onAtualizado?.();
        }}
      />

      <AlertDialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              A proposta <strong>{proposta.protocoloProposta}</strong> será marcada como cancelada.
              Você poderá gerar outra no cadastro se precisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            className="min-h-[72px] resize-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelando}
              className="bg-danger text-white hover:bg-danger/90"
              onClick={(e) => {
                e.preventDefault();
                void handleCancelar();
              }}
            >
              {cancelando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando…
                </>
              ) : (
                <>
                  <X className="mr-1.5 h-4 w-4" />
                  Confirmar cancelamento
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
