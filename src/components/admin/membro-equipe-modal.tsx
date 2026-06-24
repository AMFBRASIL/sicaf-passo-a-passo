import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useState } from "react";
import {
  User,
  Shield,
  Activity,
  CheckCircle2,
  ChevronRight,
  Save,
  Crown,
  FileText,
  Users,
  Star,
  Loader2,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";
import type { PerfilEquipeOpcao } from "@/lib/admin-equipe-api";

export interface MembroEdit {
  id?: number;
  nome: string;
  cargo: string;
  perfil: string;
  perfilId?: number;
  perfilTipo?: string;
  email?: string;
  telefone?: string;
  senha?: string;
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
  isNew?: boolean;
  saving?: boolean;
  perfisOpcoes?: PerfilEquipeOpcao[];
  onSave?: (m: MembroEdit) => void | Promise<void>;
}

type StepKey = "identidade" | "perfil" | "desempenho" | "revisar";

const perfilIcon: Record<string, typeof Crown> = {
  admin: Crown,
  gestor: Shield,
  colaborador: Users,
  analista: FileText,
  visualizador: Users,
};

const perfilCor: Record<string, string> = {
  admin: "from-amber-500 to-orange-600",
  gestor: "from-blue-500 to-indigo-600",
  colaborador: "from-emerald-500 to-teal-600",
  analista: "from-violet-500 to-purple-600",
  visualizador: "from-slate-500 to-slate-700",
};

function initials(nome: string) {
  const parts = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "NC";
  return parts
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MembroEquipeModal({
  open,
  onOpenChange,
  membro,
  isNew = false,
  saving = false,
  perfisOpcoes = [],
  onSave,
}: Props) {
  const [step, setStep] = useState<StepKey>("identidade");
  const [data, setData] = useState<MembroEdit | null>(membro);

  const steps = useMemo(() => {
    const base: { key: StepKey; label: string; desc: string; icon: typeof User }[] = [
      { key: "identidade", label: "Identidade", desc: "Dados pessoais", icon: User },
      { key: "perfil", label: "Perfil de Acesso", desc: "perfis_acesso", icon: Shield },
    ];
    if (!isNew) {
      base.push({ key: "desempenho", label: "Desempenho", desc: "Métricas e SLA", icon: Activity });
    }
    base.push({ key: "revisar", label: "Revisar", desc: "Confirmar e salvar", icon: CheckCircle2 });
    return base;
  }, [isNew]);

  useEffect(() => {
    setData(membro);
    setStep("identidade");
  }, [membro, open]);

  if (!data) return null;

  const salvar = () => {
    void onSave?.(data);
  };

  const idxAtual = steps.findIndex((s) => s.key === step);
  const progress = ((idxAtual + 1) / steps.length) * 100;

  const validarEtapa = (key: StepKey): boolean => {
    if (key === "identidade") {
      if (!data.nome?.trim()) {
        toast.error("Informe o nome completo");
        return false;
      }
      const email = data.email?.trim();
      if (!email || !email.includes("@")) {
        toast.error("Informe um e-mail válido");
        return false;
      }
    }
    if (key === "perfil") {
      if (!data.perfilId && !perfisOpcoes.some((p) => p.nome === data.perfil)) {
        toast.error("Selecione um perfil de acesso");
        return false;
      }
    }
    return true;
  };

  const avancar = () => {
    if (!validarEtapa(step)) return;
    if (idxAtual < steps.length - 1) {
      setStep(steps[idxAtual + 1].key);
    }
  };

  const tituloModal = isNew ? "Novo colaborador" : `Editar ${data.nome}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{tituloModal}</DialogTitle>
        <div className="grid grid-cols-[280px_1fr] min-h-[620px]">
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
                  {initials(data.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">{data.nome || "Novo colaborador"}</h2>
                <p className="text-xs text-white/70 truncate">{data.cargo || "Defina o cargo"}</p>
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
                    type="button"
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

            {!isNew && (
              <div className="mt-auto pt-6 text-[11px] text-white/60">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> Avaliação {data.avaliacao}
                </div>
                <div className="mt-1">SLA atual: {data.sla}%</div>
              </div>
            )}
          </div>

          <div className="flex flex-col bg-background">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <div className="text-xs text-muted-foreground">
                  Etapa {idxAtual + 1} de {steps.length}
                </div>
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
                      <Field
                        label="Nome completo *"
                        value={data.nome}
                        onChange={(v) => setData({ ...data, nome: v })}
                      />
                      <Field
                        label="Cargo / Departamento"
                        value={data.cargo}
                        onChange={(v) => setData({ ...data, cargo: v })}
                      />
                      <Field
                        label="E-mail corporativo *"
                        type="email"
                        value={data.email ?? ""}
                        onChange={(v) => setData({ ...data, email: v })}
                      />
                      <Field
                        label="Telefone"
                        value={data.telefone ?? ""}
                        onChange={(v) => setData({ ...data, telefone: v })}
                      />
                    </div>
                    <Field
                      label={isNew ? "Senha inicial (opcional)" : "Nova senha (opcional)"}
                      type="password"
                      placeholder={isNew ? "Deixe vazio para gerar automaticamente" : "Deixe vazio para manter a atual"}
                      value={data.senha ?? ""}
                      onChange={(v) => setData({ ...data, senha: v })}
                    />
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
                      Mesma lista de <strong>Gestão de Perfis</strong> (<code className="text-[10px]">perfis_acesso</code>
                      , exceto Cliente). Cada card mostra o ID do banco para conferência.
                    </p>
                    {perfisOpcoes.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        Nenhum perfil carregado. Verifique a conexão com o banco ou cadastre perfis em{" "}
                        <strong>Gestão de Perfis</strong>.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {perfisOpcoes.map((p) => {
                          const Icon = perfilIcon[p.tipo] || Shield;
                          const cor = p.cor || perfilCor[p.tipo] || "from-slate-500 to-slate-700";
                          const active = p.id === data.perfilId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() =>
                                setData({
                                  ...data,
                                  perfil: p.nome,
                                  perfilId: p.id,
                                  perfilTipo: p.tipo,
                                })
                              }
                              className={`text-left rounded-xl border p-3 transition hover:shadow-md ${
                                active ? "border-primary ring-2 ring-primary/20 shadow-md" : ""
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${cor} text-white`}
                                >
                                  <Icon className="h-4.5 w-4.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold flex items-center gap-1.5">
                                    {p.nome}
                                    {active && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    ID #{p.id} · tipo: {p.tipo}
                                  </div>
                                  {p.descricao ? (
                                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                      {p.descricao}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {step === "desempenho" && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Métricas dos últimos 30 dias (tickets atribuídos no banco).
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Metric label="Tickets resolvidos" value={data.tickets.toString()} />
                      <Metric label="Tempo médio resposta" value={data.media} />
                      <Metric
                        label="SLA"
                        value={data.tickets > 0 ? `${data.sla}%` : "—"}
                        tone={data.sla >= 95 ? "good" : data.sla >= 85 ? "warn" : "bad"}
                      />
                      <Metric label="Clientes atendidos" value={data.clientes.toString()} />
                    </div>
                  </div>
                )}

                {step === "revisar" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Nome" value={data.nome} />
                      <InfoCard label="E-mail" value={data.email || "—"} />
                      <InfoCard label="Cargo" value={data.cargo || "—"} />
                      <InfoCard label="Perfil" value={data.perfil} />
                      <InfoCard label="Status" value={data.ativo === false ? "Inativo" : "Ativo"} />
                      {isNew && data.senha ? <InfoCard label="Senha" value="Definida manualmente" /> : null}
                    </div>
                    <div className="rounded-lg border bg-primary/5 border-primary/20 p-4 text-sm">
                      <div className="font-medium mb-1">Pronto para salvar</div>
                      <div className="text-xs text-muted-foreground">
                        {isNew
                          ? "O colaborador será criado em usuarios com o perfil selecionado."
                          : "As alterações entrarão em vigor imediatamente."}
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
                type="button"
                onClick={() => {
                  if (idxAtual > 0) setStep(steps[idxAtual - 1].key);
                  else onOpenChange(false);
                }}
              >
                {idxAtual === 0 ? "Cancelar" : "Voltar"}
              </Button>
              {step !== "revisar" ? (
                <Button size="sm" type="button" className="gap-1.5" onClick={avancar}>
                  Continuar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" type="button" className="gap-1.5" onClick={salvar} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {saving ? "Salvando..." : isNew ? "Criar colaborador" : "Salvar alterações"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
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
