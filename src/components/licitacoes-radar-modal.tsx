import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Radar,
  Plus,
  Play,
  Trash2,
  Pencil,
  Loader2,
  Target,
  Heart,
  Sparkles,
  MapPin,
  DollarSign,
  ChevronRight,
  CheckCircle2,
  ListFilter,
  Zap,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createRadarRule,
  deleteRadarRule,
  fetchRadarRules,
  runRadar,
  updateRadarRule,
  type LicitacoesFilterOptions,
  type RadarMatch,
  type RadarRule,
  type RadarRuleInput,
} from "@/lib/licitacoes-api";

type WizardStep = "regras" | "criar" | "executar";

const STEPS: { key: WizardStep; label: string; desc: string; icon: typeof Radar }[] = [
  { key: "regras", label: "Minhas regras", desc: "Critérios salvos", icon: ListFilter },
  { key: "criar", label: "Nova regra", desc: "Personalizar busca", icon: Plus },
  { key: "executar", label: "Executar", desc: "Varredura PNCP", icon: Zap },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterOptions?: LicitacoesFilterOptions | null;
  onMatches?: () => void;
};

const formDefault = (): RadarRuleInput => ({
  nome: "",
  palavras_chave: [],
  ufs: [],
  modalidades: [],
  valor_min: null,
  valor_max: null,
  esfera: null,
  srp_filter: "all",
  auto_mira: false,
  ativo: true,
});

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatBRL(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatDateBR(iso: string | null) {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function LicitacoesRadarModal({ open, onOpenChange, filterOptions, onMatches }: Props) {
  const [step, setStep] = useState<WizardStep>("regras");
  const [rules, setRules] = useState<RadarRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RadarRuleInput>(formDefault());
  const [keywordsText, setKeywordsText] = useState("");
  const [ufsText, setUfsText] = useState("");
  const [modalidadesText, setModalidadesText] = useState("");
  const [matches, setMatches] = useState<RadarMatch[]>([]);
  const [addedToMira, setAddedToMira] = useState(0);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progresso = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const regrasAtivas = useMemo(() => rules.filter((r) => r.ativo).length, [rules]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRadarRules();
      if (!res.ok) throw new Error(res.error || "Erro ao carregar regras");
      setRules(res.rules || []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetForm = useCallback(() => {
    setForm(formDefault());
    setKeywordsText("");
    setUfsText("");
    setModalidadesText("");
    setEditingId(null);
  }, []);

  useEffect(() => {
    if (!open) {
      setStep("regras");
      resetForm();
      setMatches([]);
      setAddedToMira(0);
      return;
    }
    void carregar();
  }, [open, carregar, resetForm]);

  const abrirEdicao = (rule: RadarRule) => {
    setEditingId(rule.id);
    setForm({
      nome: rule.nome,
      ativo: rule.ativo,
      palavras_chave: rule.palavras_chave,
      ufs: rule.ufs,
      modalidades: rule.modalidades,
      valor_min: rule.valor_min,
      valor_max: rule.valor_max,
      esfera: rule.esfera,
      srp_filter: rule.srp_filter,
      auto_mira: rule.auto_mira,
    });
    setKeywordsText(rule.palavras_chave.join(", "));
    setUfsText(rule.ufs.join(", "));
    setModalidadesText(rule.modalidades.join(", "));
    setStep("criar");
  };

  const salvarRegra = async () => {
    if (!form.nome?.trim()) {
      toast.error("Informe um nome para a regra");
      return;
    }
    const payload: RadarRuleInput = {
      ...form,
      nome: form.nome.trim(),
      palavras_chave: splitCsv(keywordsText),
      ufs: splitCsv(ufsText).map((u) => u.toUpperCase()),
      modalidades: splitCsv(modalidadesText),
    };

    setSaving(true);
    try {
      const res = editingId
        ? await updateRadarRule(editingId, payload)
        : await createRadarRule(payload);
      if (!res.ok) throw new Error(res.error || "Erro ao salvar regra");
      toast.success(editingId ? "Regra atualizada" : "Regra criada");
      resetForm();
      setStep("regras");
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const excluirRegra = async (id: number) => {
    try {
      const res = await deleteRadarRule(id);
      if (!res.ok) throw new Error(res.error || "Erro ao excluir");
      toast.success("Regra removida");
      if (editingId === id) resetForm();
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const executarRadar = async () => {
    if (!regrasAtivas) {
      toast.error("Crie pelo menos uma regra ativa antes de executar");
      setStep("criar");
      return;
    }
    setRunning(true);
    setMatches([]);
    setAddedToMira(0);
    try {
      const res = await runRadar();
      if (!res.ok) throw new Error(res.error || "Erro ao executar radar");
      setMatches(res.matches || []);
      setAddedToMira(res.addedToMira || 0);
      toast.success(
        `${res.matches?.length || 0} oportunidade(s) encontrada(s)${res.addedToMira ? ` · ${res.addedToMira} na mira` : ""}`,
      );
      onMatches?.();
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden sm:max-w-5xl sm:rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Radar de oportunidades</DialogTitle>
        <DialogDescription className="sr-only">
          Configure regras e encontre licitações compatíveis com seu perfil.
        </DialogDescription>

        <div className="grid min-h-[min(620px,88dvh)] md:grid-cols-[300px_minmax(0,1fr)]">
          <aside
            className="relative hidden flex-col overflow-hidden text-white md:flex"
            style={{
              backgroundImage: `linear-gradient(165deg, rgba(30,20,70,0.95) 0%, rgba(45,30,100,0.9) 45%, rgba(55,35,120,0.85) 100%), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="relative z-10 flex flex-1 flex-col p-6">
              <div className="mb-6">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/25">
                  <Radar className="h-7 w-7" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                  CADBRASIL · Licitações
                </p>
                <h2 className="mt-1 text-xl font-bold leading-tight">Radar de oportunidades</h2>
                <p className="mt-2 text-xs leading-relaxed text-white/75">
                  Defina critérios personalizados e varra as licitações mais recentes do PNCP. Matches
                  podem ir direto para sua mira.
                </p>
              </div>

              <div className="mb-4 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-white/60">
                  <span>Progresso</span>
                  <span>{progresso}%</span>
                </div>
                <Progress value={progresso} className="h-1.5 bg-white/15 [&>div]:bg-violet-400" />
              </div>

              <nav className="space-y-2">
                {STEPS.map((s, i) => {
                  const done = i < stepIndex;
                  const active = s.key === step;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        if (s.key === "criar") resetForm();
                        setStep(s.key);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        active && "bg-white/15",
                        !active && !done && "opacity-60 hover:opacity-90",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          done && "bg-violet-400 text-slate-900",
                          active && !done && "bg-white/25 ring-2 ring-white/40",
                          !done && !active && "bg-white/10",
                        )}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <Icon className="h-3.5 w-3.5 opacity-80" />
                          {s.label}
                        </span>
                        <span className="block text-[11px] text-white/65">{s.desc}</span>
                      </span>
                      {active && <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto rounded-xl bg-white/10 p-3 text-xs text-white/80">
                <div className="flex items-center gap-2 font-medium text-white">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                  {regrasAtivas} regra(s) ativa(s)
                </div>
                <p className="mt-1 text-white/65">
                  Varre as 200 licitações mais recentes a cada execução.
                </p>
              </div>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col bg-background">
            <div className="flex items-center justify-between border-b px-5 py-4 md:px-6">
              <div>
                <h3 className="text-lg font-semibold">
                  {step === "regras" && "Minhas regras"}
                  {step === "criar" && (editingId ? "Editar regra" : "Nova regra")}
                  {step === "executar" && "Executar radar"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {step === "regras" && "Gerencie os critérios de monitoramento"}
                  {step === "criar" && "Palavras-chave, UF, modalidade, valor e mais"}
                  {step === "executar" && "Busca oportunidades nas licitações recentes"}
                </p>
              </div>
              {step === "regras" && (
                <Button size="sm" onClick={() => { resetForm(); setStep("criar"); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova regra
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 px-5 py-4 md:px-6">
              {step === "regras" && (
                <div className="space-y-3 pb-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Carregando regras...
                    </div>
                  ) : rules.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-10 text-center">
                      <Radar className="mx-auto h-10 w-10 text-muted-foreground/50" />
                      <p className="mt-3 font-medium">Nenhuma regra cadastrada</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Crie sua primeira regra para monitorar oportunidades automaticamente.
                      </p>
                      <Button className="mt-4" onClick={() => { resetForm(); setStep("criar"); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar regra
                      </Button>
                    </div>
                  ) : (
                    rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="rounded-xl border bg-card p-4 transition hover:border-primary/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{rule.nome}</span>
                              {!rule.ativo && (
                                <Badge variant="outline" className="text-xs">
                                  Inativa
                                </Badge>
                              )}
                              {rule.auto_mira && (
                                <Badge className="bg-rose-500/15 text-rose-600 hover:bg-rose-500/15">
                                  <Heart className="mr-1 h-3 w-3 fill-current" />
                                  Auto-mira
                                </Badge>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {rule.palavras_chave.slice(0, 4).map((k) => (
                                <Badge key={k} variant="secondary" className="text-xs font-normal">
                                  {k}
                                </Badge>
                              ))}
                              {rule.ufs.map((uf) => (
                                <Badge key={uf} variant="outline" className="text-xs">
                                  {uf}
                                </Badge>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Última execução: {formatDateBR(rule.ultima_execucao_at)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" onClick={() => abrirEdicao(rule)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => excluirRegra(rule.id)}>
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {step === "criar" && (
                <div className="mx-auto max-w-xl space-y-5 pb-6">
                  <div className="space-y-2">
                    <Label htmlFor="radar-nome">Nome da regra *</Label>
                    <Input
                      id="radar-nome"
                      value={form.nome}
                      onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                      placeholder="Ex: TI em São Paulo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="radar-keywords">Palavras-chave (vírgula)</Label>
                    <Input
                      id="radar-keywords"
                      value={keywordsText}
                      onChange={(e) => setKeywordsText(e.target.value)}
                      placeholder="software, cloud, licenciamento"
                    />
                    <p className="text-xs text-muted-foreground">
                      Busca no objeto, resumo e nome do órgão
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="radar-ufs">UFs (vírgula)</Label>
                      <Input
                        id="radar-ufs"
                        value={ufsText}
                        onChange={(e) => setUfsText(e.target.value)}
                        placeholder="SP, RJ, MG"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="radar-esfera">Esfera</Label>
                      <Select
                        value={form.esfera || "all"}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, esfera: v === "all" ? null : v }))
                        }
                      >
                        <SelectTrigger id="radar-esfera">
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {(filterOptions?.esferas || []).map((e) => (
                            <SelectItem key={e.value} value={e.value}>
                              {e.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="radar-modalidades">Modalidades (vírgula)</Label>
                    <Input
                      id="radar-modalidades"
                      value={modalidadesText}
                      onChange={(e) => setModalidadesText(e.target.value)}
                      placeholder="Pregão, Concorrência"
                      list="radar-modalidades-list"
                    />
                    <datalist id="radar-modalidades-list">
                      {(filterOptions?.modalidades || []).map((m) => (
                        <option key={m.value} value={m.value} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="radar-valor-min">Valor mínimo (R$)</Label>
                      <Input
                        id="radar-valor-min"
                        type="number"
                        min={0}
                        value={form.valor_min ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            valor_min: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="radar-valor-max">Valor máximo (R$)</Label>
                      <Input
                        id="radar-valor-max"
                        type="number"
                        min={0}
                        value={form.valor_max ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            valor_max: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        placeholder="Sem limite"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="radar-srp">Sistema de Registro de Preços</Label>
                    <Select
                      value={form.srp_filter || "all"}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, srp_filter: v as "all" | "sim" | "nao" }))
                      }
                    >
                      <SelectTrigger id="radar-srp">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="sim">Somente SRP</SelectItem>
                        <SelectItem value="nao">Sem SRP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Adicionar à mira automaticamente</p>
                      <p className="text-xs text-muted-foreground">
                        Matches vão para sua lista de acompanhamento
                      </p>
                    </div>
                    <Switch
                      checked={!!form.auto_mira}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, auto_mira: v }))}
                    />
                  </div>

                  {editingId && (
                    <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">Regra ativa</p>
                        <p className="text-xs text-muted-foreground">Regras inativas são ignoradas na execução</p>
                      </div>
                      <Switch
                        checked={form.ativo !== false}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        resetForm();
                        setStep("regras");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button className="flex-1" onClick={salvarRegra} disabled={saving}>
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Target className="mr-2 h-4 w-4" />
                      )}
                      {editingId ? "Salvar alterações" : "Criar regra"}
                    </Button>
                  </div>
                </div>
              )}

              {step === "executar" && (
                <div className="space-y-5 pb-6">
                  <div className="rounded-xl border bg-gradient-to-br from-violet-500/5 to-indigo-500/10 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
                        <Radar className="h-6 w-6 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-semibold">Pronto para varrer o PNCP</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {regrasAtivas} regra(s) ativa(s) serão aplicadas nas 200 licitações mais
                          recentes. Oportunidades com auto-mira serão adicionadas à sua lista.
                        </p>
                        <Button className="mt-4" onClick={executarRadar} disabled={running}>
                          {running ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="mr-2 h-4 w-4" />
                          )}
                          Executar radar agora
                        </Button>
                      </div>
                    </div>
                  </div>

                  {(matches.length > 0 || addedToMira > 0) && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {matches.length} match(es)
                        </Badge>
                        {addedToMira > 0 && (
                          <Badge className="bg-rose-500/15 text-rose-600 hover:bg-rose-500/15">
                            <Heart className="mr-1 h-3 w-3 fill-current" />
                            {addedToMira} adicionado(s) à mira
                          </Badge>
                        )}
                      </div>

                      {matches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma oportunidade encontrada nesta execução.
                        </p>
                      ) : (
                        matches.map((m) => (
                          <div key={`${m.licitacaoId}-${m.ruleId}`} className="rounded-xl border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {m.numero_processo || `ID ${m.licitacaoId}`}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {m.ruleNome}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {m.nome_orgao || "Órgão não informado"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {m.uf && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {m.uf}
                                </span>
                              )}
                              {m.modalidade && <span>{m.modalidade}</span>}
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {formatBRL(m.valor_estimado)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
