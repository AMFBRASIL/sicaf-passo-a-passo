import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { EmpresaData } from "@/lib/empresas-shared";
import type { EmpresaGerenciarPainel } from "@/lib/empresas-api";
import {
  getManutencaoBloqueioMotivo,
  podeAtivarManutencaoFromEmpresa,
  podeAtivarManutencaoFromPainel,
} from "@/lib/sicaf-access-rules";
import { PagamentoModal } from "@/components/pagamento-modal";
import { ManutencaoComprovanteModal } from "@/components/manutencao-comprovante-modal";
import {
  ativarManutencao,
  autorizarBoletoManutencao,
  calcParcelamentoManutencao,
  cancelarManutencao,
  fetchManutencaoCliente,
  fetchValorManutencaoMensal,
  fmtBrl,
  type ManutencaoBoleto,
  type ParcelamentoManutencao,
} from "@/lib/manutencao-api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";

const DIAS = [1, 5, 10, 15, 20, 25];

const PARCELAMENTO_OPCOES: ParcelamentoManutencao[] = ["avista", "6x", "12x"];

type Mode = "ativar" | "gerenciar";
type Step = "plano" | "vencimento" | "confirmar" | "sucesso";
type GerStep = "visao" | "boletos" | "atualizacoes" | "historico";

const GER_STEPS: { id: GerStep; label: string; desc: string; icon: typeof Receipt }[] = [
  { id: "visao", label: "Visão geral", desc: "Resumo do plano", icon: TrendingUp },
  { id: "boletos", label: "Boletos", desc: "Cobranças mensais", icon: Receipt },
  { id: "atualizacoes", label: "Atualizações", desc: "Ações realizadas", icon: Sparkles },
  { id: "historico", label: "Histórico", desc: "Linha do tempo", icon: History },
];

