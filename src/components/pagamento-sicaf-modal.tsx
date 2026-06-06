import { useEffect, useState } from "react";
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
  CheckCircle2,
  CalendarClock,
  Sparkles,
  Lock,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import bgImg from "@/assets/sicaf-pagamento.jpg";

type Plano = "padrao" | "imediato";
type Pagamento = "pix" | "boleto";
type Step = "plano" | "pagamento" | "confirmar" | "sucesso";

const PLANOS: {
  id: Plano;
  titulo: string;
  preco: number;
  prazo: string;
  desc: string;
  icon: typeof Briefcase;
  badge: string;
  destaque?: boolean;
}[] = [
  {
    id: "padrao",
    titulo: "Cadastro Padrão",
    preco: 985,
    prazo: "Liberado em até 24 horas",
    desc: "Ideal para quem se planejou e não tem urgência. Equipe CADBRASIL cuida de tudo no próximo dia útil.",
    icon: Briefcase,
    badge: "Mais escolhido",
  },
  {
    id: "imediato",
    titulo: "Liberação Imediata",
    preco: 1480,
    prazo: "Início imediato — prioridade máxima",
    desc: "Sua empresa entra na frente da fila. Nosso time começa agora mesmo a regularização do SICAF.",
    icon: Zap,
    badge: "Mais rápido",
    destaque: true,
  },
];

const steps: { id: Step; label: string }[] = [
  { id: "plano", label: "Plano" },
  { id: "pagamento", label: "Pagamento" },
  { id: "confirmar", label: "Confirmar" },
];

export function PagamentoSicafModal({
  open,
  onOpenChange,
  empresa,
  onPago,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: { nome: string; cnpj: string };
  onPago?: () => void;
}) {
  const [step, setStep] = useState<Step>("plano");
  const [plano, setPlano] = useState<Plano | null>(null);
  const [pagamento, setPagamento] = useState<Pagamento | null>(null);

  const vencimento = addDays(new Date(), 4);
  const planoSel = PLANOS.find((p) => p.id === plano) ?? null;

  useEffect(() => {
    if (open) {
      setStep("plano");
      setPlano(null);
      setPagamento(null);
    }
  }, [open]);

  const stepIdx = steps.findIndex((s) => s.id === step);

  const valorFmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleConfirmar = () => {
    setStep("sucesso");
    onPago?.();
  };

  return (
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
                  const done = i < stepIdx || step === "sucesso";
                  const active = i === stepIdx && step !== "sucesso";
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

                    <div className="grid sm:grid-cols-2 gap-4">
                      {PLANOS.map((p) => {
                        const Icon = p.icon;
                        const sel = plano === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPlano(p.id)}
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

                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm flex gap-3">
                      <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Taxa única de cadastro</p>
                        <p className="text-muted-foreground mt-0.5">
                          Pagamento único. A manutenção mensal é opcional e pode
                          ser ativada depois.
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
                          {planoSel ? valorFmt(planoSel.preco) : ""}
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
                              Data de vencimento
                            </p>
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Lock className="h-3 w-3" /> Fixo
                            </Badge>
                          </div>
                          <p className="text-base font-bold mt-1">
                            {format(vencimento, "dd 'de' MMMM 'de' yyyy", {
                              locale: ptBR,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Vencimento padrão de 4 dias após a emissão. Não pode
                            ser alterado.
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
                        <Row
                          label="Vencimento"
                          value={format(vencimento, "dd/MM/yyyy")}
                        />
                        <Row
                          label="Valor total"
                          value={valorFmt(planoSel.preco)}
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

                {step === "sucesso" && planoSel && (
                  <div className="flex flex-col items-center text-center py-10 space-y-5">
                    <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center">
                      <CheckCircle2 className="h-10 w-10 text-success" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">
                        {pagamento === "pix"
                          ? "PIX gerado com sucesso!"
                          : "Boleto gerado com sucesso!"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-md">
                        Valor de{" "}
                        <strong className="text-foreground">
                          {valorFmt(planoSel.preco)}
                        </strong>{" "}
                        com vencimento em{" "}
                        <strong className="text-foreground">
                          {format(vencimento, "dd/MM/yyyy")}
                        </strong>
                        . Assim que confirmarmos o pagamento, sua atualização
                        SICAF começa.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => onOpenChange(false)}
                      className="gap-2"
                    >
                      Continuar <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>

            {step !== "sucesso" && (
              <div className="border-t bg-muted/30 px-6 py-4 flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (step === "plano") onOpenChange(false);
                    else if (step === "pagamento") setStep("plano");
                    else if (step === "confirmar") setStep("pagamento");
                  }}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {step === "plano" ? "Cancelar" : "Voltar"}
                </Button>
                {step === "plano" && (
                  <Button
                    onClick={() => setStep("pagamento")}
                    disabled={!plano}
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
                  <Button onClick={handleConfirmar} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    {pagamento === "pix" ? "Gerar PIX" : "Gerar Boleto"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
