import { useMemo, useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users2,
  Search,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ClipboardList,
  UserCog,
  Flag,
  MessageSquare,
  DollarSign,
  Phone,
  Mail,
  MessageCircle,
  PhoneCall,
  ClipboardCheck,
  Rocket,
  Building2,
  CalendarClock,
  FileText,
  Receipt,
  ShieldAlert,
  BadgeCheck,
  Handshake,
  Ban,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { mascararInputReal } from "@/lib/money";
import { CrmAnexosUploader, type CrmAnexo } from "./crm-anexos";
import { Paperclip } from "lucide-react";

export type CrmStage =
  | "em_negociacao"
  | "boleto"
  | "liberado"
  | "em_uso"
  | "cancelado";

export interface CrmCliente {
  id: string;
  razao: string;
  cnpj: string;
  cidade: string;
  segmento: string;
  ticket: string;
}

const CLIENTES_MOCK: CrmCliente[] = [];

export type CrmConsultor = { id: string; nome: string; papel: string };

const STAGES: {
  id: CrmStage;
  titulo: string;
  descricao: string;
  cor: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "em_negociacao", titulo: "Em negociação", descricao: "Consultor validando documentação e viabilidade.", cor: "from-sky-500 to-blue-600", icon: Handshake },
  { id: "boleto", titulo: "Boleto gerado", descricao: "Cobrança emitida, aguardando pagamento.", cor: "from-amber-500 to-orange-600", icon: Receipt },
  { id: "liberado", titulo: "Financeiro liberado", descricao: "Pagamento confirmado, execução liberada.", cor: "from-emerald-500 to-teal-600", icon: BadgeCheck },
  { id: "em_uso", titulo: "Em Uso", descricao: "Cliente ativo utilizando o serviço.", cor: "from-violet-500 to-purple-600", icon: ClipboardCheck },
  { id: "cancelado", titulo: "Cancelado", descricao: "Cliente desistiu ou operação encerrada.", cor: "from-rose-500 to-pink-600", icon: Ban },
];

const CONSULTORES: CrmConsultor[] = [];

const PRIORIDADES = [
  { id: "alta", label: "Alta", cor: "bg-rose-500", desc: "Follow-up diário" },
  { id: "media", label: "Média", cor: "bg-amber-500", desc: "Follow-up 3 dias" },
  { id: "baixa", label: "Baixa", cor: "bg-emerald-500", desc: "Follow-up semanal" },
] as const;

const CANAIS = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "ligacao", label: "Ligação", icon: PhoneCall },
  { id: "email", label: "E-mail", icon: Mail },
  { id: "presencial", label: "Presencial", icon: Users2 },
];

const STEPS = [
  { id: 0, titulo: "Cliente", subtitulo: "Selecione o CNPJ atendido", icon: Building2 },
  { id: 1, titulo: "Etapa", subtitulo: "Status atual no funil", icon: Flag },
  { id: 2, titulo: "Consultor", subtitulo: "Responsável, prioridade e canal", icon: UserCog },
  { id: 3, titulo: "Detalhes", subtitulo: "Valor, boleto e próxima ação", icon: ClipboardList },
  { id: 4, titulo: "Revisão", subtitulo: "Confirme e envie ao Kanban", icon: Rocket },
];

function resolveDefaultConsultorId(consultores: CrmConsultor[], userId?: number | null): string {
  if (userId != null) {
    const loggedIn = consultores.find((c) => c.id === String(userId));
    if (loggedIn) return loggedIn.id;
  }
  return consultores[0]?.id ?? "";
}

