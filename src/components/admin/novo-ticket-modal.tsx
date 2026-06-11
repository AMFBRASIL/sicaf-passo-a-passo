import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallback, useEffect, useState } from "react";
import { fetchAdminClientes } from "@/lib/admin-clientes-api";
import {
  Ticket,
  User,
  FileText,
  Tag,
  CheckCircle2,
  ChevronRight,
  Send,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriar?: (ticket: NovoTicketData) => void | Promise<void>;
}

export interface NovoTicketData {
  cliente: string;
  clienteId?: number;
  responsavel: string;
  categoria: string;
  prioridade: "Alta" | "Média" | "Baixa";
  titulo: string;
  descricao: string;
}

type StepKey = "cliente" | "detalhes" | "classificacao" | "revisar";

const steps: { key: StepKey; label: string; desc: string; icon: any }[] = [
  { key: "cliente", label: "Cliente", desc: "Quem está solicitando", icon: User },
  { key: "detalhes", label: "Detalhes", desc: "Título e descrição", icon: FileText },
  { key: "classificacao", label: "Classificação", desc: "Categoria e prioridade", icon: Tag },
  { key: "revisar", label: "Revisar", desc: "Confirmar e abrir", icon: CheckCircle2 },
];

const responsaveis = ["Anderson", "Maria S.", "João P.", "Carla R."];

const categorias = [
  "Renovação SICAF",
  "Atualização Cadastral",
  "Certidões",
  "Financeiro",
  "Procuração",
  "Suporte Técnico",
  "Outro",
];

export function NovoTicketModal({ open, onOpenChange, onCriar }: Props) {
  const [step, setStep] = useState<StepKey>("cliente");
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [data, setData] = useState<NovoTicketData>({
    cliente: "",
    clienteId: undefined,
    responsavel: "",
    categoria: "",
    prioridade: "Média",
    titulo: "",
    descricao: "",
  });

  const carregarClientes = useCallback(async () => {
    setLoadingClientes(true);
    const res = await fetchAdminClientes({ limit: 200 });
    setLoadingClientes(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar clientes");
      return;
    }
    const lista = (res.clients || []).map((c) => ({
      id: c.id,
      nome: c.name || c.fantasyName || c.documento,
    }));
    setClientes(lista);
  }, []);

  useEffect(() => {
    if (open) void carregarClientes();
  }, [open, carregarClientes]);

  const canNext: Record<StepKey, boolean> = {
    cliente: !!data.cliente,
    detalhes: !!data.titulo.trim(),
    classificacao: !!data.categoria,
    revisar: true,
  };

  const criar = async () => {
    if (!data.cliente || !data.titulo.trim() || !data.categoria) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSalvando(true);
    try {
      await onCriar?.(data);
      setData({
        cliente: "",
        clienteId: undefined,
        responsavel: "",
        categoria: "",
        prioridade: "Média",
        titulo: "",
        descricao: "",
      });
      setStep("cliente");
      onOpenChange(false);
    } catch {
      // Erro tratado pelo chamador
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Novo ticket</DialogTitle>
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
                <Ticket className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80">NOVO</span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">Abrir novo ticket</h2>
            <p className="mt-1 text-xs text-white/70">Wizard de criação guiada</p>

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
                <AlertTriangle className="h-3 w-3" /> SLA inicia ao abrir
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-background">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <div className="text-xs text-muted-foreground">Etapa</div>
                <div className="text-base font-semibold">{steps.find((s) => s.key === step)?.label}</div>
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[460px]">
              <div className="px-6 py-5">
                {step === "cliente" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Cliente *</Label>
                      <Select
                        value={data.clienteId ? String(data.clienteId) : ""}
                        onValueChange={(v) => {
                          const id = parseInt(v, 10);
                          const cli = clientes.find((c) => c.id === id);
                          setData({ ...data, clienteId: id, cliente: cli?.nome || "" });
                        }}
                        disabled={loadingClientes}
                      >
                        <SelectTrigger>
                          {loadingClientes ? (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Carregando clientes...
                            </span>
                          ) : (
                            <SelectValue placeholder="Selecione o cliente" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Responsável interno</Label>
                      <Select value={data.responsavel} onValueChange={(v) => setData({ ...data, responsavel: v })}>
                        <SelectTrigger><SelectValue placeholder="Atribuir a..." /></SelectTrigger>
                        <SelectContent>
                          {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {step === "detalhes" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Título *</Label>
                      <Input
                        value={data.titulo}
                        onChange={(e) => setData({ ...data, titulo: e.target.value })}
                        placeholder="Ex.: Renovação SICAF Nível IV"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Descrição</Label>
                      <Textarea
                        value={data.descricao}
                        onChange={(e) => setData({ ...data, descricao: e.target.value })}
                        rows={7}
                        placeholder="Descreva o caso, anexos, contexto..."
                      />
                    </div>
                  </div>
                )}

                {step === "classificacao" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Categoria *</Label>
                      <Select value={data.categoria} onValueChange={(v) => setData({ ...data, categoria: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Prioridade</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["Alta", "Média", "Baixa"] as const).map((p) => (
                          <button
                            key={p}
                            onClick={() => setData({ ...data, prioridade: p })}
                            className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                              data.prioridade === p
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === "revisar" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Cliente" value={data.cliente || "—"} />
                      <InfoCard label="Responsável" value={data.responsavel || "Sem atribuição"} />
                      <InfoCard label="Categoria" value={data.categoria || "—"} />
                      <InfoCard label="Prioridade" value={data.prioridade} />
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <div className="text-[11px] text-muted-foreground">Título</div>
                      <div className="text-sm font-medium mt-0.5">{data.titulo || "—"}</div>
                      <div className="text-[11px] text-muted-foreground mt-3">Descrição</div>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap">
                        {data.descricao || <span className="italic text-muted-foreground">Sem descrição.</span>}
                      </p>
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
                {step === "cliente" ? "Cancelar" : "Voltar"}
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
                <Button size="sm" className="gap-1.5" onClick={() => void criar()} disabled={salvando}>
                  {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {salvando ? "Criando..." : "Abrir ticket"}
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
