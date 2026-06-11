import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";

export interface AlertaItem {
  id?: string;
  categoria?: string;
  referenciaId?: number;
  clienteId?: number | null;
  acaoUrl?: string | null;
  tipo: string;
  cli: string;
  det: string;
  em: string;
  tom: "rose" | "amber" | "violet";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerta: AlertaItem | null;
  onResolver?: (alerta: AlertaItem, acao: string, observacao: string, notificar: boolean) => void;
}

type StepKey = "contexto" | "acao" | "execucao" | "finalizar";

const steps: { key: StepKey; label: string; desc: string; icon: any }[] = [
  { key: "contexto", label: "Contexto", desc: "Entender o alerta", icon: FileText },
  { key: "acao", label: "Plano de ação", desc: "Escolher tratamento", icon: ListChecks },
  { key: "execucao", label: "Execução", desc: "Detalhes e responsável", icon: ShieldCheck },
  { key: "finalizar", label: "Finalizar", desc: "Revisar e confirmar", icon: CheckCircle2 },
];

const acoesSugeridas = [
  { id: "renovar", label: "Renovar / emitir documento", desc: "Disparar a renovação automática agora" },
  { id: "contatar", label: "Contatar cliente", desc: "Enviar e-mail ou WhatsApp solicitando ação" },
  { id: "fatura", label: "Renegociar fatura", desc: "Gerar nova fatura ou parcelar pendência" },
  { id: "adiar", label: "Agendar para depois", desc: "Programar tratativa para outra data" },
];

const tomBadge: Record<string, string> = {
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

export function TratarAlertaModal({ open, onOpenChange, alerta, onResolver }: Props) {
  const [step, setStep] = useState<StepKey>("contexto");
  const [acao, setAcao] = useState<string>("renovar");
  const [observacao, setObservacao] = useState("");
  const [responsavel, setResponsavel] = useState("Eu");
  const [notificar, setNotificar] = useState(true);

  if (!alerta) return null;

  const reset = () => {
    setStep("contexto");
    setAcao("renovar");
    setObservacao("");
    setResponsavel("Eu");
    setNotificar(true);
  };

  const concluir = () => {
    const acaoLabel = acoesSugeridas.find((a) => a.id === acao)?.label || acao;
    onResolver?.(alerta, acaoLabel, observacao, notificar);
    toast.success("Alerta tratado com sucesso", {
      description: `${acaoLabel} · ${alerta.cli}`,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Tratar alerta — {alerta.tipo}</DialogTitle>
        <div className="grid grid-cols-[280px_1fr] min-h-[600px]">
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
                <AlertTriangle className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80">ALERTA</span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">{alerta.tipo}</h2>
            <p className="mt-1 text-xs text-white/70">{alerta.cli}</p>

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
                        active
                          ? "bg-white text-slate-900"
                          : done
                          ? "bg-emerald-500/80 text-white"
                          : "bg-white/10"
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
                <Clock className="h-3 w-3" /> Prazo: {alerta.em}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <User className="h-3 w-3" /> Atribuído a {responsavel}
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-background">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <div className="text-xs text-muted-foreground">Etapa</div>
                <div className="text-base font-semibold">
                  {steps.find((s) => s.key === step)?.label}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${tomBadge[alerta.tom]}`}>
                  {alerta.tom === "rose" ? "Crítico" : alerta.tom === "amber" ? "Atenção" : "Risco"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {alerta.em}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[460px]">
              <div className="px-6 py-5">
                {step === "contexto" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Tipo de alerta" value={alerta.tipo} />
                      <InfoCard label="Cliente" value={alerta.cli} />
                      <InfoCard label="Detalhe" value={alerta.det} />
                      <InfoCard label="Janela" value={alerta.em} />
                    </div>
                    <Separator />
                    <div className="rounded-lg border bg-card p-4">
                      <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" /> Sugestão do assistente
                      </div>
                      <p className="text-sm leading-relaxed">
                        Recomendo iniciar pela ação <strong>{acoesSugeridas[0].label.toLowerCase()}</strong> e,
                        em paralelo, notificar o cliente para evitar reincidência. Caso a pendência seja
                        financeira, prefira gerar nova fatura antes de qualquer aviso.
                      </p>
                    </div>
                  </div>
                )}

                {step === "acao" && (
                  <div className="space-y-2">
                    {acoesSugeridas.map((a) => {
                      const ativo = acao === a.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => setAcao(a.id)}
                          className={`w-full text-left rounded-lg border p-3 transition ${
                            ativo
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-accent/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{a.label}</span>
                            {ativo && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {step === "execucao" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                      <Input
                        value={responsavel}
                        onChange={(e) => setResponsavel(e.target.value)}
                        placeholder="Quem vai executar?"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Observações / próximos passos
                      </label>
                      <Textarea
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        placeholder="Ex: solicitar documento atualizado por e-mail, conferir validade no portal..."
                        rows={6}
                        className="mt-1"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificar}
                        onChange={(e) => setNotificar(e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      Notificar o cliente por e-mail após a tratativa
                    </label>
                  </div>
                )}

                {step === "finalizar" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-card p-4 space-y-2">
                      <Linha label="Alerta" value={alerta.tipo} />
                      <Linha label="Cliente" value={alerta.cli} />
                      <Linha
                        label="Ação"
                        value={acoesSugeridas.find((a) => a.id === acao)?.label || "—"}
                      />
                      <Linha label="Responsável" value={responsavel} />
                      <Linha
                        label="Notificar cliente"
                        value={notificar ? "Sim, por e-mail" : "Não"}
                      />
                    </div>
                    {observacao && (
                      <div className="rounded-lg border bg-card p-4">
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Observações
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{observacao}</p>
                      </div>
                    )}
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
                {step === "contexto" ? "Cancelar" : "Voltar"}
              </Button>
              {step !== "finalizar" ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const idx = steps.findIndex((s) => s.key === step);
                    setStep(steps[idx + 1].key);
                  }}
                >
                  Continuar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5" onClick={concluir}>
                  <Send className="h-3.5 w-3.5" /> Confirmar tratativa
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
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function Linha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