export interface NovoCrmCard {
  cliente: CrmCliente;
  stage: CrmStage;
  consultorId: string;
  prioridade: (typeof PRIORIDADES)[number]["id"];
  canal: string;
  valor: string;
  boleto: string;
  proximaAcao: string;
  dataAcao: string;
  notas: string;
  tags: string[];
  anexos: CrmAnexo[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate?: (card: NovoCrmCard) => void | Promise<void>;
  stageInicial?: CrmStage;
  clientes?: CrmCliente[];
  consultores?: CrmConsultor[];
  onBuscaCliente?: (termo: string) => void;
  buscandoClientes?: boolean;
}

export function CrmClienteWizardModal({
  open,
  onOpenChange,
  onCreate,
  stageInicial,
  clientes = CLIENTES_MOCK,
  consultores = CONSULTORES,
  onBuscaCliente,
  buscandoClientes,
}: Props) {
  const { user } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [busca, setBusca] = useState("");
  const [cliente, setCliente] = useState<CrmCliente | null>(null);
  const [stage, setStage] = useState<CrmStage>(stageInicial ?? "em_negociacao");
  const [consultorId, setConsultorId] = useState<string>("");
  const [prioridade, setPrioridade] = useState<(typeof PRIORIDADES)[number]["id"]>("media");
  const [canal, setCanal] = useState("whatsapp");
  const [valor, setValor] = useState("");
  const [boleto, setBoleto] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [dataAcao, setDataAcao] = useState("");
  const [notas, setNotas] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [anexos, setAnexos] = useState<CrmAnexo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const wasOpenRef = useRef(false);

  const clientesFiltrados = useMemo(() => clientes, [clientes]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (!consultores.length) return;

    const defaultId = resolveDefaultConsultorId(consultores, user?.id);
    if (!defaultId) return;

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;

    if (justOpened) {
      setConsultorId(defaultId);
      return;
    }

    // Consultores carregaram após abrir o modal
    setConsultorId((current) => current || defaultId);
  }, [open, consultores, user?.id]);

  const progresso = ((stepIdx + 1) / STEPS.length) * 100;

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const canNext =
    (stepIdx === 0 && !!cliente) ||
    (stepIdx === 1 && !!stage) ||
    (stepIdx === 2 && !!consultorId && !!prioridade && !!canal) ||
    stepIdx === 3 ||
    stepIdx === 4;

  async function next() {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx((i) => i + 1);
      return;
    }

