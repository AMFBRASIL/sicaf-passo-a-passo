import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Wrench,
  CheckCircle2,
  CalendarIcon,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Receipt,
  History,
  Bell,
  Download,
  ShieldCheck,
  Zap,
  Clock,
  TrendingUp,
  FileText,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { EmpresaData } from "@/routes/empresas";
import { PagamentoModal } from "@/components/pagamento-modal";

const DIAS = [1, 5, 10, 15, 20, 25];
const VALOR = 149;

type Mode = "ativar" | "gerenciar";
type Step = "plano" | "vencimento" | "confirmar" | "sucesso";

export function ManutencaoModal({
  open,
  onOpenChange,
  empresa,
  mode,
  diaVencimento,
  onAtivar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: EmpresaData | null;
  mode: Mode;
  diaVencimento?: number;
  onAtivar: (cnpj: string, dia: number) => void;
}) {
  const [step, setStep] = useState<Step>("plano");
  const [dia, setDia] = useState<number | null>(null);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (open && mode === "ativar") {
      setStep("plano");
      setDia(null);
      setDataInicio(new Date());
    }
  }, [open, mode]);

  if (!empresa) return null;

  const steps: { id: Step; label: string }[] = [
    { id: "plano", label: "Plano" },
    { id: "vencimento", label: "Vencimento" },
    { id: "confirmar", label: "Confirmar" },
  ];
  const stepIdx = steps.findIndex((s) => s.id === step);

  const handleAtivar = () => {
    if (!dia) return;
    onAtivar(empresa.cnpj, dia);
    setStep("sucesso");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 sm:rounded-2xl">
        <div className="grid md:grid-cols-[260px_1fr] min-h-[560px]">
          {/* Sidebar */}
          <aside className="relative hidden md:flex flex-col justify-between bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground p-6 overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_55%)]" />
            <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <Wrench className="h-5 w-5" />
                </div>
                <span className="text-xs uppercase tracking-wider font-semibold opacity-90">
                  CADBRASIL
                </span>
              </div>
              <h2 className="text-2xl font-bold leading-tight">
                {mode === "ativar" ? "Ativar Manutenção" : "Gerenciar Manutenção"}
              </h2>
              <p className="text-sm opacity-90 mt-2">
                {mode === "ativar"
                  ? "Tudo automático. Você nunca mais se preocupa com SICAF."
                  : "Plano ativo. Acompanhe boletos, histórico e atualizações."}
              </p>

              {mode === "ativar" && (
                <ol className="mt-8 space-y-3">
                  {steps.map((s, i) => {
                    const done = i < stepIdx || step === "sucesso";
                    const active = i === stepIdx && step !== "sucesso";
                    return (
                      <li key={s.id} className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition",
                            done && "bg-white text-primary border-white",
                            active && "bg-white/20 border-white",
                            !done && !active && "bg-transparent border-white/30 text-white/60"
                          )}
                        >
                          {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                        </span>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            !done && !active && "opacity-60"
                          )}
                        >
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <div className="relative text-xs opacity-80 space-y-1">
              <p className="font-semibold">{empresa.nome}</p>
              <p>CNPJ {empresa.cnpj}</p>
            </div>
          </aside>

          {/* Conteúdo */}
          <div className="flex flex-col min-h-0">
            <ScrollArea className="flex-1 max-h-[80vh]">
              <div className="p-6 sm:p-8">
                {mode === "ativar" && step === "plano" && (
                  <PlanoStep />
                )}
                {mode === "ativar" && step === "vencimento" && (
                  <VencimentoStep
                    dia={dia}
                    setDia={setDia}
                    dataInicio={dataInicio}
                    setDataInicio={setDataInicio}
                  />
                )}
                {mode === "ativar" && step === "confirmar" && (
                  <ConfirmarStep empresa={empresa} dia={dia!} dataInicio={dataInicio} />
                )}
                {mode === "ativar" && step === "sucesso" && (
                  <SucessoStep empresa={empresa} dia={dia!} onClose={() => onOpenChange(false)} />
                )}
                {mode === "gerenciar" && (
                  <GerenciarPanel empresa={empresa} dia={diaVencimento ?? 15} />
                )}
              </div>
            </ScrollArea>

            {mode === "ativar" && step !== "sucesso" && (
              <div className="border-t bg-muted/30 px-6 py-4 flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (step === "plano") onOpenChange(false);
                    else if (step === "vencimento") setStep("plano");
                    else if (step === "confirmar") setStep("vencimento");
                  }}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {step === "plano" ? "Cancelar" : "Voltar"}
                </Button>
                {step === "plano" && (
                  <Button onClick={() => setStep("vencimento")} className="gap-2">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {step === "vencimento" && (
                  <Button onClick={() => setStep("confirmar")} disabled={!dia} className="gap-2">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {step === "confirmar" && (
                  <Button onClick={handleAtivar} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Ativar manutenção
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

function PlanoStep() {
  const features = [
    { icon: ShieldCheck, t: "Renovação SICAF automática", d: "Cuidamos do seu cadastro antes do vencimento." },
    { icon: FileText, t: "Emissão e envio de certidões", d: "Federal, Estadual, Municipal, FGTS e CNDT." },
    { icon: Bell, t: "Alertas em todos os canais", d: "WhatsApp, e-mail, push e SMS." },
    { icon: Zap, t: "Atendimento prioritário", d: "Especialistas dedicados sempre que precisar." },
  ];
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="secondary" className="mb-2">Plano Manutenção Mensal</Badge>
        <h3 className="text-2xl font-bold leading-tight">Tudo para sua empresa ficar 100% pronta</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Por apenas R$ {VALOR},00/mês. Cancele quando quiser.
        </p>
      </div>

      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-5 flex items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Mensalidade</p>
          <p className="text-4xl font-bold mt-1">R$ {VALOR}<span className="text-base font-normal text-muted-foreground">,00</span></p>
          <p className="text-xs text-muted-foreground mt-1">Pago via boleto · sem fidelidade</p>
        </div>
        <Badge className="ml-auto gap-1"><Sparkles className="h-3 w-3" /> Mais escolhido</Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {features.map((f) => (
          <div key={f.t} className="flex gap-3 rounded-xl border p-4 bg-card">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <f.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{f.t}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.d}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VencimentoStep({
  dia,
  setDia,
  dataInicio,
  setDataInicio,
}: {
  dia: number | null;
  setDia: (d: number) => void;
  dataInicio: Date | undefined;
  setDataInicio: (d: Date | undefined) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold leading-tight">Escolha o vencimento dos boletos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O dia em que sua mensalidade vencerá todos os meses.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Dia do mês
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {DIAS.map((d) => {
            const active = d === dia;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDia(d)}
                className={cn(
                  "h-20 rounded-xl border-2 flex flex-col items-center justify-center transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-soft scale-105"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                <span className="text-2xl font-bold">{d}</span>
                <span className={cn("text-[10px] uppercase tracking-wider", active ? "opacity-90" : "text-muted-foreground")}>
                  todo mês
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Início da cobrança
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataInicio ? format(dataInicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecionar data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
      </div>

      {dia && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm">
          <p className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Resumo
          </p>
          <p className="text-muted-foreground mt-1">
            Boletos de <strong className="text-foreground">R$ {VALOR},00</strong> serão emitidos todo dia{" "}
            <strong className="text-foreground">{dia}</strong> a partir de{" "}
            <strong className="text-foreground">
              {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "hoje"}
            </strong>.
          </p>
        </div>
      )}
    </div>
  );
}

function ConfirmarStep({
  empresa,
  dia,
  dataInicio,
}: {
  empresa: EmpresaData;
  dia: number;
  dataInicio: Date | undefined;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold leading-tight">Confirme sua ativação</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Revise os dados antes de ativar a manutenção automática.
        </p>
      </div>

      <div className="rounded-2xl border overflow-hidden">
        <div className="bg-muted/40 px-5 py-3 border-b">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Empresa
          </p>
          <p className="font-semibold mt-0.5">{empresa.nome}</p>
          <p className="text-xs text-muted-foreground">CNPJ {empresa.cnpj}</p>
        </div>
        <div className="divide-y">
          <Row label="Plano" value="Manutenção Mensal CADBRASIL" />
          <Row label="Valor mensal" value={`R$ ${VALOR},00`} highlight />
          <Row label="Vencimento" value={`Todo dia ${dia} do mês`} />
          <Row
            label="Primeira cobrança"
            value={dataInicio ? format(dataInicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—"}
          />
          <Row label="Forma de pagamento" value="Boleto bancário" />
        </div>
      </div>

      <div className="rounded-xl bg-success/5 border border-success/30 p-4 text-sm flex gap-3">
        <ShieldCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Sem fidelidade</p>
          <p className="text-muted-foreground mt-0.5">
            Você pode cancelar a qualquer momento direto no painel.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", highlight && "text-primary font-bold text-base")}>{value}</span>
    </div>
  );
}

function SucessoStep({ empresa, dia, onClose }: { empresa: EmpresaData; dia: number; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-8 space-y-5">
      <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-success" />
      </div>
      <div>
        <h3 className="text-2xl font-bold">Manutenção ativada!</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          A partir de agora a CADBRASIL cuida de tudo para{" "}
          <strong className="text-foreground">{empresa.nome}</strong>. Seus boletos vencerão todo dia{" "}
          <strong className="text-foreground">{dia}</strong>.
        </p>
      </div>
      <Button onClick={onClose} size="lg" className="gap-2">
        Concluir <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function GerenciarPanel({ empresa, dia }: { empresa: EmpresaData; dia: number }) {
  const hoje = new Date();
  const boletos = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, dia);
    const pago = i < 2;
    const atual = i === 2;
    return {
      id: i,
      data: d,
      status: pago ? "pago" : atual ? "aberto" : "futuro",
    };
  });
  const [pagBoleto, setPagBoleto] = useState<{ data: Date } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Manutenção ativa
          </Badge>
          <h3 className="text-2xl font-bold mt-2 leading-tight">Painel da manutenção</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {empresa.nome} · Vencimento todo dia {dia}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Mensalidade</p>
          <p className="text-2xl font-bold">R$ {VALOR},00</p>
        </div>
      </div>

      <Tabs defaultValue="visao">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="boletos">Boletos</TabsTrigger>
          <TabsTrigger value="atualizacoes">Atualizações</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-4 mt-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <Kpi icon={TrendingUp} label="Meses ativos" value="2" />
            <Kpi icon={Receipt} label="Próxima cobrança" value={format(boletos[2].data, "dd/MM")} />
            <Kpi icon={Sparkles} label="Ações realizadas" value="14" />
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm font-semibold mb-2">Progresso do ano</p>
            <Progress value={(2 / 12) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">2 de 12 mensalidades pagas</p>
          </div>
        </TabsContent>

        <TabsContent value="boletos" className="space-y-2 mt-4">
          {boletos.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 bg-card">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center",
                  b.status === "pago" && "bg-success/15 text-success",
                  b.status === "aberto" && "bg-warning/15 text-warning-foreground",
                  b.status === "futuro" && "bg-muted text-muted-foreground",
                )}>
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    Mensalidade {format(b.data, "MMM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vence em {format(b.data, "dd/MM/yyyy")} · R$ {VALOR},00
                  </p>
                </div>
              </div>
              {b.status === "pago" && (
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Comprovante
                </Button>
              )}
              {b.status === "aberto" && (
                <Button size="sm" className="gap-1.5" onClick={() => setPagBoleto({ data: b.data })}>Pagar agora</Button>
              )}
              {b.status === "futuro" && (
                <Badge variant="secondary">Programado</Badge>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="atualizacoes" className="space-y-2 mt-4">
          {[
            { t: "Renovação SICAF Nível I e II", d: "Concluída em 02/01/2026", icon: ShieldCheck },
            { t: "Atualização cadastral mensal", d: "15/12/2025", icon: Sparkles },
            { t: "Verificação de certidões", d: "01/12/2025", icon: FileText },
            { t: "Envio automático CNDT", d: "20/11/2025", icon: Bell },
          ].map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border p-4 bg-card">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <a.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{a.t}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.d}</p>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="historico" className="space-y-3 mt-4">
          <ol className="relative border-l-2 border-border ml-2 space-y-4 pl-5">
            {[
              { q: "Hoje, 09:14", a: "Plano ativado", t: "ok" as const },
              { q: "02/01/2026", a: "Boleto pago — Janeiro/2026", t: "ok" as const },
              { q: "15/12/2025", a: "Boleto emitido — Dezembro/2025", t: "info" as const },
              { q: "10/12/2025", a: "Alerta enviado: CNDT", t: "warn" as const },
            ].map((h, i) => (
              <li key={i} className="relative">
                <span className={cn(
                  "absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-card",
                  h.t === "ok" && "bg-success",
                  h.t === "warn" && "bg-warning",
                  h.t === "info" && "bg-primary",
                )} />
                <p className="text-sm font-medium">{h.a}</p>
                <p className="text-xs text-muted-foreground">{h.q}</p>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>
      <PagamentoModal
        open={!!pagBoleto}
        onOpenChange={(v) => !v && setPagBoleto(null)}
        empresa={empresa}
        descricao={pagBoleto ? `Mensalidade ${format(pagBoleto.data, "MMM/yyyy", { locale: ptBR })}` : "mensalidade"}
        valor={VALOR}
        vencimentoPadrao={pagBoleto ? format(pagBoleto.data, "yyyy-MM-dd") : undefined}
      />
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Receipt; label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4 bg-card">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