export function ManutencaoModal({
  open,
  onOpenChange,
  empresa,
  painel,
  mode,
  diaVencimento,
  onAtivar,
  onCancelar,
  onPaymentGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: EmpresaData | null;
  painel?: EmpresaGerenciarPainel | null;
  mode: Mode;
  diaVencimento?: number;
  onAtivar: (cnpj: string, dia: number) => void;
  onCancelar?: (cnpj: string) => void;
  onPaymentGenerated?: () => void;
}) {
  const [step, setStep] = useState<Step>("plano");
  const [gerStep, setGerStep] = useState<GerStep>("visao");
  const [dia, setDia] = useState<number | null>(null);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(new Date());
  const [ativando, setAtivando] = useState(false);
  const [effectiveMode, setEffectiveMode] = useState<Mode>(mode);
  const [planoAtivo, setPlanoAtivo] = useState(false);
  const [valorMensal, setValorMensal] = useState(155);
  const [parcelamento, setParcelamento] = useState<ParcelamentoManutencao>("12x");

  const sicafElegivel = useMemo(() => {
    if (!empresa) return false;
    if (painel) return podeAtivarManutencaoFromPainel(painel);
    return podeAtivarManutencaoFromEmpresa(empresa);
  }, [empresa, painel]);

  const bloqueioMotivo = useMemo(
    () => (empresa ? getManutencaoBloqueioMotivo(painel, empresa) : null),
    [painel, empresa],
  );

  const ativacaoBloqueada = effectiveMode === "ativar" && !sicafElegivel;

  useEffect(() => {
    if (!open || !empresa) return;
    void fetchValorManutencaoMensal().then(setValorMensal);
    if (!empresa.clienteId) {
      setPlanoAtivo(false);
      setEffectiveMode(mode);
      return;
    }
    if (mode === "gerenciar") {
      setEffectiveMode("gerenciar");
    }
    let cancelled = false;
    void fetchManutencaoCliente(empresa.clienteId).then((res) => {
      if (cancelled) return;
      const ativo = !!(res.ok && res.manutencao);
      setPlanoAtivo(ativo);
      setEffectiveMode(ativo ? "gerenciar" : "ativar");
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, empresa?.clienteId, empresa?.cnpj]);

  useEffect(() => {
    if (!open) return;
    if (effectiveMode === "ativar") {
      setStep("plano");
      setDia(null);
      setParcelamento("12x");
      setDataInicio(new Date());
    } else {
      setGerStep("visao");
    }
  }, [open, effectiveMode]);

  const handlePlanoCancelado = () => {
    setPlanoAtivo(false);
    setEffectiveMode("ativar");
    setStep("plano");
    setDia(null);
    setParcelamento("12x");
    setDataInicio(new Date());
    setGerStep("visao");
    onCancelar?.(empresa.cnpj);
  };

  if (!empresa) return null;

  const steps: { id: Step; label: string }[] = [
    { id: "plano", label: "Plano" },
    { id: "vencimento", label: "Vencimento" },
    { id: "confirmar", label: "Confirmar" },
  ];
  const stepIdx = steps.findIndex((s) => s.id === step);

  const handleAtivar = async () => {
    if (!dia) return;
    if (!sicafElegivel) {
      toast.error(bloqueioMotivo || "É necessário ter o SICAF pago e vigente antes de ativar a manutenção.");
      return;
    }
    if (!empresa.clienteId) {
      toast.error("Empresa sem identificador. Recarregue a página.");
      return;
    }
    setAtivando(true);
    const res = await ativarManutencao(empresa.clienteId, dia, parcelamento);
    setAtivando(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao ativar manutenção");
      return;
    }
    onAtivar(empresa.cnpj, dia);
    setPlanoAtivo(true);
    setEffectiveMode("gerenciar");
    setStep("sucesso");
    toast.success(res.message || "Manutenção ativada com sucesso!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">
          {effectiveMode === "ativar" ? "Ativar manutenção" : "Gerenciar manutenção"}
        </DialogTitle>
        <div className="grid md:grid-cols-[280px_1fr] min-h-[600px]">
          {/* Sidebar wizard */}
          <aside
            className="relative hidden md:flex flex-col p-6 text-white overflow-hidden"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.86), rgba(15,23,42,0.96)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
                <Wrench className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80 tracking-wider">
                {effectiveMode === "ativar" ? "ATIVAÇÃO" : "MANUTENÇÃO"}
              </span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">
              {effectiveMode === "ativar" ? "Ativar Manutenção" : "Painel da manutenção"}
            </h2>
            <p className="mt-1 text-xs text-white/70 truncate">{empresa.nome}</p>

            <div className="mt-6 space-y-1">
              {effectiveMode === "ativar" &&
                steps.map((s, i) => {
                  const done = i < stepIdx || step === "sucesso";
                  const active = i === stepIdx && step !== "sucesso";
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "w-full rounded-lg px-3 py-2.5 flex items-start gap-3 transition",
                        active ? "bg-white/15 backdrop-blur" : "hover:bg-white/5"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                          active && "bg-white text-slate-900",
                          done && "bg-emerald-500/80 text-white",
                          !active && !done && "bg-white/10"
                        )}
                      >
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{s.label}</div>
                      </div>
                    </div>
                  );
                })}

              {effectiveMode === "gerenciar" &&
                GER_STEPS.map((s) => {
                  const Icon = s.icon;
                  const active = s.id === gerStep;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setGerStep(s.id)}
                      className={cn(
                        "w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-3 transition",
                        active ? "bg-white/15 backdrop-blur" : "hover:bg-white/5"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          active ? "bg-white text-slate-900" : "bg-white/10"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{s.label}</div>
                        <div className="text-[11px] text-white/60 truncate">{s.desc}</div>
                      </div>
                    </button>
                  );
                })}
            </div>

            {effectiveMode === "gerenciar" && planoAtivo && (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur p-3">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Plano ativo</span>
                </div>
                <p className="text-xs text-white/70 mt-1">
                  Vencimento todo dia {diaVencimento ?? 15}
                </p>
                <p className="text-lg font-bold mt-1">
                  {fmtBrl(valorMensal)}
                  <span className="text-xs font-normal text-white/60">/mês</span>
                </p>
              </div>
            )}
            {effectiveMode === "ativar" && (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur p-3">
                <p className="text-xs text-white/70">Nenhum plano ativo</p>
                <p className="text-sm font-medium mt-1">Configure um novo plano de manutenção</p>
              </div>
            )}

            <div className="mt-auto pt-6 text-[11px] text-white/60">
              <p className="font-semibold">CNPJ {empresa.cnpj}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <ShieldCheck className="h-3 w-3" /> Operação auditada CADBRASIL
              </div>
            </div>
          </aside>

          {/* Conteúdo */}
          <div className="flex flex-col min-h-0 bg-background">
            <ScrollArea className="flex-1 max-h-[80vh]">
              <div className="p-6 sm:p-8">
                {ativacaoBloqueada ? (
                  <ManutencaoSicafBloqueioStep
                    motivo={bloqueioMotivo}
                    cnpj={empresa.cnpj}
                    onClose={() => onOpenChange(false)}
                  />
                ) : (
                  <>
                {effectiveMode === "ativar" && step === "plano" && (
                  <PlanoStep
                    valorMensal={valorMensal}
                    parcelamento={parcelamento}
                    setParcelamento={setParcelamento}
                  />
                )}
                {effectiveMode === "ativar" && step === "vencimento" && (
                  <VencimentoStep
                    dia={dia}
                    setDia={setDia}
                    dataInicio={dataInicio}
                    setDataInicio={setDataInicio}
                    valorMensal={valorMensal}
                    parcelamento={parcelamento}
                  />
                )}
                {effectiveMode === "ativar" && step === "confirmar" && (
                  <ConfirmarStep
                    empresa={empresa}
                    dia={dia!}
                    dataInicio={dataInicio}
                    valorMensal={valorMensal}
                    parcelamento={parcelamento}
                  />
                )}
                {effectiveMode === "ativar" && step === "sucesso" && (
                  <SucessoStep empresa={empresa} dia={dia!} onClose={() => onOpenChange(false)} />
                )}
                {effectiveMode === "gerenciar" && (
                  <GerenciarPanel
                    open={open}
                    empresa={empresa}
                    dia={diaVencimento ?? 15}
                    step={gerStep}
                    valorMensal={valorMensal}
                    onCancelar={handlePlanoCancelado}
                    onPaymentGenerated={onPaymentGenerated}
                  />
                )}
                  </>
                )}
              </div>
            </ScrollArea>

            {effectiveMode === "ativar" && step !== "sucesso" && !ativacaoBloqueada && (
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
                  <Button onClick={() => setStep("vencimento")} disabled={!parcelamento} className="gap-2">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {step === "vencimento" && (
                  <Button onClick={() => setStep("confirmar")} disabled={!dia} className="gap-2">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {step === "confirmar" && (
                  <Button onClick={() => void handleAtivar()} disabled={ativando} className="gap-2">
                    {ativando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {ativando ? "Ativando..." : "Ativar manutenção"}
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

function ManutencaoSicafBloqueioStep({
  motivo,
  cnpj,
  onClose,
}: {
  motivo: string | null;
  cnpj: string;
  onClose: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-tight">SICAF precisa estar em dia</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {motivo ||
          "É necessário ter o SICAF pago e vigente antes de contratar a manutenção mensal."}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        A manutenção cuida da renovação do seu cadastro — ela só pode ser ativada depois que a taxa
        SICAF estiver quitada e o cadastro estiver ativo.
      </p>
      <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button asChild className="gap-1.5">
          <Link to="/sicaf" search={{ cnpj }} onClick={onClose}>
            Ir para Etapas SICAF
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function PlanoStep({
  valorMensal,
  parcelamento,
  setParcelamento,
}: {
  valorMensal: number;
  parcelamento: ParcelamentoManutencao;
  setParcelamento: (p: ParcelamentoManutencao) => void;
}) {
  const totalAnual = valorMensal * 12;
  const features = [
    { icon: ShieldCheck, t: "Renovação SICAF automática", d: "Cuidamos do seu cadastro antes do vencimento." },
    { icon: FileText, t: "Emissão e envio de certidões", d: "Federal, Estadual, Municipal, FGTS e CNDT." },
    { icon: Bell, t: "Alertas em todos os canais", d: "WhatsApp, e-mail, push e SMS." },
    { icon: Zap, t: "Atendimento prioritário", d: "Especialistas dedicados sempre que precisar." },
  ];
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="secondary" className="mb-2">Plano Manutenção Anual</Badge>
        <h3 className="text-2xl font-bold leading-tight">Tudo para sua empresa ficar 100% pronta</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Referência {fmtBrl(valorMensal)}/mês · total anual {fmtBrl(totalAnual)}. Cancele quando quiser.
        </p>
      </div>

      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor de referência mensal</p>
        <p className="text-4xl font-bold mt-1">{fmtBrl(valorMensal)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Contrato anual de {fmtBrl(totalAnual)} · escolha como parcelar abaixo
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Forma de pagamento
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {PARCELAMENTO_OPCOES.map((opcao) => {
            const calc = calcParcelamentoManutencao(valorMensal, opcao);
            const active = parcelamento === opcao;
            return (
              <button
                key={opcao}
                type="button"
                onClick={() => setParcelamento(opcao)}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition",
                  active
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{calc.titulo}</p>
                  {opcao === "12x" && (
                    <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                  )}
                </div>
                <p className="text-2xl font-bold mt-2 text-primary">
                  {opcao === "avista" ? fmtBrl(calc.valorParcela) : fmtBrl(calc.valorParcela)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {opcao === "avista"
                    ? "Pagamento único"
                    : `${calc.parcelas}x de ${fmtBrl(calc.valorParcela)}`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-2">{calc.subtitulo}</p>
                <p className="text-xs font-medium mt-2 pt-2 border-t border-border/60">
                  Total: {fmtBrl(calc.total)}
                </p>
              </button>
            );
          })}
        </div>
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
  valorMensal,
  parcelamento,
}: {
  dia: number | null;
  setDia: (d: number) => void;
  dataInicio: Date | undefined;
  setDataInicio: (d: Date | undefined) => void;
  valorMensal: number;
  parcelamento: ParcelamentoManutencao;
}) {
  const calc = calcParcelamentoManutencao(valorMensal, parcelamento);
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
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm space-y-2">
          <p className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Resumo do parcelamento
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">{calc.titulo}</strong> · {calc.subtitulo}
          </p>
          <p className="text-muted-foreground">
            {parcelamento === "avista" ? (
              <>
                Será emitido <strong className="text-foreground">1 boleto</strong> de{" "}
                <strong className="text-foreground">{fmtBrl(calc.valorParcela)}</strong>
              </>
            ) : (
              <>
                Serão emitidos <strong className="text-foreground">{calc.parcelas} boletos</strong> de{" "}
                <strong className="text-foreground">{fmtBrl(calc.valorParcela)}</strong> cada
              </>
            )}
            , vencendo todo dia <strong className="text-foreground">{dia}</strong>, a partir de{" "}
            <strong className="text-foreground">
              {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "hoje"}
            </strong>.
          </p>
          <p className="text-xs font-medium text-foreground pt-1 border-t border-primary/20">
            Total do contrato: {fmtBrl(calc.total)}
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
  valorMensal,
  parcelamento,
}: {
  empresa: EmpresaData;
  dia: number;
  dataInicio: Date | undefined;
  valorMensal: number;
  parcelamento: ParcelamentoManutencao;
}) {
  const calc = calcParcelamentoManutencao(valorMensal, parcelamento);
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
          <Row label="Plano" value="Manutenção Anual CADBRASIL" />
          <Row label="Parcelamento" value={calc.titulo} />
          <Row
            label={parcelamento === "avista" ? "Valor à vista" : "Valor por boleto"}
            value={fmtBrl(calc.valorParcela)}
            highlight
          />
          <Row label="Total do contrato" value={fmtBrl(calc.total)} />
          <Row label="Referência mensal" value={fmtBrl(valorMensal)} />
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

function isBoletoPago(status: string) {
  const s = String(status || "").trim().toLowerCase();
  return s === "pago" || s === "paid";
}

function mapBoletoUiStatus(b: ManutencaoBoleto): "pago" | "aberto" | "futuro" {
  if (isBoletoPago(b.status)) return "pago";
  const venc = new Date(b.vencimento);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (!Number.isNaN(venc.getTime())) {
    venc.setHours(0, 0, 0, 0);
    if (venc.getTime() <= hoje.getTime()) return "aberto";
  }
  return "futuro";
}

function parseBoletoData(b: ManutencaoBoleto, diaFallback: number) {
  const parsed = new Date(b.vencimento);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  if (b.mes && b.ano) return new Date(b.ano, b.mes - 1, diaFallback);
  return new Date();
}

type BoletoUi = {
  id: number;
  data: Date;
  valor: number;
  status: "pago" | "aberto" | "futuro";
  rawStatus: string;
  raw: ManutencaoBoleto;
};

function GerenciarPanel({
  open,
  empresa,
  dia,
  step,
  valorMensal,
  onCancelar,
  onPaymentGenerated,
}: {
  open: boolean;
  empresa: EmpresaData;
  dia: number;
  step: GerStep;
  valorMensal: number;
  onCancelar: () => void;
  onPaymentGenerated?: () => void;
}) {
  const [boletos, setBoletos] = useState<BoletoUi[]>([]);
  const [carregandoBoletos, setCarregandoBoletos] = useState(false);
  const [autorizandoId, setAutorizandoId] = useState<number | null>(null);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [pagBoleto, setPagBoleto] = useState<{ data: Date; boletoId?: number; valor: number } | null>(null);
  const [comprovanteBoleto, setComprovanteBoleto] = useState<BoletoUi | null>(null);

  const carregarBoletos = async () => {
    if (!empresa.clienteId) return;
    setCarregandoBoletos(true);
    const res = await fetchManutencaoCliente(empresa.clienteId);
    setCarregandoBoletos(false);
    if (!res.ok || !res.manutencao?.boletos?.length) {
      setBoletos([]);
      return;
    }
    setBoletos(
      res.manutencao.boletos.map((b) => ({
        id: b.id,
        data: parseBoletoData(b, dia),
        valor: b.valor || res.manutencao!.valor,
        status: mapBoletoUiStatus(b),
        rawStatus: b.status,
        raw: b,
      })),
    );
  };

  useEffect(() => {
    if (!open || !empresa.clienteId) return;
    void carregarBoletos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empresa.clienteId, dia]);

  const handleAutorizar = async (boletoId: number) => {
    if (!empresa.clienteId) {
      toast.error("Empresa sem identificador. Recarregue a página.");
      return;
    }
    setAutorizandoId(boletoId);
    const res = await autorizarBoletoManutencao(boletoId, empresa.clienteId);
    setAutorizandoId(null);
    if (!res.ok) {
      toast.error(res.error || "Falha ao autorizar pagamento.");
      return;
    }
    toast.success(res.message || "Pagamento autorizado com sucesso.");
    await carregarBoletos();
  };

  const handleCancelarPlano = async () => {
    if (!empresa.clienteId) {
      toast.error("Empresa sem identificador. Recarregue a página.");
      return;
    }
    setCancelando(true);
    const res = await cancelarManutencao(empresa.clienteId, motivoCancelamento.trim() || undefined);
    setCancelando(false);
    if (!res.ok) {
      toast.error(res.error || "Falha ao cancelar manutenção.");
      return;
    }
    toast.success(res.message || "Plano de manutenção cancelado.");
    setCancelarOpen(false);
    setMotivoCancelamento("");
    onCancelar();
  };

  const pagos = boletos.filter((b) => b.status === "pago").length;
  const proximoAberto = boletos.find((b) => b.status !== "pago");

  const currentLabel = GER_STEPS.find((s) => s.id === step)?.label ?? "";
  const stepIdxG = GER_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            Etapa {stepIdxG + 1} de {GER_STEPS.length}
          </div>
          <h3 className="text-2xl font-bold mt-1 leading-tight">{currentLabel}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {empresa.nome} · Vencimento todo dia {dia}
          </p>
        </div>
        <div className="w-40 h-1.5 rounded-full bg-muted overflow-hidden mt-2">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((stepIdxG + 1) / GER_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {step === "visao" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <Kpi icon={TrendingUp} label="Meses ativos" value={String(pagos)} />
            <Kpi
              icon={Receipt}
              label="Próxima cobrança"
              value={proximoAberto ? format(proximoAberto.data, "dd/MM") : "—"}
            />
            <Kpi icon={Sparkles} label="Mensalidades" value={String(boletos.length)} />
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm font-semibold mb-2">Progresso do ano</p>
            <Progress
              value={boletos.length ? (pagos / boletos.length) * 100 : 0}
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {pagos} de {boletos.length || 12} mensalidades pagas
            </p>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Cancelar plano de manutenção</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Encerra o plano, cancela todos os boletos pendentes e remove a manutenção desta empresa.
                  Esta ação não pode ser desfeita.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setCancelarOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Cancelar plano
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "boletos" && (
        <div className="space-y-2">
          {carregandoBoletos && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando boletos…
            </div>
          )}
          {!carregandoBoletos && boletos.length === 0 && (
            <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
              Nenhum boleto de manutenção encontrado.
            </div>
          )}
          {!carregandoBoletos &&
            boletos.map((b) => {
              const valorFmt = b.valor.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              const podeAutorizar = !isBoletoPago(b.rawStatus);
              return (
                <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 bg-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center",
                        b.status === "pago" && "bg-success/15 text-success",
                        b.status === "aberto" && "bg-warning/15 text-warning-foreground",
                        b.status === "futuro" && "bg-muted text-muted-foreground",
                      )}
                    >
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        Mensalidade {format(b.data, "MMM/yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence em {format(b.data, "dd/MM/yyyy")} · R$ {valorFmt}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.status === "pago" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setComprovanteBoleto(b)}
                      >
                        <Download className="h-3.5 w-3.5" /> Comprovante
                      </Button>
                    )}
                    {podeAutorizar && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          disabled={autorizandoId === b.id}
                          onClick={() => void handleAutorizar(b.id)}
                        >
                          {autorizandoId === b.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}{" "}
                          Autorizar
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setPagBoleto({ data: b.data, boletoId: b.id, valor: b.valor })}
                        >
                          <Receipt className="h-3.5 w-3.5" /> Gerar Boleto
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {step === "atualizacoes" && (
        <div className="space-y-2">
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
        </div>
      )}

      {step === "historico" && (
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
      )}

      <AlertDialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar plano de manutenção?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  O plano de <strong className="text-foreground">{empresa.nome}</strong> será encerrado.
                  Todos os boletos serão cancelados e o plano será removido.
                </p>
                <div>
                  <label className="text-xs font-medium text-foreground" htmlFor="motivo-cancelamento">
                    Motivo (opcional)
                  </label>
                  <Textarea
                    id="motivo-cancelamento"
                    value={motivoCancelamento}
                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                    placeholder="Ex.: solicitação do cliente"
                    className="mt-1.5 min-h-[72px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleCancelarPlano();
              }}
            >
              {cancelando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Cancelando…
                </>
              ) : (
                "Confirmar cancelamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PagamentoModal
        open={!!pagBoleto}
        onOpenChange={(v) => !v && setPagBoleto(null)}
        empresa={empresa}
        descricao={pagBoleto ? `Mensalidade ${format(pagBoleto.data, "MMM/yyyy", { locale: ptBR })}` : "mensalidade"}
        valor={pagBoleto?.valor ?? valorMensal}
        vencimentoPadrao={pagBoleto ? format(pagBoleto.data, "yyyy-MM-dd") : undefined}
        boletoId={pagBoleto?.boletoId}
        clienteId={empresa.clienteId}
        onPaymentGenerated={() => {
          void carregarBoletos();
          onPaymentGenerated?.();
        }}
      />

      <ManutencaoComprovanteModal
        open={!!comprovanteBoleto}
        onOpenChange={(v) => !v && setComprovanteBoleto(null)}
        boletoId={comprovanteBoleto?.id ?? null}
        boletoSeed={comprovanteBoleto?.raw ?? null}
        empresaNome={empresa.nome}
        empresaCnpj={empresa.cnpj}
        emailPadrao={empresa.email}
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