    if (!cliente) {
      reset();
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      await onCreate?.({
        cliente,
        stage,
        consultorId,
        prioridade,
        canal,
        valor,
        boleto,
        proximaAcao,
        dataAcao,
        notas,
        tags,
        anexos,
      });
      reset();
      onOpenChange(false);
    } catch {
      // erro já sinalizado pelo onCreate; mantém o modal aberto para nova tentativa
    } finally {
      setSubmitting(false);
    }
  }
  function prev() {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  }
  function reset() {
    setStepIdx(0);
    setBusca("");
    setCliente(null);
    setStage(stageInicial ?? "em_negociacao");
    setConsultorId(resolveDefaultConsultorId(consultores, user?.id));
    setPrioridade("media");
    setCanal("whatsapp");
    setValor("");
    setBoleto("");
    setProximaAcao("");
    setDataAcao("");
    setNotas("");
    setTags([]);
    setAnexos([]);
  }

  useEffect(() => {
    if (!open || stepIdx !== 0) return;
    const t = setTimeout(() => onBuscaCliente?.(busca), 300);
    return () => clearTimeout(t);
  }, [busca, open, stepIdx, onBuscaCliente]);

  const consultor = consultores.find((c) => c.id === consultorId);
  const stageObj = STAGES.find((s) => s.id === stage)!;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (submitting) return; onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden gap-0 border-0">
        <DialogTitle className="sr-only">Novo card no CRM Clientes</DialogTitle>
        <DialogDescription className="sr-only">
          Wizard para adicionar um cliente ao Kanban do CRM.
        </DialogDescription>

        <div className="grid lg:grid-cols-[300px_1fr] min-h-[680px] max-h-[90vh]">
          <aside
            className="relative hidden lg:flex flex-col justify-between p-6 text-white overflow-hidden"
            style={{
              backgroundImage:
                "linear-gradient(160deg, rgba(15,23,42,0.94) 0%, rgba(30,41,59,0.9) 55%, rgba(2,6,23,0.96) 100%), url('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                <Users2 className="h-3.5 w-3.5" /> CRM Clientes
              </div>
              <h2 className="mt-3 text-2xl font-bold leading-tight">Novo atendimento</h2>
              <p className="mt-1 text-sm text-white/70">
                Cadastre o cliente no funil e delegue ao consultor.
              </p>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-white/70">
                  <span>Progresso</span>
                  <span className="text-white">{Math.round(progresso)}%</span>
                </div>
                <Progress value={progresso} className="mt-2 h-1.5 bg-white/15" />
                <p className="mt-2 text-xs text-white/60">
                  Etapa {stepIdx + 1} de {STEPS.length}
                </p>
              </div>
            </div>

            <ol className="relative mt-6 space-y-1.5">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const ativo = i === stepIdx;
                const feito = i < stepIdx;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setStepIdx(i)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                        ativo
                          ? "bg-white text-slate-900 shadow-lg"
                          : "text-white/80 hover:bg-white/10",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold",
                          ativo
                            ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground"
                            : feito
                              ? "bg-emerald-500 text-white"
                              : "bg-white/10 text-white/80",
                        )}
                      >
                        {feito ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold leading-tight">{s.titulo}</p>
                        <p className={cn("truncate text-[11px]", ativo ? "text-slate-500" : "text-white/55")}>
                          {s.subtitulo}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="relative mt-6 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 backdrop-blur">
              <div className="flex items-center gap-2 text-white">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Dica CRM</span>
              </div>
              <p className="mt-1 leading-snug">
                Cards com próxima ação e prioridade recebem lembretes automáticos ao consultor.
              </p>
            </div>
          </aside>

          <section className="flex flex-col bg-background overflow-hidden min-h-0">
            <header className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Etapa {stepIdx + 1} — {STEPS[stepIdx].titulo}
                </p>
                <h3 className="text-xl font-bold tracking-tight">{STEPS[stepIdx].subtitulo}</h3>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
              {stepIdx === 0 && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por razão social ou CNPJ..."
                      className="h-11 pl-9"
                    />
                  </div>
                  {buscandoClientes && (
                    <p className="text-xs text-muted-foreground">Buscando clientes...</p>
                  )}
                  {!buscandoClientes && clientesFiltrados.length === 0 && (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado. Digite o nome ou CNPJ para buscar.
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {clientesFiltrados.map((c) => {
                      const sel = cliente?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setCliente(c)}
                          className={cn(
                            "relative rounded-xl border-2 p-4 text-left transition",
                            sel
                              ? "border-primary bg-primary/5 shadow-md"
                              : "border-border bg-card hover:border-foreground/30 hover:bg-muted/40",
                          )}
                        >
                          {sel && (
                            <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">{c.razao}</p>
                              <p className="text-xs text-muted-foreground">{c.cnpj}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {c.segmento} · {c.cidade}
                              </p>
                              <p className="mt-1.5 text-[11px] font-semibold text-primary">
                                Ticket médio {c.ticket}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {stepIdx === 1 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {STAGES.map((s) => {
                    const Icon = s.icon;
                    const sel = stage === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setStage(s.id)}
                        className={cn(
                          "relative overflow-hidden rounded-xl border-2 p-5 text-left transition",
                          sel
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border bg-card hover:border-foreground/30 hover:bg-muted/40",
                        )}
                      >
                        {sel && (
                          <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}
                        <div className={cn("mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", s.cor)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-bold">{s.titulo}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{s.descricao}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {stepIdx === 2 && (
                <div className="space-y-6">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Consultor responsável
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {consultores.map((c) => {
                        const sel = consultorId === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setConsultorId(c.id)}
                            className={cn(
                              "relative flex items-center gap-3 rounded-xl border-2 p-4 text-left transition",
                              sel
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card hover:border-foreground/30",
                            )}
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-bold">
                              {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold">{c.nome}</p>
                              <p className="text-[11px] text-muted-foreground">{c.papel}</p>
                            </div>
                            {sel && <CheckCircle2 className="h-5 w-5 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Prioridade
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {PRIORIDADES.map((p) => {
                        const sel = prioridade === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setPrioridade(p.id)}
                            className={cn(
                              "relative rounded-xl border-2 p-4 text-left transition",
                              sel
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card hover:border-foreground/30",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn("h-2.5 w-2.5 rounded-full", p.cor)} />
                              <p className="text-sm font-bold">{p.label}</p>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{p.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Canal preferencial
                    </p>
                    <div className="grid gap-3 sm:grid-cols-4">
                      {CANAIS.map((c) => {
                        const Icon = c.icon;
                        const sel = canal === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setCanal(c.id)}
                            className={cn(
                              "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition",
                              sel
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-card hover:border-foreground/30",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs font-semibold">{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {stepIdx === 3 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Valor negociado
                      </label>
                      <div className="relative">
                        <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={valor} onChange={(e) => setValor(mascararInputReal(e.target.value))} placeholder="R$ 0,00" className="pl-9" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Nº do boleto (se houver)
                      </label>
                      <div className="relative">
                        <Receipt className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={boleto} onChange={(e) => setBoleto(e.target.value)} placeholder="000000-0" className="pl-9" />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Próxima ação
                      </label>
                      <Input
                        value={proximaAcao}
                        onChange={(e) => setProximaAcao(e.target.value)}
                        placeholder="Ex.: Ligar para retomar negociação"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Data
                      </label>
                      <div className="relative">
                        <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type="date" value={dataAcao} onChange={(e) => setDataAcao(e.target.value)} className="pl-9" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Tags do atendimento
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["Renovação", "SICAF", "Certidões", "Suporte", "Upsell", "Recuperação"].map((t) => {
                        const sel = tags.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() => toggleTag(t)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-semibold transition",
                              sel
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-muted",
                            )}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Notas do consultor
                    </label>
                    <Textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Contexto, objeções, ganchos comerciais, combinados..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" /> Evidências (comprovante ou print da conversa)
                    </label>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Anexe o comprovante do boleto pago ou um print da conversa com o cliente para registrar a evidência do atendimento.
                    </p>
                    <CrmAnexosUploader
                      anexos={anexos}
                      onChange={setAnexos}
                      tipoPadrao={boleto ? "comprovante" : "conversa"}
                    />
                  </div>
                </div>
              )}

              {stepIdx === 4 && cliente && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/30 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</p>
                        <p className="text-lg font-bold">{cliente.razao}</p>
                        <p className="text-xs text-muted-foreground">{cliente.cnpj} · {cliente.cidade}</p>
                      </div>
                      <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white bg-gradient-to-br", stageObj.cor)}>
                        <stageObj.icon className="h-3.5 w-3.5" /> {stageObj.titulo}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ResumoItem icon={<UserCog className="h-4 w-4" />} label="Consultor" valor={consultor?.nome ?? "—"} />
                    <ResumoItem icon={<Flag className="h-4 w-4" />} label="Prioridade" valor={PRIORIDADES.find((p) => p.id === prioridade)?.label ?? "—"} />
                    <ResumoItem icon={<MessageSquare className="h-4 w-4" />} label="Canal" valor={CANAIS.find((c) => c.id === canal)?.label ?? "—"} />
                    <ResumoItem icon={<DollarSign className="h-4 w-4" />} label="Valor" valor={valor || "—"} />
                    <ResumoItem icon={<Receipt className="h-4 w-4" />} label="Boleto" valor={boleto || "—"} />
                    <ResumoItem icon={<CalendarClock className="h-4 w-4" />} label="Próxima ação" valor={proximaAcao ? `${proximaAcao}${dataAcao ? ` · ${dataAcao}` : ""}` : "—"} />
                  </div>
                  {tags.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((t) => (
                          <span key={t} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {notas && (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" /> Notas
                      </div>
                      <p className="mt-1.5 text-sm">{notas}</p>
                    </div>
                  )}
                  {anexos.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <Paperclip className="h-3.5 w-3.5" /> Evidências ({anexos.length})
                      </div>
                      <ul className="mt-2 space-y-1 text-xs">
                        {anexos.map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">{a.nome}</span>
                            <span className="text-muted-foreground">
                              {a.tipo === "comprovante" ? "Comprovante" : a.tipo === "conversa" ? "Conversa" : "Outro"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {stepIdx === 0 && !cliente && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" /> Selecione um cliente para continuar.
                </p>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-4">
              <Button variant="ghost" size="sm" onClick={prev} disabled={stepIdx === 0 || submitting} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Anterior
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => { reset(); onOpenChange(false); }}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => void next()} disabled={!canNext || submitting} className="gap-1.5">
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adicionando...
                    </>
                  ) : stepIdx === STEPS.length - 1 ? (
                    <>Adicionar ao Kanban <Rocket className="h-3.5 w-3.5" /></>
                  ) : (
                    <>Próximo <ArrowRight className="h-3.5 w-3.5" /></>
                  )}
                </Button>
              </div>
            </footer>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResumoItem({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 text-sm font-semibold">{valor}</p>
    </div>
  );
}

export { STAGES, PRIORIDADES, CANAIS };