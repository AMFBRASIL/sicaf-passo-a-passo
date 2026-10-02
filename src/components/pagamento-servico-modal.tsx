import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  Loader2,
  Lock,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import bgImg from "@/assets/sicaf-pagamento.jpg";
import { BoletoGeradoPanel, type BoletoData } from "@/components/sicaf/BoletoGeradoPanel";
import { PixPaymentModal } from "@/components/sicaf/PixPaymentModal";

type Forma = "pix" | "boleto";
type Step = "plano" | "pagamento" | "confirmar" | "boleto";

/** Cobrança devolvida pelas APIs de assessoria (CAUFESP, BLL) e módulos (Licitações-e, PNCP). */
export type ServicoPagamentoGerado = {
  id: number;
  tipo: Forma;
  valor: number;
  vencimento: string | null;
  protocolo: string;
  barcode: string;
  link: string;
  pdf: string;
  txid: string;
  qrcodeText: string;
  qrcodeImage: string;
};

export type PagamentoServicoInfo = {
  /** Título da lateral (ex.: "Pagamento da assessoria CAUFESP"). */
  titulo: string;
  descricao: string;
  etapaTitulo: string;
  etapaSubtitulo: string;
  plano: {
    titulo: string;
    descricao: string;
    prazo: string;
    badge?: string;
    icon?: LucideIcon;
    itens?: string[];
  };
  valor: number;
  recorrencia?: "mensal";
  aviso: { titulo: string; texto: string };
  liberacao: string;
};

type GerarResultado =
  | { ok: true; pagamento: ServicoPagamentoGerado; reutilizado?: boolean }
  | { ok: false; error: string };

const steps: { id: Step; label: string }[] = [
  { id: "plano", label: "Plano" },
  { id: "pagamento", label: "Pagamento" },
  { id: "confirmar", label: "Confirmar" },
  { id: "boleto", label: "Boleto" },
];

function vencimentoBoletoPadrao() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

function formatDateBR(iso: string | null) {
  if (!iso) return "—";
  const [y, m, day] = iso.slice(0, 10).split("-");
  if (!y || !m || !day) return iso;
  return `${day}/${m}/${y}`;
}

const valorFmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Mesmo fluxo e visual do pagamento da taxa SICAF, para os demais serviços do portal. */
export function PagamentoServicoModal({
  open,
  onOpenChange,
  empresa,
  info,
  gerar,
  onGerado,
  onPago,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: { nome: string; cnpj: string };
  info: PagamentoServicoInfo;
  gerar: (forma: Forma) => Promise<GerarResultado>;
  onGerado?: (pagamento: ServicoPagamentoGerado) => void;
  onPago?: () => void;
}) {
  const [step, setStep] = useState<Step>("plano");
  const [forma, setForma] = useState<Forma | null>(null);
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

  useEffect(() => {
    if (!open) return;
    setStep("plano");
    setForma(null);
    setErrorMsg("");
    setBoletoData(null);
  }, [open]);

  const stepIdx = steps.findIndex((s) => s.id === step);
  const PlanoIcon = info.plano.icon ?? Briefcase;
  const sufixo = info.recorrencia === "mensal" ? "/mês" : "";
  const valorTexto = `${valorFmt(info.valor)}${sufixo}`;

  const handleConfirmar = async () => {
    if (!forma) return;
    setProcessing(true);
    setErrorMsg("");
    const result = await gerar(forma);
    setProcessing(false);

    if (!result.ok) {
      let errText = result.error || "Erro ao gerar pagamento";
      if (errText.toLowerCase().includes("unauthorized")) {
        errText =
          "Erro de autenticação com o gateway de pagamento (Efí/Gerencianet). Verifique as credenciais no servidor.";
      }
      setErrorMsg(errText);
      return;
    }

    const pgto = result.pagamento;
    if (pgto.tipo === "boleto") {
      setBoletoData({
        barcode: pgto.barcode,
        link: pgto.link,
        pdf: pgto.pdf,
        valor: pgto.valor || info.valor,
        vencimento: pgto.vencimento || "",
        protocolo: pgto.protocolo,
      });
      setStep("boleto");
      toast.success(
        result.reutilizado ? "Boleto em aberto recuperado" : "Boleto gerado com sucesso!",
      );
    } else {
      setPixData({
        qrcodeText: pgto.qrcodeText,
        qrcodeImage: pgto.qrcodeImage,
        valor: pgto.valor || info.valor,
        protocolo: pgto.protocolo,
        txid: pgto.txid,
        pagamentoId: pgto.id,
      });
      onOpenChange(false);
      setPixModalOpen(true);
      toast.success("PIX gerado com sucesso!");
    }
    onGerado?.(pgto);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-5xl p-0 overflow-hidden gap-0 sm:rounded-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="grid md:grid-cols-[300px_1fr] min-h-[600px]">
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
                <h2 className="text-[26px] font-bold leading-tight">{info.titulo}</h2>
                <p className="text-sm opacity-90 mt-2 leading-relaxed">{info.descricao}</p>

                <ol className="mt-8 space-y-3">
                  {steps.map((s, i) => {
                    if (s.id === "boleto" && forma !== "boleto" && step !== "boleto") return null;
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
                          className={cn("text-sm font-medium", !done && !active && "opacity-60")}
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

            <div className="flex flex-col min-h-0">
              <ScrollArea className="flex-1 max-h-[80vh]">
                <div className="p-6 sm:p-8">
                  {step === "plano" && (
                    <div className="space-y-6">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          Etapa 1 de 3
                        </Badge>
                        <h3 className="text-2xl font-bold leading-tight">{info.etapaTitulo}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{info.etapaSubtitulo}</p>
                      </div>

                      <div className="relative text-left rounded-2xl border-2 border-primary bg-primary/5 p-5 shadow-soft">
                        {info.plano.badge && (
                          <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
                            {info.plano.badge}
                          </span>
                        )}
                        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <div>
                            <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 bg-primary text-primary-foreground">
                              <PlanoIcon className="h-6 w-6" />
                            </div>
                            <p className="text-base font-bold">{info.plano.titulo}</p>
                            <p className="text-[28px] font-bold mt-1 tabular-nums">
                              {valorFmt(info.valor)}
                              {sufixo && (
                                <span className="text-base font-medium text-muted-foreground">
                                  {sufixo}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {info.plano.prazo}
                            </p>
                            <p className="text-sm mt-3 leading-relaxed text-muted-foreground">
                              {info.plano.descricao}
                            </p>
                            <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-primary">
                              <Check className="h-4 w-4" /> Selecionado
                            </div>
                          </div>
                          {info.plano.itens && info.plano.itens.length > 0 && (
                            <ul className="space-y-2 self-center rounded-xl border bg-background/70 p-4">
                              {info.plano.itens.map((item) => (
                                <li key={item} className="flex gap-2 text-sm">
                                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm flex gap-3">
                        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{info.aviso.titulo}</p>
                          <p className="text-muted-foreground mt-0.5">{info.aviso.texto}</p>
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
                        <h3 className="text-2xl font-bold leading-tight">Como prefere pagar?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Escolha a forma de pagamento de{" "}
                          <strong className="text-foreground">{valorTexto}</strong>.
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
                          const sel = forma === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setForma(p.id)}
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
                              <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
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
                              <p className="font-semibold text-sm">Data de vencimento (boleto)</p>
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <Lock className="h-3 w-3" /> Fixo
                              </Badge>
                            </div>
                            <p className="text-base font-bold mt-1">
                              {format(vencimentoBoletoPadrao(), "dd 'de' MMMM 'de' yyyy", {
                                locale: ptBR,
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Vencimento no dia seguinte à emissão.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === "confirmar" && (
                    <div className="space-y-6">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          Etapa 3 de 3
                        </Badge>
                        <h3 className="text-2xl font-bold leading-tight">Confirme o pagamento</h3>
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
                          <p className="text-xs text-muted-foreground">CNPJ {empresa.cnpj}</p>
                        </div>
                        <div className="divide-y text-sm">
                          <Row label="Serviço" value={info.plano.titulo} />
                          <Row label="Prazo" value={info.plano.prazo} />
                          <Row
                            label="Forma de pagamento"
                            value={forma === "pix" ? "PIX" : "Boleto bancário"}
                          />
                          {forma === "boleto" && (
                            <Row
                              label="Vencimento"
                              value={format(vencimentoBoletoPadrao(), "dd/MM/yyyy")}
                            />
                          )}
                          <Row label="Valor total" value={valorTexto} highlight />
                        </div>
                      </div>

                      <div className="rounded-xl bg-success/5 border border-success/30 p-4 text-sm flex gap-3">
                        <ShieldCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Liberação após confirmação</p>
                          <p className="text-muted-foreground mt-0.5">{info.liberacao}</p>
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
                        <h3 className="text-2xl font-bold leading-tight">Seu boleto está pronto</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Copie a linha digitável, abra ou baixe o PDF pelo link da Gerencianet/Efí.
                          Vencimento: {formatDateBR(boletoData.vencimento)}.
                        </p>
                      </div>
                      <BoletoGeradoPanel boletoData={boletoData} documento={empresa.cnpj} compact />
                    </div>
                  )}
                </div>
              </ScrollArea>

              {step === "boleto" ? (
                <div className="border-t bg-muted/30 px-6 py-4 flex justify-end">
                  <Button size="lg" onClick={() => onOpenChange(false)} className="gap-2">
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
                    <Button onClick={() => setStep("pagamento")} className="gap-2">
                      Continuar <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  {step === "pagamento" && (
                    <Button
                      onClick={() => setStep("confirmar")}
                      disabled={!forma}
                      className="gap-2"
                    >
                      Continuar <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  {step === "confirmar" && (
                    <Button
                      onClick={() => void handleConfirmar()}
                      disabled={processing || !forma}
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
                          {forma === "pix" ? "Gerar PIX" : "Gerar Boleto"}
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
        onPaymentConfirmed={() => {
          setPixModalOpen(false);
          onPago?.();
        }}
      />
    </>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-right", highlight && "text-primary font-bold text-lg")}>
        {value}
      </span>
    </div>
  );
}
