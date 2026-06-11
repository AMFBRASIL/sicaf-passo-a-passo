import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import {
  Bot,
  Zap,
  Mail,
  MessageCircle,
  FileCheck2,
  DollarSign,
  Bell,
  Calendar,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Send,
  Plus,
  Trash2,
  GripVertical,
  Wand2,
  Clock,
  AlertTriangle,
  Target,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";
import {
  GATILHOS_CATALOG,
  GATILHOS_GRUPOS,
  TEMPLATES_IA,
  gatilhoLabel,
  type FluxoAutomacao,
  type AcaoAutomacaoTipo,
} from "@/lib/automacoes-catalog";

export type { FluxoAutomacao };

type AcaoTipo = AcaoAutomacaoTipo;

const ACAO_CATALOG: { tipo: AcaoTipo; label: string; icon: any; desc: string }[] = [
  { tipo: "email", label: "Enviar e-mail", icon: Mail, desc: "Mensagem por e-mail com template" },
  { tipo: "whatsapp", label: "Enviar WhatsApp", icon: MessageCircle, desc: "Mensagem direta no WhatsApp" },
  { tipo: "ticket", label: "Criar ticket", icon: FileCheck2, desc: "Abrir ticket no atendimento" },
  { tipo: "tarefa", label: "Criar tarefa", icon: CheckCircle2, desc: "Atribuir tarefa a um operador" },
  { tipo: "cobranca", label: "Gerar cobrança", icon: DollarSign, desc: "PIX/boleto 2ª via" },
  { tipo: "acesso", label: "Liberar acesso", icon: Zap, desc: "Permissões e módulos" },
  { tipo: "alerta", label: "Alertar equipe", icon: Bell, desc: "Notificar gerente/responsável" },
  { tipo: "agendar", label: "Agendar follow-up", icon: Calendar, desc: "Lembrete futuro" },
];

const GATILHOS = GATILHOS_CATALOG;

type StepKey = "info" | "gatilho" | "acoes" | "revisar";

const steps: { key: StepKey; label: string; desc: string; icon: any }[] = [
  { key: "info", label: "Informações", desc: "Nome e descrição", icon: Bot },
  { key: "gatilho", label: "Gatilho", desc: "Quando disparar", icon: Zap },
  { key: "acoes", label: "Ações", desc: "O que executar", icon: Target },
  { key: "revisar", label: "Revisar", desc: "Confirmar e ativar", icon: CheckCircle2 },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fluxo?: FluxoAutomacao | null;
  onSalvar?: (f: FluxoAutomacao) => void;
}

const empty: FluxoAutomacao = {
  nome: "",
  descricao: "",
  gatilho: "",
  gatilhoTipo: "",
  condicoes: "",
  acoes: [],
  ativo: true,
};

export function FluxoAutomacaoModal({ open, onOpenChange, fluxo, onSalvar }: Props) {
  const [step, setStep] = useState<StepKey>("info");
  const [data, setData] = useState<FluxoAutomacao>(empty);
  const [iaPrompt, setIaPrompt] = useState("");
  const [iaLoading, setIaLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setData(fluxo ? { ...fluxo } : empty);
      setStep("info");
      setIaPrompt("");
    }
  }, [open, fluxo]);

  const canNext: Record<StepKey, boolean> = {
    info: !!data.nome.trim(),
    gatilho: !!data.gatilhoTipo,
    acoes: data.acoes.length > 0,
    revisar: true,
  };

  const adicionarAcao = (tipo: AcaoTipo) => {
    const cat = ACAO_CATALOG.find((c) => c.tipo === tipo)!;
    setData({ ...data, acoes: [...data.acoes, { tipo, label: cat.label, delay: "imediato" }] });
  };

  const removerAcao = (i: number) =>
    setData({ ...data, acoes: data.acoes.filter((_, idx) => idx !== i) });

  const moverAcao = (i: number, dir: -1 | 1) => {
    const novo = [...data.acoes];
    const target = i + dir;
    if (target < 0 || target >= novo.length) return;
    [novo[i], novo[target]] = [novo[target], novo[i]];
    setData({ ...data, acoes: novo });
  };

  const gerarComIA = () => {
    if (!iaPrompt.trim()) {
      toast.error("Descreva o que você quer automatizar");
      return;
    }
    setIaLoading(true);
    setTimeout(() => {
      // mock: pick template that loosely matches
      const lower = iaPrompt.toLowerCase();
      const tpl =
        TEMPLATES_IA.find((t) =>
          lower.includes("cobr") ? t.nome.includes("cobrança") :
          lower.includes("risc") || lower.includes("cancel") ? t.nome.includes("Retenção") :
          t.nome.includes("Boas-vindas"),
        ) ?? TEMPLATES_IA[0];
      setData({
        ...data,
        nome: data.nome || tpl.nome,
        gatilhoTipo: tpl.gatilho,
        gatilho: GATILHOS.find((g) => g.value === tpl.gatilho)?.label ?? gatilhoLabel(tpl.gatilho),
        acoes: tpl.acoes.map((a) => ({ ...a })),
      });
      setIaLoading(false);
      toast.success("Fluxo sugerido pela IA");
      setStep("acoes");
    }, 900);
  };

  const aplicarTemplate = (t: (typeof TEMPLATES_IA)[number]) => {
    setData({
      ...data,
      nome: data.nome || t.nome,
      gatilhoTipo: t.gatilho,
      gatilho: GATILHOS.find((g) => g.value === t.gatilho)?.label ?? gatilhoLabel(t.gatilho),
      acoes: t.acoes.map((a) => ({ ...a })),
    });
    toast.success(`Template aplicado: ${t.nome}`);
    setStep("acoes");
  };

  const salvar = () => {
    if (!data.nome.trim() || !data.gatilhoTipo || data.acoes.length === 0) {
      toast.error("Preencha nome, gatilho e ao menos uma ação");
      return;
    }
    onSalvar?.({ ...data, id: data.id ?? crypto.randomUUID() });
    toast.success(fluxo ? "Fluxo atualizado" : "Fluxo criado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{fluxo ? "Editar fluxo" : "Novo fluxo"}</DialogTitle>
        <div className="grid grid-cols-[280px_1fr] min-h-[640px]">
          <div
            className="relative p-6 text-white flex flex-col"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.95)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80">{fluxo ? "EDITAR" : "NOVO"}</span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">
              {fluxo ? "Editar fluxo" : "Criar fluxo automatizado"}
            </h2>
            <p className="mt-1 text-xs text-white/70">Quando isso acontecer, faça aquilo.</p>

            <div className="mt-6 space-y-1">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const active = s.key === step;
                const idxAtual = steps.findIndex((x) => x.key === step);
                const done = i < idxAtual;
                return (
                  <button
                    key={s.key}
                    onClick={() => setStep(s.key)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-3 transition ${
                      active ? "bg-white/15 backdrop-blur" : "hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        active ? "bg-white text-slate-900" : done ? "bg-emerald-500/80 text-white" : "bg-white/10"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-[11px] text-white/60 truncate">{s.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-6 text-[11px] text-white/60">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Assistente IA disponível
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-background">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <div className="text-xs text-muted-foreground">Etapa</div>
                <div className="text-base font-semibold">{steps.find((s) => s.key === step)?.label}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ativo</span>
                <Switch checked={data.ativo} onCheckedChange={(v) => setData({ ...data, ativo: v })} />
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[500px]">
              <div className="px-6 py-5">
                {step === "info" && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Criar com IA</h3>
                        <Badge variant="secondary" className="text-[10px]">Beta</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Descreva em linguagem natural o que deseja automatizar e a IA monta o fluxo.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={iaPrompt}
                          onChange={(e) => setIaPrompt(e.target.value)}
                          placeholder='Ex: "avisar cliente 3 dias antes do boleto vencer e gerar 2ª via no vencimento"'
                          className="flex-1"
                        />
                        <Button size="sm" onClick={gerarComIA} disabled={iaLoading} className="gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          {iaLoading ? "Gerando..." : "Gerar"}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Nome do fluxo *</Label>
                      <Input
                        value={data.nome}
                        onChange={(e) => setData({ ...data, nome: e.target.value })}
                        placeholder="Ex.: Boas-vindas ao pagar"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Descrição interna</Label>
                      <Textarea
                        value={data.descricao}
                        onChange={(e) => setData({ ...data, descricao: e.target.value })}
                        rows={3}
                        placeholder="Contexto, objetivo de negócio, observações..."
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Templates prontos
                        </h4>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {TEMPLATES_IA.map((t) => (
                          <button
                            key={t.nome}
                            onClick={() => aplicarTemplate(t)}
                            className="text-left rounded-lg border p-3 hover:border-primary hover:bg-primary/5 transition"
                          >
                            <div className="text-xs font-semibold">{t.nome}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {t.acoes.length} ações
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === "gatilho" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Quando este fluxo deve disparar? *</Label>
                      <Select
                        value={data.gatilhoTipo}
                        onValueChange={(v) =>
                          setData({
                            ...data,
                            gatilhoTipo: v,
                            gatilho: gatilhoLabel(v),
                          })
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione o gatilho" /></SelectTrigger>
                        <SelectContent className="max-h-[min(420px,70vh)]">
                          {GATILHOS_GRUPOS.map((grupo) => (
                            <SelectGroup key={grupo}>
                              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {grupo}
                              </SelectLabel>
                              {GATILHOS.filter((g) => g.grupo === grupo).map((g) => (
                                <SelectItem key={g.value} value={g.value}>
                                  {g.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Condições adicionais (opcional)</Label>
                      <Textarea
                        value={data.condicoes}
                        onChange={(e) => setData({ ...data, condicoes: e.target.value })}
                        rows={3}
                        placeholder='Ex.: "Apenas para clientes do plano Pro" ou "Quando valor > R$ 500"'
                      />
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <h4 className="text-xs font-semibold">Como funciona</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        O fluxo é avaliado em tempo real assim que o gatilho ocorre. Se as condições forem
                        atendidas, todas as ações são executadas na ordem definida.
                      </p>
                    </div>
                  </div>
                )}

                {step === "acoes" && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Adicionar ação
                      </h4>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {ACAO_CATALOG.map((a) => {
                          const Icon = a.icon;
                          return (
                            <button
                              key={a.tipo}
                              onClick={() => adicionarAcao(a.tipo)}
                              className="text-left rounded-lg border p-3 hover:border-primary hover:bg-primary/5 transition group"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className="h-4 w-4 text-primary" />
                                <span className="text-xs font-semibold">{a.label}</span>
                                <Plus className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 text-primary" />
                              </div>
                              <div className="text-[10px] text-muted-foreground">{a.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Sequência de execução
                      </h4>
                      {data.acoes.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-center">
                          <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">
                            Nenhuma ação adicionada. Clique nos cartões acima para montar o fluxo.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {data.acoes.map((acao, i) => {
                            const cat = ACAO_CATALOG.find((c) => c.tipo === acao.tipo)!;
                            const Icon = cat.icon;
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-3 rounded-lg border bg-card p-3"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    onClick={() => moverAcao(i, -1)}
                                    disabled={i === 0}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  >
                                    <GripVertical className="h-3 w-3 rotate-90" />
                                  </button>
                                </div>
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-muted-foreground">
                                      #{i + 1}
                                    </span>
                                    <span className="text-sm font-medium">{acao.label}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <Select
                                      value={acao.delay ?? "imediato"}
                                      onValueChange={(v) => {
                                        const novo = [...data.acoes];
                                        novo[i] = { ...novo[i], delay: v };
                                        setData({ ...data, acoes: novo });
                                      }}
                                    >
                                      <SelectTrigger className="h-6 w-auto text-[11px] border-0 bg-transparent px-1 hover:bg-muted">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="imediato">Imediato</SelectItem>
                                        <SelectItem value="5 min depois">5 min depois</SelectItem>
                                        <SelectItem value="1 hora depois">1 hora depois</SelectItem>
                                        <SelectItem value="1 dia depois">1 dia depois</SelectItem>
                                        <SelectItem value="3 dias antes">3 dias antes</SelectItem>
                                        <SelectItem value="1 dia antes">1 dia antes</SelectItem>
                                        <SelectItem value="no vencimento">No vencimento</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removerAcao(i)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === "revisar" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Nome" value={data.nome || "—"} />
                      <InfoCard label="Status" value={data.ativo ? "Ativo" : "Inativo"} />
                      <InfoCard label="Gatilho" value={data.gatilho || "—"} />
                      <InfoCard label="Total de ações" value={String(data.acoes.length)} />
                    </div>

                    {data.descricao && (
                      <div className="rounded-lg border bg-card p-4">
                        <div className="text-[11px] text-muted-foreground">Descrição</div>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap">{data.descricao}</p>
                      </div>
                    )}

                    {data.condicoes && (
                      <div className="rounded-lg border bg-card p-4">
                        <div className="text-[11px] text-muted-foreground">Condições</div>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap">{data.condicoes}</p>
                      </div>
                    )}

                    <div className="rounded-lg border bg-card p-4">
                      <div className="text-[11px] text-muted-foreground mb-2">Fluxo de execução</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                          <Zap className="h-3 w-3" /> {data.gatilho || "Gatilho"}
                        </span>
                        {data.acoes.map((a, i) => {
                          const cat = ACAO_CATALOG.find((c) => c.tipo === a.tipo)!;
                          const Icon = cat.icon;
                          return (
                            <div key={i} className="flex items-center gap-1.5">
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                                <Icon className="h-3 w-3" /> {a.label}
                                {a.delay && a.delay !== "imediato" && (
                                  <span className="text-[10px] text-muted-foreground">({a.delay})</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t px-6 py-3 flex items-center justify-between bg-card/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const idx = steps.findIndex((s) => s.key === step);
                  if (idx > 0) setStep(steps[idx - 1].key);
                  else onOpenChange(false);
                }}
              >
                {step === "info" ? "Cancelar" : "Voltar"}
              </Button>
              {step !== "revisar" ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!canNext[step]}
                  onClick={() => {
                    const idx = steps.findIndex((s) => s.key === step);
                    setStep(steps[idx + 1].key);
                  }}
                >
                  Continuar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5" onClick={salvar}>
                  <Send className="h-3.5 w-3.5" /> {fluxo ? "Salvar alterações" : "Criar fluxo"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
