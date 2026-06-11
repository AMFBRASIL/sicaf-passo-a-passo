import { useEffect, useMemo, useState } from "react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShieldCheck,
  Zap,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  Check,
  QrCode,
  Receipt,
  CalendarClock,
  Sparkles,
  Lock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import bgImg from "@/assets/sicaf-pagamento.jpg";
import { fetchSicafPlanos, gerarTaxaSicaf, type SicafPlano } from "@/lib/empresas-api";
import { BoletoGeradoPanel, type BoletoData } from "@/components/sicaf/BoletoGeradoPanel";
import { PixPaymentModal } from "@/components/sicaf/PixPaymentModal";
import { toast } from "sonner";

type Pagamento = "pix" | "boleto";
type Step = "plano" | "pagamento" | "confirmar" | "boleto";

const ICON_MAP = {
  briefcase: Briefcase,
  zap: Zap,
} as const;

function planIcon(icon: string | null) {
  if (icon === "zap") return ICON_MAP.zap;
  return ICON_MAP.briefcase;
}

const steps: { id: Step; label: string }[] = [
  { id: "plano", label: "Plano" },
  { id: "pagamento", label: "Pagamento" },
  { id: "confirmar", label: "Confirmar" },
  { id: "boleto", label: "Boleto" },
];

function getSicafDueDateIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDateBR(iso: string) {
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return iso;
  return `${day}/${m}/${y}`;
}

