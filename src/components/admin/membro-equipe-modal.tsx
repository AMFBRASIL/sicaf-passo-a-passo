import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import {
  User,
  Shield,
  Activity,
  CheckCircle2,
  ChevronRight,
  Save,
  Crown,
  Headphones,
  DollarSign,
  FileText,
  Users,
  Star,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";

export interface MembroEdit {
  nome: string;
  cargo: string;
  perfil: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
  tickets: number;
  media: string;
  sla: number;
  clientes: number;
  avaliacao: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membro: MembroEdit | null;
  onSave?: (m: MembroEdit) => void;
}

type StepKey = "identidade" | "perfil" | "desempenho" | "revisar";

const steps: { key: StepKey; label: string; desc: string; icon: any }[] = [
  { key: "identidade", label: "Identidade", desc: "Dados pessoais", icon: User },
  { key: "perfil", label: "Perfil de Acesso", desc: "Permissões e papel", icon: Shield },
  { key: "desempenho", label: "Desempenho", desc: "Métricas e SLA", icon: Activity },
  { key: "revisar", label: "Revisar", desc: "Confirmar e salvar", icon: CheckCircle2 },
];

const perfis = [
  { id: "Administrador", desc: "Acesso total", icon: Crown, cor: "from-amber-500 to-orange-600" },
  { id: "Operador SICAF", desc: "Renovação e níveis", icon: Shield, cor: "from-emerald-500 to-teal-600" },
  { id: "Financeiro", desc: "Cobranças e conciliação", icon: DollarSign, cor: "from-blue-500 to-indigo-600" },
  { id: "Suporte N1", desc: "Tickets e atendimento", icon: Headphones, cor: "from-violet-500 to-purple-600" },
  { id: "Documentação", desc: "Uploads e arquivos", icon: FileText, cor: "from-rose-500 to-pink-600" },
  { id: "Customer Success", desc: "Relacionamento", icon: Users, cor: "from-cyan-500 to-sky-600" },
];

export function MembroEquipeModal({ open, onOpenChange, membro, onSave }: Props) {
  const [step, setStep] = useState<StepKey>("identidade");
  const [data, setData] = useState<MembroEdit | null>(membro);

  useEffect(() => {
    setData(membro);
    setStep("identidade");
  }, [membro, open]);

  if (!data) return null;

  const salvar = () => {
    onSave?.(data);
    toast.success(`${data.nome} atualizado com sucesso`);
    onOpenChange(false);
  };

  const idxAtual = steps.findIndex((s) => s.key === step);
  const progress = ((idxAtual + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Editar {data.nome}</DialogTitle>
        <div className="grid grid-cols-[280px_1fr] min-h-[620px]">
          {/* Sidebar wizard */}
          <div
            className="relative p-6 text-white flex flex-col"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.95)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-12 w-12 border-2 border-white/30">
                <AvatarFallback className="bg-white/15 text-white font-semibold backdrop-blur">
                  {data.nome.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">{data.nome}</h2>
                <p className="text-xs text-white/70 truncate">{data.cargo}</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between text-[11px] text-white/70 mb-1.5">
                <span>Progresso</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const active = s.key === step;
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
                <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> Avaliação {data.avaliacao}
              </div>
              <div className="mt-1">SLA atual: {data.sla}%</div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex flex-col bg-background">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <div className="text-xs text-muted-foreground">Etapa {idxAtual + 1} de {steps.length}</div>
                <div className="text-base font-semibold">{steps[idxAtual].label}</div>
              </div>
              <Badge variant={data.ativo === false ? "secondary" : "default"} className="text-[10px]">
                {data.ativo === false ? "Inativo" : "Ativo"}
              </Badge>
            </div>

            <ScrollArea className="flex-1 max-h-[480px]">
              <div className="px-6 py-5">
                {step === "identidade" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nome completo" value={data.nome} onChange={(v) => setData({ ...data, nome: v })} />
                      <Field label="Cargo" value={data.cargo} onChange={(v) => setData({ ...data, cargo: v })} />
                      <Field
                        label="E-mail corporativo"
                        value={data.email ?? `${data.nome.split(" ")[0].toLowerCase()}@cadbrasil.com`}
                        onChange={(v) => setData({ ...data, email: v })}
                      />
                      <Field
                        label="Telefone"
                        value={data.telefone ?? "(61) 9 9999-0000"}
                        onChange={(v) => setData({ ...data, telefone: v })}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="text-sm font-medium">Conta ativa</div>
                        <div className="text-xs text-muted-foreground">
                          Permite login e atendimento de tickets
                        </div>
                      </div>
                      <Switch
                        checked={data.ativo !== false}
                        onCheckedChange={(v) => setData({ ...data, ativo: v })}
                      />
                    </div>
                  </div>
                )}

                {step === "perfil" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Selecione o perfil que define o que este colaborador pode fazer.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {perfis.map((p) => {
                        const Icon = p.icon;
                        const active = p.id === data.perfil;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setData({ ...data, perfil: p.id })}
                            className={`text-left rounded-xl border p-3 transition hover:shadow-md ${
                              active ? "border-primary ring-2 ring-primary/20 shadow-md" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${p.cor} text-white`}
                              >
                                <Icon className="h-4.5 w-4.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold flex items-center gap-1.5">
                                  {p.id}
                                  {active && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === "desempenho" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Metric label="Tickets resolvidos" value={data.tickets.toString()} />
                      <Metric label="Tempo médio resposta" value={data.media} />
                      <Metric
                        label="SLA"
                        value={`${data.sla}%`}
                        tone={data.sla >= 95 ? "good" : data.sla >= 85 ? "warn" : "bad"}
                      />
                      <Metric label="Clientes atendidos" value={data.clientes.toString()} />
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Avaliação dos clientes</div>
                      <div className="flex items-center gap-2">
                        <div className="text-3xl font-bold">{data.avaliacao}</div>
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < Math.round(data.avaliacao)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === "revisar" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Nome" value={data.nome} />
                      <InfoCard label="Cargo" value={data.cargo} />
                      <InfoCard label="Perfil" value={data.perfil} />
                      <InfoCard label="Status" value={data.ativo === false ? "Inativo" : "Ativo"} />
                    </div>
                    <div className="rounded-lg border bg-primary/5 border-primary/20 p-4 text-sm">
                      <div className="font-medium mb-1">Pronto para salvar</div>
                      <div className="text-xs text-muted-foreground">
                        As alterações entrarão em vigor imediatamente.
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
                  if (idxAtual > 0) setStep(steps[idxAtual - 1].key);
                  else onOpenChange(false);
                }}
              >
                {idxAtual === 0 ? "Cancelar" : "Voltar"}
              </Button>
              {step !== "revisar" ? (
                <Button size="sm" className="gap-1.5" onClick={() => setStep(steps[idxAtual + 1].key)}>
                  Continuar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5" onClick={salvar}>
                  <Save className="h-3.5 w-3.5" /> Salvar alterações
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const toneCls =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : tone === "bad"
      ? "text-rose-600"
      : "";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${toneCls}`}>{value}</div>
    </div>
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