export function PagamentoSicafModal({
  open,
  onOpenChange,
  empresa,
  onGerado,
  onPago,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: { nome: string; cnpj: string; clienteId: number };
  /** Disparado assim que boleto ou PIX é gerado (antes do pagamento ser confirmado). */
  onGerado?: () => void;
  onPago?: () => void;
}) {
  const [step, setStep] = useState<Step>("plano");
  const [planoCodigo, setPlanoCodigo] = useState<string | null>(null);
  const [pagamento, setPagamento] = useState<Pagamento | null>(null);
  const [planosDb, setPlanosDb] = useState<SicafPlano[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(false);
  const [planosError, setPlanosError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [boletoData, setBoletoData] = useState<BoletoData | null>(null);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{
    qrcodeText: string;
    qrcodeImage: string;
    valor: number;
    protocolo: string;
    txid: string;
    pagamentoId?: number;
  } | null>(null);

  const planos = useMemo(
    () =>
      planosDb.map((p) => ({
        codigo: p.codigo,
        titulo: p.nome,
        preco: p.preco,
        prazo: p.prazo || "",
        desc: p.descricao,
        icon: planIcon(p.icon),
        badge: p.badge || "",
        destaque: p.destaque,
      })),
    [planosDb],
  );

  const vencimentoBoletoIso = getSicafDueDateIso();
  const vencimentoDisplay = addDays(new Date(), 1);
  const planoSel = planos.find((p) => p.codigo === planoCodigo) ?? null;

  useEffect(() => {
    if (open) {
      setStep("plano");
      setPlanoCodigo(null);
      setPagamento(null);
      setErrorMsg("");
      setPlanosError("");
      setBoletoData(null);
      setPixData(null);

      setLoadingPlanos(true);
      fetchSicafPlanos()
        .then((r) => {
          if (r.ok && r.planos?.length) {
            setPlanosDb(r.planos);
            setPlanoCodigo(r.planos[0].codigo);
          } else {
            setPlanosDb([]);
            setPlanosError(r.error || "Planos não disponíveis");
          }
        })
        .finally(() => setLoadingPlanos(false));
    }
  }, [open]);

  const stepIdx = steps.findIndex((s) => s.id === step);

  const valorFmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const valorCobranca = planoSel?.preco ?? 0;

  const handleConfirmar = async () => {
    if (!empresa.clienteId || !pagamento || !planoCodigo) return;
    setProcessing(true);
    setErrorMsg("");

    const result = await gerarTaxaSicaf({
      clienteId: empresa.clienteId,
      formaPagamento: pagamento,
      planoCodigo,
      dataVencimento: pagamento === "boleto" ? vencimentoBoletoIso : undefined,
    });

    setProcessing(false);

    if (!result.ok || !result.pagamento) {
      let errText = result.error || "Erro ao gerar pagamento";
      if (errText.toLowerCase().includes("unauthorized")) {
        errText =
          "Erro de autenticação com o gateway de pagamento (Efí/Gerencianet). Verifique as credenciais no servidor.";
      }
      setErrorMsg(errText);
      return;
    }

    const pgto = result.pagamento;

    if (pagamento === "boleto") {
      setBoletoData({
        barcode: pgto.barcode || "",
        link: pgto.link || "",
        pdf: pgto.pdf || "",
        valor: pgto.valor || valorCobranca,
        vencimento: pgto.vencimento || vencimentoBoletoIso,
        protocolo: pgto.protocolo || "",
        chargeId: pgto.chargeId,
      });
      setStep("boleto");
      toast.success("Boleto gerado com sucesso!");
    } else {
      setPixData({
        qrcodeText: pgto.qrcodeText || "",
        qrcodeImage: pgto.qrcodeImage || "",
        valor: pgto.valor || valorCobranca,
        protocolo: pgto.protocolo || "",
        txid: pgto.txid || "",
        pagamentoId: pgto.pagamentoId,
      });
      onOpenChange(false);
      setPixModalOpen(true);
      toast.success("PIX gerado com sucesso!");
    }

    onGerado?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-5xl p-0 overflow-hidden gap-0 sm:rounded-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="grid md:grid-cols-[300px_1fr] min-h-[600px]">
            {/* Sidebar com imagem de fundo */}
            <aside
              className="relative hidden md:flex flex-col justify-between p-6 text-white overflow-hidden"
              style={{
                backgroundImage: `linear-gradient(160deg, rgba(10,20,50,0.92), rgba(15,30,70,0.85) 60%, rgba(20,40,90,0.78)), url(${bgImg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,white,transparent_55%)]" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] uppercase tracking-wider font-bold opacity-95">
                    CADBRASIL
                  </span>
                </div>
                <h2 className="text-[26px] font-bold leading-tight">
                  Pagamento da taxa CADBRASIL
                </h2>
                <p className="text-sm opacity-90 mt-2 leading-relaxed">
                  Para iniciar a atualização do seu SICAF é necessário confirmar
                  o pagamento da taxa de cadastro.
                </p>

                <ol className="mt-8 space-y-3">
                  {steps.map((s, i) => {
                    const isBoletoStep = s.id === "boleto";
                    const skipBoleto = isBoletoStep && pagamento !== "boleto";
                    if (skipBoleto && step !== "boleto") return null;
                    const done = i < stepIdx;
                    const active = i === stepIdx;
                    return (
                      <li key={s.id} className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition",
                            done && "bg-white text-[#0b1d4a] border-white",
                            active && "bg-white/20 border-white",
                            !done && !active && "bg-transparent border-white/30 text-white/60",
                          )}
                        >
                          {done ? <Check className="h-4 w-4" /> : i + 1}
                        </span>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            !done && !active && "opacity-60",
                          )}
                        >
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="relative text-xs opacity-90 space-y-1 border-t border-white/15 pt-4">
                <p className="font-semibold truncate">{empresa.nome}</p>
                <p className="opacity-80">CNPJ {empresa.cnpj}</p>
                <p className="flex items-center gap-1.5 mt-2 text-[11px] opacity-80">
                  <Lock className="h-3 w-3" /> Pagamento 100% seguro
                </p>
              </div>
            </aside>

            {/* Conteúdo */}
            <div className="flex flex-col min-h-0">
              <ScrollArea className="flex-1 max-h-[80vh]">
                <div className="p-6 sm:p-8">
                  {step === "plano" && (
                    <div className="space-y-6">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          Etapa 1 de 3
                        </Badge>
                        <h3 className="text-2xl font-bold leading-tight">
                          Escolha o tipo de cadastro
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Selecione a velocidade que sua empresa precisa para ficar
                          habilitada em licitações.
                        </p>
                      </div>

                      {loadingPlanos ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Carregando planos...
                        </div>
                      ) : planosError ? (
                        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger flex gap-3">
                          <AlertCircle className="h-5 w-5 shrink-0" />
                          <p>{planosError}</p>
                        </div>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-4">
                          {planos.map((p) => {
                            const Icon = p.icon;
                            const sel = planoCodigo === p.codigo;
                            return (
                              <button
                                key={p.codigo}
                                type="button"
                                onClick={() => setPlanoCodigo(p.codigo)}
                                className={cn(
                                  "relative text-left rounded-2xl border-2 p-5 transition group",
                                  sel
                                    ? "border-primary bg-primary/5 shadow-soft"
                                    : "border-border hover:border-primary/40 hover:bg-muted/40",
                                )}
                              >
                                <span
                                  className={cn(
                                    "absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold",
                                    p.destaque
                                      ? "bg-warning text-warning-foreground"
                                      : "bg-primary/10 text-primary",
                                  )}
                                >
                                  {p.badge}
                                </span>
                                <div
                                  className={cn(
                                    "h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition",
                                    sel
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary",
                                  )}
                                >
                                  <Icon className="h-6 w-6" />
                                </div>
                                <p className="text-base font-bold">{p.titulo}</p>
                                <p className="text-[28px] font-bold mt-1 tabular-nums">
                                  {valorFmt(p.preco)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {p.prazo}
                                </p>
                                <p className="text-sm mt-3 leading-relaxed text-muted-foreground">
                                  {p.desc}
                                </p>
                                {sel && (
                                  <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-primary">
                                    <Check className="h-4 w-4" /> Selecionado
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm flex gap-3">
                        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Taxa única de cadastro</p>
                          <p className="text-muted-foreground mt-0.5">
                            Pagamento único via Gerencianet/Efí conforme o plano escolhido.
                            A manutenção mensal é opcional e pode ser ativada depois.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === "pagamento" && (
                    <div className="space-y-6">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          Etapa 2 de 3
                        </Badge>
                        <h3 className="text-2xl font-bold leading-tight">
                          Como prefere pagar?
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Escolha a forma de pagamento da taxa{" "}
                          <strong className="text-foreground">
                            {valorFmt(valorCobranca)}
                          </strong>
                          .
                        </p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        {[
                          {
                            id: "pix" as const,
                            titulo: "PIX",
                            desc: "Confirmação em segundos",
                            icon: QrCode,
                            badge: "Recomendado",
                          },
                          {
                            id: "boleto" as const,
                            titulo: "Boleto Bancário",
                            desc: "Compensação em até 2 dias úteis",
                            icon: Receipt,
                            badge: "",
                          },
                        ].map((p) => {
                          const Icon = p.icon;
                          const sel = pagamento === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPagamento(p.id)}
                              className={cn(
                                "relative text-left rounded-2xl border-2 p-5 transition",
                                sel
                                  ? "border-primary bg-primary/5 shadow-soft"
                                  : "border-border hover:border-primary/40 hover:bg-muted/40",
                              )}
                            >
                              {p.badge && (
                                <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">
                                  {p.badge}
                                </span>
                              )}
                              <div
                                className={cn(
                                  "h-12 w-12 rounded-xl flex items-center justify-center mb-4",
                                  sel
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground",
                                )}
                              >
                                <Icon className="h-6 w-6" />
                              </div>
                              <p className="text-base font-bold">{p.titulo}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {p.desc}
                              </p>
                              {sel && (
                                <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary">
                                  <Check className="h-4 w-4" /> Selecionado
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <Separator />

                      <div className="rounded-xl border bg-muted/30 p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <CalendarClock className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="font-semibold text-sm">
                                Data de vencimento (boleto)
                              </p>
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <Lock className="h-3 w-3" /> Fixo
                              </Badge>
                            </div>
                            <p className="text-base font-bold mt-1">
                              {format(vencimentoDisplay, "dd 'de' MMMM 'de' yyyy", {
                                locale: ptBR,
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Vencimento no dia seguinte à emissão, conforme regra SICAF.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === "confirmar" && planoSel && (
                    <div className="space-y-6">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          Etapa 3 de 3
                        </Badge>
                        <h3 className="text-2xl font-bold leading-tight">
                          Confirme o pagamento
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Revise os dados antes de gerar a cobrança.
                        </p>
                      </div>

                      {errorMsg && (
                        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm flex gap-3 text-danger">
                          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                          <p>{errorMsg}</p>
                        </div>
                      )}

                      <div className="rounded-2xl border overflow-hidden">
                        <div className="bg-muted/40 px-5 py-3 border-b">
                          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                            Empresa
                          </p>
                          <p className="font-semibold mt-0.5">{empresa.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            CNPJ {empresa.cnpj}
                          </p>
                        </div>
                        <div className="divide-y text-sm">
                          <Row label="Plano" value={planoSel.titulo} />
                          <Row label="Prazo" value={planoSel.prazo} />
                          <Row
                            label="Forma de pagamento"
                            value={
                              pagamento === "pix" ? "PIX" : "Boleto bancário"
                            }
                          />
                          {pagamento === "boleto" && (
                            <Row
                              label="Vencimento"
                              value={formatDateBR(vencimentoBoletoIso)}
                            />
                          )}
                          <Row
                            label="Valor total"
                            value={valorFmt(valorCobranca)}
                            highlight
                          />
                        </div>
                      </div>

                      <div className="rounded-xl bg-success/5 border border-success/30 p-4 text-sm flex gap-3">
                        <ShieldCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">
                            Liberação após confirmação
                          </p>
                          <p className="text-muted-foreground mt-0.5">
                            Assim que o pagamento for compensado, nosso time inicia
                            imediatamente o seu cadastro SICAF.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === "boleto" && boletoData && (
                    <div className="space-y-6">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          Etapa 4 de 4
                        </Badge>
                        <h3 className="text-2xl font-bold leading-tight">
                          Seu boleto está pronto
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Copie a linha digitável, abra ou baixe o PDF pelo link da Gerencianet/Efí.
                        </p>
                      </div>
                      <BoletoGeradoPanel
                        boletoData={boletoData}
                        documento={empresa.cnpj}
                        compact
                      />
                    </div>
                  )}

                </div>
              </ScrollArea>

              {step === "boleto" ? (
                <div className="border-t bg-muted/30 px-6 py-4 flex justify-end">
                  <Button
                    size="lg"
                    onClick={() => {
                      onPago?.();
                      onOpenChange(false);
                    }}
                    className="gap-2"
                  >
                    Concluir <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-t bg-muted/30 px-6 py-4 flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (step === "plano") onOpenChange(false);
                      else if (step === "pagamento") setStep("plano");
                      else if (step === "confirmar") setStep("pagamento");
                    }}
                    className="gap-2"
                    disabled={processing}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {step === "plano" ? "Cancelar" : "Voltar"}
                  </Button>
                  {step === "plano" && (
                    <Button
                      onClick={() => setStep("pagamento")}
                      disabled={!planoCodigo || loadingPlanos || !!planosError}
                      className="gap-2"
                    >
                      Continuar <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  {step === "pagamento" && (
                    <Button
                      onClick={() => setStep("confirmar")}
                      disabled={!pagamento}
                      className="gap-2"
                    >
                      Continuar <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  {step === "confirmar" && (
                    <Button
                      onClick={handleConfirmar}
                      disabled={processing || !empresa.clienteId || !planoCodigo}
                      className="gap-2"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          {pagamento === "pix" ? "Gerar PIX" : "Gerar Boleto"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PixPaymentModal
        open={pixModalOpen}
        onOpenChange={setPixModalOpen}
        client={empresa.nome}
        documento={empresa.cnpj}
        pixData={pixData}
        onPaymentConfirmed={() => onPago?.()}
      />
    </>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium text-right",
          highlight && "text-primary font-bold text-lg",
        )}
      >
        {value}
      </span>
    </div>
  );
}
