import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Send,
  Users,
  Calendar,
  FileCheck2,
  Gavel,
  BellRing,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  TrendingUp,
  Eye,
  MousePointerClick,
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  Layers,
  MessageSquare,
  Rocket,
  BarChart3,
  ExternalLink,
  Copy,
  Trash2,
  PenSquare,
  Zap,
  CalendarDays,
  Loader2,
  RefreshCw,
  Code2,
  HandCoins,
  UserX,
  ShieldAlert,
  Building2,
  WandSparkles,
  Pause,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import {
  createEmailCampanha,
  deleteEmailCampanha,
  deleteEmailTemplate,
  duplicateEmailCampanha,
  fetchEmailMarketingDashboard,
  gerarHtmlCampanhaIa,
  pauseEmailCampanha,
  saveEmailTemplate,
  sendEmailCampanhaStream,
  toggleEmailAutomacao,
  type EmailMktAutomacao,
  type EmailMktCampanha,
  type EmailMktFormato,
  type EmailMktPublicoOpcao,
  type EmailMktSendEvent,
  type EmailMktTemplate,
  type EmailMktVariavel,
} from "@/lib/admin-email-marketing-api";

export const Route = createFileRoute("/admin/email-marketing")({
  component: EmailMarketingPage,
});

type Status = EmailMktCampanha["status"];
type Campanha = EmailMktCampanha;
type Template = EmailMktTemplate;

const ICON_MAP: Record<string, typeof Mail> = {
  Mail,
  Gavel,
  FileCheck2,
  BellRing,
  Sparkles,
  Send,
};

const categoriaMeta: Record<string, { label: string; cls: string; icon: typeof Mail }> = {
  licitacoes: { label: "Licitações", cls: "bg-blue-100 text-blue-700 border-blue-200", icon: Gavel },
  certidoes: { label: "Certidões", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: FileCheck2 },
  avisos: { label: "Avisos", cls: "bg-rose-100 text-rose-700 border-rose-200", icon: BellRing },
  "boas-vindas": { label: "Boas-vindas", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Sparkles },
};

const statusMeta: Record<Status, { label: string; cls: string; icon: typeof Mail }> = {
  enviado: { label: "Enviado", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  agendado: { label: "Agendado", cls: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  rascunho: { label: "Rascunho", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: Mail },
  enviando: { label: "Enviando", cls: "bg-violet-100 text-violet-700 border-violet-200", icon: Loader2 },
  pausado: { label: "Pausado", cls: "bg-amber-100 text-amber-800 border-amber-200", icon: Pause },
  falhou: { label: "Falhou", cls: "bg-rose-100 text-rose-700 border-rose-200", icon: AlertTriangle },
  cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-600 border-slate-200", icon: X },
};

function EmailMarketingPage() {
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | keyof typeof categoriaMeta>("todos");
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [autos, setAutos] = useState<EmailMktAutomacao[]>([]);
  const [publicoOpcoes, setPublicoOpcoes] = useState<EmailMktPublicoOpcao[]>([]);
  const [variaveis, setVariaveis] = useState<EmailMktVariavel[]>(VARIAVEIS_FALLBACK);
  const [kpis, setKpis] = useState({ enviados30: 0, taxaAbertura: 0, taxaCliques: 0, clientesAtivos: 0 });
  const [novaOpen, setNovaOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [detalheAlvo, setDetalheAlvo] = useState<Campanha | null>(null);
  const [enviarAlvo, setEnviarAlvo] = useState<Campanha | null>(null);
  const [templateAlvo, setTemplateAlvo] = useState<Template | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchEmailMarketingDashboard();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar Email Marketing");
      return;
    }
    setCampanhas(res.campanhas || []);
    setTemplates(res.templates || []);
    setAutos(res.automacoes || []);
    setPublicoOpcoes(res.publicoOpcoes || []);
    if (res.variaveis?.length) setVariaveis(res.variaveis);
    if (res.kpis) setKpis(res.kpis);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    return campanhas.filter((c) => {
      if (c.status === "cancelado") return false;
      if (filtro !== "todos" && c.categoria !== filtro) return false;
      if (busca && !c.titulo.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [busca, filtro, campanhas]);

  const toggleAuto = async (id: string, ativo: boolean) => {
    const prev = autos;
    setAutos((list) => list.map((a) => (a.id === id ? { ...a, ativo } : a)));
    const res = await toggleEmailAutomacao(id, ativo);
    if (!res.ok) {
      setAutos(prev);
      toast.error(res.error || "Falha ao atualizar automação");
      return;
    }
    if (res.automacao) {
      setAutos((list) => list.map((a) => (a.id === id ? res.automacao! : a)));
    }
    toast.success("Automação atualizada");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando Email Marketing...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Email Marketing"
        subtitle="Campanhas, boletins de licitações, alertas de certidões e avisos para clientes de manutenção."
        icon={<Mail className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void carregar()}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar
            </Button>
            <Button variant="outline" onClick={() => setAgendaOpen(true)}>
              <Calendar className="h-4 w-4 mr-1.5" /> Agendamentos
            </Button>
            <Button onClick={() => setNovaOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Nova campanha
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="E-mails enviados (30d)" value={kpis.enviados30.toLocaleString("pt-BR")} icon={Send} tone="text-blue-600 bg-blue-100" />
        <Kpi label="Taxa de abertura" value={`${kpis.taxaAbertura}%`} icon={Eye} tone="text-emerald-600 bg-emerald-100" hint="Registra ao integrar pixel de tracking" />
        <Kpi label="Taxa de cliques" value={`${kpis.taxaCliques}%`} icon={MousePointerClick} tone="text-violet-600 bg-violet-100" hint="Registra ao integrar pixel de tracking" />
        <Kpi label="Clientes ativos" value={kpis.clientesAtivos.toLocaleString("pt-BR")} icon={Users} tone="text-amber-600 bg-amber-100" hint="Manutenção ativa" />
      </div>

      <Tabs defaultValue="campanhas">
        <TabsList>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="nova">Nova campanha</TabsTrigger>
        </TabsList>

        <TabsContent value="campanhas" className="mt-4 space-y-4">
          <Card className="p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar campanha..."
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["todos", "licitacoes", "certidoes", "avisos", "boas-vindas"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    filtro === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f === "todos" ? "Todas" : categoriaMeta[f].label}
                </button>
              ))}
            </div>
          </Card>

          <div className="grid gap-3">
            {filtradas.map((c) => {
              const cat = categoriaMeta[c.categoria];
              const st = statusMeta[c.status] || statusMeta.rascunho;
              const CatIcon = cat.icon;
              const StIcon = st.icon;
              const taxaAb = c.enviados ? Math.round((c.aberturas / c.enviados) * 100) : 0;
              const taxaCl = c.enviados ? Math.round((c.cliques / c.enviados) * 100) : 0;
              return (
                <Card key={c.id} className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${cat.cls}`}>
                        <CatIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-sm truncate">{c.titulo}</h3>
                          <Badge variant="outline" className={cat.cls}>{cat.label}</Badge>
                          <Badge variant="outline" className={st.cls}>
                            <StIcon className="h-3 w-3 mr-1" />
                            {st.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Users className="h-3 w-3 inline mr-1" />
                          {c.publico} · {c.destinatarios} destinatários · {c.data}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 lg:w-80">
                      <Metric label="Enviados" value={c.enviados} />
                      <Metric label="Abertura" value={`${taxaAb}%`} />
                      <Metric label="Cliques" value={`${taxaCl}%`} />
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      <Button variant="outline" size="sm" onClick={() => setDetalheAlvo(c)}>
                        Detalhes
                      </Button>
                      {c.status === "enviando" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-800"
                          onClick={() => void (async () => {
                            const res = await pauseEmailCampanha(c.id);
                            if (!res.ok) {
                              toast.error(res.error || "Falha ao pausar");
                              return;
                            }
                            toast.success("Campanha pausada");
                            void carregar();
                          })()}
                        >
                          <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                        </Button>
                      )}
                      {(c.status === "rascunho" ||
                        c.status === "agendado" ||
                        c.status === "falhou" ||
                        c.status === "pausado" ||
                        c.status === "enviando") && (
                        <Button size="sm" onClick={() => setEnviarAlvo(c)}>
                          {c.status === "pausado" || c.status === "enviando" || c.status === "falhou" ? (
                            <>
                              <Play className="h-3.5 w-3.5 mr-1" /> Retomar
                            </>
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5 mr-1" /> Enviar
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
            {filtradas.length === 0 && (
              <Card className="p-10 text-center text-sm text-muted-foreground">
                Nenhuma campanha encontrada. Crie a primeira pelo botão Nova campanha.
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="automacoes" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {autos.map((a) => {
              const Icon = ICON_MAP[a.icon] || Mail;
              return (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${a.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm">{a.nome}</h3>
                        <Switch checked={a.ativo} onCheckedChange={(v) => void toggleAuto(a.id, v)} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{a.descricao}</p>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {a.stats}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => {
              const cat = categoriaMeta[t.categoria] || categoriaMeta.avisos;
              const Icon = cat.icon;
              return (
                <Card key={t.id} className="p-4 hover:shadow-md transition cursor-pointer" onClick={() => setTemplateAlvo(t)}>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${cat.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-sm mt-3">{t.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-1 truncate">Assunto: {t.assunto}</p>
                  <Badge variant="outline" className={`${cat.cls} mt-3`}>{cat.label}</Badge>
                </Card>
              );
            })}
            <Card className="p-4 border-dashed flex flex-col items-center justify-center text-center min-h-[140px] cursor-pointer hover:bg-muted/40" onClick={() => setTemplateAlvo("novo")}>
              <Plus className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium mt-2">Novo template</span>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nova" className="mt-4">
          <Card className="p-8 flex flex-col items-center text-center gap-3 max-w-3xl">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Rocket className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">Criar nova campanha</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Assistente guiado em 4 passos: categoria, público, mensagem e agendamento.
            </p>
            <Button onClick={() => setNovaOpen(true)} className="mt-2">
              <Plus className="h-4 w-4 mr-1.5" /> Abrir assistente
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <NovaCampanhaModal
        open={novaOpen}
        onOpenChange={setNovaOpen}
        publicoOpcoes={publicoOpcoes}
        variaveis={variaveis}
        onCreated={() => void carregar()}
      />
      <AgendamentosModal
        open={agendaOpen}
        onOpenChange={setAgendaOpen}
        items={campanhas.filter((c) => c.status === "agendado" || c.status === "rascunho")}
        onChanged={() => void carregar()}
      />
      <DetalhesCampanhaModal
        campanha={detalheAlvo}
        onClose={() => setDetalheAlvo(null)}
        onDuplicated={() => void carregar()}
      />
      <EnviarCampanhaModal
        campanha={enviarAlvo}
        onClose={() => setEnviarAlvo(null)}
        onSent={() => void carregar()}
      />
      <TemplateModal
        alvo={templateAlvo}
        onClose={() => setTemplateAlvo(null)}
        onSaved={() => void carregar()}
        variaveis={variaveis}
      />
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone, hint }: { label: string; value: string; icon: any; tone: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

type EnvioLogLine = {
  id: string;
  ok: boolean;
  email: string;
  nome?: string;
  message: string;
  at: number;
};

type EnvioProgressState = {
  active: boolean;
  done: boolean;
  paused: boolean;
  campanhaId: string | null;
  total: number;
  index: number;
  enviados: number;
  falhas: number;
  percent: number;
  logs: EnvioLogLine[];
};

const ENVIO_PROGRESS_IDLE: EnvioProgressState = {
  active: false,
  done: false,
  paused: false,
  campanhaId: null,
  total: 0,
  index: 0,
  enviados: 0,
  falhas: 0,
  percent: 0,
  logs: [],
};

function applySendEvent(prev: EnvioProgressState, event: EmailMktSendEvent): EnvioProgressState {
  if (event.type === "start") {
    const retomada = !!event.retomada || (event.jaEnviados || 0) > 0;
    return {
      active: true,
      done: false,
      paused: false,
      campanhaId: event.campanhaId || prev.campanhaId,
      total: event.total || 0,
      index: event.jaEnviados || 0,
      enviados: event.jaEnviados || 0,
      falhas: 0,
      percent: event.total ? Math.round(((event.jaEnviados || 0) / event.total) * 100) : 0,
      logs: [
        {
          id: `start-${Date.now()}`,
          ok: true,
          email: "",
          message: retomada
            ? `Retomando envio · ${event.jaEnviados || 0} já enviados · ${event.pendentes ?? event.total} pendentes…`
            : `Iniciando envio para ${event.total} destinatário(s)…`,
          at: Date.now(),
        },
      ],
    };
  }
  if (event.type === "item") {
    const line: EnvioLogLine = {
      id: `${event.index}-${event.email}`,
      ok: event.ok,
      email: event.email,
      nome: event.nome,
      message: event.ok
        ? `OK · ${event.email}${event.nome ? ` (${event.nome})` : ""}`
        : `ERRO · ${event.email} — ${event.error || "falha"}`,
      at: Date.now(),
    };
    return {
      ...prev,
      active: true,
      done: false,
      paused: false,
      total: event.total,
      index: event.index,
      enviados: event.enviados,
      falhas: event.falhas,
      percent: event.percent,
      logs: [...prev.logs, line].slice(-400),
    };
  }
  if (event.type === "paused") {
    return {
      ...prev,
      active: false,
      done: true,
      paused: true,
      enviados: event.enviados ?? prev.enviados,
      falhas: event.falhas ?? prev.falhas,
      total: event.total ?? prev.total,
      percent: event.total
        ? Math.round(((event.enviados ?? prev.enviados) / event.total) * 100)
        : prev.percent,
      logs: [
        ...prev.logs,
        {
          id: `paused-${Date.now()}`,
          ok: true,
          email: "",
          message: `Pausado · ${event.enviados ?? prev.enviados} enviados · ${event.falhas ?? prev.falhas} falhas — use Retomar`,
          at: Date.now(),
        },
      ].slice(-400),
    };
  }
  if (event.type === "done") {
    return {
      ...prev,
      active: false,
      done: true,
      paused: !!event.paused,
      enviados: event.enviados ?? prev.enviados,
      falhas: event.falhas ?? prev.falhas,
      percent: event.paused
        ? event.total
          ? Math.round(((event.enviados ?? prev.enviados) / event.total) * 100)
          : prev.percent
        : 100,
      total: event.total ?? prev.total,
      logs: [
        ...prev.logs,
        {
          id: `done-${Date.now()}`,
          ok: !!event.ok,
          email: "",
          message: event.message
            ? event.message
            : event.paused
              ? `Pausado/parcial · ${event.enviados ?? 0} enviados · ${event.falhas ?? 0} falhas`
              : event.ok
                ? `Concluído · ${event.enviados ?? 0} enviados · ${event.falhas ?? 0} falhas`
                : `Falhou · ${event.error || "nenhum e-mail enviado"}`,
          at: Date.now(),
        },
      ].slice(-400),
    };
  }
  if (event.type === "error") {
    return {
      ...prev,
      active: false,
      done: true,
      paused: false,
      logs: [
        ...prev.logs,
        {
          id: `error-${Date.now()}`,
          ok: false,
          email: "",
          message: `ERRO · ${event.error || "Falha no envio"}`,
          at: Date.now(),
        },
      ].slice(-400),
    };
  }
  return prev;
}

function EnvioProgressPanel({
  progress,
  onPause,
  pausing,
}: {
  progress: EnvioProgressState;
  onPause?: () => void;
  pausing?: boolean;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [progress.logs.length]);

  if (!progress.active && !progress.done) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-violet-900 flex items-center gap-2">
          {progress.active ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : progress.paused ? (
            <Pause className="h-4 w-4 text-amber-600" />
          ) : progress.falhas > 0 && progress.enviados === 0 ? (
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
          {progress.active
            ? "Enviando e-mails…"
            : progress.paused
              ? "Campanha pausada"
              : "Envio finalizado"}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {progress.enviados}/{progress.total || "—"} · {progress.percent}%
          </p>
          {progress.active && onPause && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
              disabled={pausing}
              onClick={onPause}
            >
              {pausing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
              Pausar
            </Button>
          )}
        </div>
      </div>
      <Progress value={progress.percent} className="h-2" />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white border px-2 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground">Enviados</p>
          <p className="text-sm font-bold text-emerald-700">{progress.enviados}</p>
        </div>
        <div className="rounded-lg bg-white border px-2 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground">Falhas</p>
          <p className="text-sm font-bold text-rose-700">{progress.falhas}</p>
        </div>
        <div className="rounded-lg bg-white border px-2 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground">Total</p>
          <p className="text-sm font-bold text-slate-800">{progress.total}</p>
        </div>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Log em tempo real</p>
        <div
          ref={logRef}
          className="h-48 overflow-y-auto rounded-lg border bg-slate-950 text-[11px] font-mono leading-relaxed p-2.5 space-y-0.5"
        >
          {progress.logs.map((l) => (
            <div key={l.id} className={l.ok ? "text-emerald-300" : "text-rose-300"}>
              {l.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal shell                                                         */
/* ------------------------------------------------------------------ */

function ModalShell({
  open,
  onOpenChange,
  icon,
  tone = "bg-primary/10 text-primary",
  title,
  subtitle,
  children,
  footer,
  size = "max-w-3xl",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  icon: React.ReactNode;
  tone?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${size} p-0 overflow-hidden gap-0 sm:rounded-2xl border-0 max-h-[92vh] flex flex-col`}>
        <div className="shrink-0 border-b bg-gradient-to-r from-slate-50 via-white to-white px-6 py-5 flex items-start gap-3">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ring-1 ring-slate-200 ${tone}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t bg-slate-50/60 flex items-center justify-between gap-3">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Nova campanha (wizard 4 steps)                                     */
/* ------------------------------------------------------------------ */

const HTML_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#0f172a;color:#ffffff;padding:20px 24px;font-size:18px;font-weight:700;">
            CADBRASIL
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px;color:#1e293b;font-size:15px;line-height:1.65;">
            <p style="margin:0 0 16px;">Olá <strong>{{nome}}</strong>,</p>
            <p style="margin:0 0 16px;">Temos uma atualização importante para <strong>{{razaosocial}}</strong> (CNPJ {{cnpj}}).</p>
            <p style="margin:0 0 24px;">Acesse o portal para conferir os detalhes e manter seu cadastro em dia.</p>
            <p style="margin:0;">
              <a href="{{link}}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">
                Acessar portal
              </a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;">
            CADBRASIL · Credenciamento SICAF · {{razaosocial}}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const VARIAVEIS_FALLBACK: EmailMktVariavel[] = [
  { key: "razaosocial", label: "Razão social", sample: "Empresa Exemplo Ltda" },
  { key: "nomefantasia", label: "Nome fantasia", sample: "Exemplo" },
  { key: "cnpj", label: "CNPJ/CPF", sample: "12.345.678/0001-90" },
  { key: "nome", label: "Responsável", sample: "Maria Silva" },
  { key: "email", label: "E-mail", sample: "maria@empresa.com.br" },
  { key: "telefone", label: "Telefone", sample: "(11) 99999-0000" },
  { key: "cidade", label: "Cidade", sample: "São Paulo" },
  { key: "estado", label: "UF", sample: "SP" },
  { key: "empresa", label: "Empresa", sample: "Empresa Exemplo Ltda" },
  { key: "link", label: "Link do portal", sample: "https://fornecedor.cadbrasil.com.br" },
  { key: "certidao", label: "Certidão", sample: "CND Federal" },
  { key: "dias", label: "Dias", sample: "15" },
];

function applyPreviewVars(content: string, variaveis: EmailMktVariavel[] = VARIAVEIS_FALLBACK) {
  const map: Record<string, string> = {};
  for (const v of variaveis) {
    map[v.key.toLowerCase()] = v.sample || v.label;
  }
  map.titulo = map.titulo || "Campanha CADBRASIL";
  map.mensagem = map.mensagem || "Mensagem de exemplo";
  map.portal = map.link || "https://fornecedor.cadbrasil.com.br";
  map.documento = map.documento || map.cnpj || "";
  map.uf = map.uf || map.estado || "";
  map.responsavel = map.responsavel || map.nome || "";

  let out = String(content || "");
  out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => map[key.toLowerCase()] ?? `{{${key}}}`);
  out = out.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, key: string) => map[key.toLowerCase()] ?? `{${key}}`);
  return out;
}

function insertToken(
  value: string,
  setValue: (v: string) => void,
  el: HTMLInputElement | HTMLTextAreaElement | null,
  token: string,
) {
  if (!el) {
    setValue(`${value}${token}`);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + token + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  });
}

function VariaveisChips({
  variaveis,
  onInsert,
}: {
  variaveis: EmailMktVariavel[];
  onInsert: (token: string) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Clique para inserir no cursor. No envio, cada cliente recebe seus dados (ex.:{" "}
        <code className="text-[10px]">{"{{razaosocial}}"}</code>, <code className="text-[10px]">{"{{cnpj}}"}</code>).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {variaveis.map((v) => {
          const token = `{{${v.key}}}`;
          return (
            <button
              key={v.key}
              type="button"
              title={`${v.label} · exemplo: ${v.sample || ""}`}
              onClick={() => onInsert(token)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-primary hover:text-primary transition"
            >
              {token}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PUBLICO_GRUPO_LABEL: Record<string, string> = {
  financeiro: "Financeiro",
  comercial: "Comercial",
  risco: "Risco / Compliance",
  geral: "Geral",
};

const PUBLICO_ICON: Record<string, typeof Users> = {
  manutencao: Building2,
  nunca_pagaram: UserX,
  taxa_pendente: HandCoins,
  ja_pagaram: CheckCircle2,
  sem_manutencao: Users,
  cnae: Layers,
  "cert-venc": FileCheck2,
  sicaf: ShieldAlert,
  novos: Sparkles,
  todos: Users,
};

const publicoOpcoesFallback: EmailMktPublicoOpcao[] = [
  { id: "nunca_pagaram", label: "Nunca pagaram (só cadastro)", desc: "Cadastrados sem nenhum pagamento confirmado", count: 0, grupo: "financeiro" },
  { id: "taxa_pendente", label: "Taxa SICAF pendente", desc: "Boleto/taxa SICAF em aberto", count: 0, grupo: "financeiro" },
  { id: "ja_pagaram", label: "Já pagaram (ao menos 1x)", desc: "Pelo menos um pagamento quitado", count: 0, grupo: "financeiro" },
  { id: "manutencao", label: "Clientes em manutenção", desc: "Planos de manutenção ativos", count: 0, grupo: "comercial" },
  { id: "sem_manutencao", label: "Sem manutenção ativa", desc: "Sem plano de manutenção ativo", count: 0, grupo: "comercial" },
  { id: "cnae", label: "Filtro por CNAE", desc: "Segmento com CNAE/ramo cadastrado", count: 0, grupo: "comercial" },
  { id: "novos", label: "Novos clientes (7d)", desc: "Cadastros dos últimos 7 dias", count: 0, grupo: "comercial" },
  { id: "cert-venc", label: "Certidões vencendo (30d)", desc: "Preventivo automático", count: 0, grupo: "risco" },
  { id: "sicaf", label: "SICAF a vencer / vencido", desc: "Credenciamento a vencer ou vencido", count: 0, grupo: "risco" },
  { id: "todos", label: "Todos os clientes", desc: "Base completa com e-mail válido", count: 0, grupo: "geral" },
];

function NovaCampanhaModal({
  open,
  onOpenChange,
  publicoOpcoes,
  onCreated,
  variaveis = VARIAVEIS_FALLBACK,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  publicoOpcoes: EmailMktPublicoOpcao[];
  onCreated: () => void;
  variaveis?: EmailMktVariavel[];
}) {
  const [step, setStep] = useState(0);
  const [categoria, setCategoria] = useState<keyof typeof categoriaMeta>("licitacoes");
  const [publico, setPublico] = useState("nunca_pagaram");
  const [assunto, setAssunto] = useState("Novas licitações para {{razaosocial}}");
  const [formato, setFormato] = useState<EmailMktFormato>("texto");
  const [mensagem, setMensagem] = useState(
    "Olá {{nome}},\n\nSelecionamos as licitações mais compatíveis com o CNAE da {{razaosocial}} (CNPJ {{cnpj}}) publicadas nas últimas 24h.\n\nAcesse o portal para conferir os detalhes e preparar sua proposta:\n{{link}}",
  );
  const [modo, setModo] = useState<"agora" | "agendar">("agora");
  const [quando, setQuando] = useState("");
  const [saving, setSaving] = useState(false);
  const [gerandoIa, setGerandoIa] = useState(false);
  const [previewTab, setPreviewTab] = useState<"codigo" | "preview">("codigo");
  const [insertTarget, setInsertTarget] = useState<"assunto" | "corpo">("corpo");
  const [envioProgress, setEnvioProgress] = useState<EnvioProgressState>(ENVIO_PROGRESS_IDLE);
  const [pausing, setPausing] = useState(false);
  const assuntoRef = useRef<HTMLInputElement>(null);
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  const steps = ["Categoria", "Público", "Mensagem", "Envio"];
  const opcoes = publicoOpcoes.length ? publicoOpcoes : publicoOpcoesFallback;
  const publicoSel = opcoes.find((p) => p.id === publico) || opcoes[0];
  const varsList = variaveis.length ? variaveis : VARIAVEIS_FALLBACK;

  const opcoesPorGrupo = useMemo(() => {
    const order = ["financeiro", "comercial", "risco", "geral"];
    const map = new Map<string, EmailMktPublicoOpcao[]>();
    for (const o of opcoes) {
      const g = o.grupo || "geral";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return order.filter((g) => map.has(g)).map((g) => ({ grupo: g, itens: map.get(g)! }));
  }, [opcoes]);

  const previewAssunto = applyPreviewVars(assunto, varsList);
  const previewCorpo = applyPreviewVars(mensagem, varsList);
  const previewHtml =
    formato === "html"
      ? previewCorpo
      : `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;white-space:pre-wrap">${previewCorpo
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</div>`;

  const reset = () => {
    setStep(0);
    setSaving(false);
    setPausing(false);
    setFormato("texto");
    setPreviewTab("codigo");
    setPublico("nunca_pagaram");
    setEnvioProgress(ENVIO_PROGRESS_IDLE);
  };

  const pausarEnvio = async () => {
    const id = envioProgress.campanhaId;
    if (!id) {
      toast.error("Campanha ainda não criada");
      return;
    }
    setPausing(true);
    const res = await pauseEmailCampanha(id);
    setPausing(false);
    if (!res.ok) {
      toast.error(res.error || "Falha ao pausar");
      return;
    }
    toast.success("Pausa solicitada — o envio para no próximo e-mail");
  };

  const usarTemplateHtml = () => {
    setFormato("html");
    setMensagem(HTML_EMAIL_TEMPLATE);
    setPreviewTab("preview");
    toast.success("Template HTML CADBRASIL aplicado");
  };

  const criarHtmlComIa = async () => {
    setGerandoIa(true);
    setFormato("html");
    setPreviewTab("codigo");
    const res = await gerarHtmlCampanhaIa({
      assunto,
      rascunho: mensagem,
      categoria,
      publicoTipo: publico,
      publicoLabel: publicoSel.label,
    });
    setGerandoIa(false);
    if (!res.ok || !res.html) {
      toast.error(res.error || "Falha ao gerar HTML com IA");
      return;
    }
    setMensagem(res.html);
    setPreviewTab("preview");
    toast.success("HTML gerado pela IA — confira o preview");
  };

  const finalizar = async () => {
    if (!assunto.trim() || !mensagem.trim()) {
      toast.error("Preencha assunto e corpo do e-mail");
      return;
    }
    if (modo === "agendar" && !quando) {
      toast.error("Informe data e horário para agendar");
      return;
    }
    setSaving(true);

    if (modo === "agendar") {
      const res = await createEmailCampanha({
        titulo: assunto,
        categoria,
        publicoTipo: publico,
        assunto,
        corpo: mensagem,
        formato,
        modo: "agendar",
        dataAgendada: quando || undefined,
      });
      setSaving(false);
      if (!res.ok) {
        toast.error(res.error || "Falha ao criar campanha");
        return;
      }
      toast.success(`Campanha agendada · ${publicoSel.count} destinatários`);
      onOpenChange(false);
      onCreated();
      setTimeout(reset, 200);
      return;
    }

    // Envio imediato com progresso + log (SSE) via email.service
    setEnvioProgress({
      ...ENVIO_PROGRESS_IDLE,
      active: true,
      logs: [
        {
          id: `prep-${Date.now()}`,
          ok: true,
          email: "",
          message: "Criando campanha e preparando destinatários…",
          at: Date.now(),
        },
      ],
    });

    const created = await createEmailCampanha({
      titulo: assunto,
      categoria,
      publicoTipo: publico,
      assunto,
      corpo: mensagem,
      formato,
      modo: "agora",
      deferSend: true,
      stream: true,
    });

    if (!created.ok || !created.campanha?.id) {
      setSaving(false);
      setEnvioProgress((p) =>
        applySendEvent(p, { type: "error", ok: false, error: created.error || "Falha ao criar campanha" }),
      );
      toast.error(created.error || "Falha ao criar campanha");
      return;
    }

    setEnvioProgress((p) => ({ ...p, campanhaId: created.campanha!.id }));

    const result = await sendEmailCampanhaStream(created.campanha.id, (event) => {
      setEnvioProgress((prev) => applySendEvent(prev, event));
    });

    setSaving(false);
    onCreated();

    if (result.paused) {
      toast.message(`Campanha pausada · ${result.enviados ?? 0} enviados · retome na lista`);
      return;
    }
    if (!result.ok) {
      toast.error(result.error || "Falha no envio");
      return;
    }
    toast.success(
      `Campanha enviada · ${result.enviados ?? 0} ok · ${result.falhas ?? 0} falhas`,
    );
  };

  return (
    <ModalShell
      open={open}
      onOpenChange={(v) => {
        if (envioProgress.active) return;
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
      icon={<Rocket className="h-5 w-5" />}
      tone="bg-primary/10 text-primary"
      title="Nova campanha"
      subtitle="Assistente avançado — filtros, HTML e preview."
      size="max-w-5xl"
      footer={
        <>
          <div className="text-xs text-muted-foreground">
            Passo {step + 1} de {steps.length} · {steps[step]}
          </div>
          <div className="flex gap-2">
            {envioProgress.done ? (
              <Button
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(reset, 200);
                }}
              >
                Fechar
              </Button>
            ) : (
              <>
                {step > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setStep((s) => s - 1)}
                    disabled={saving || envioProgress.active}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                )}
                {step < steps.length - 1 ? (
                  <Button onClick={() => setStep((s) => s + 1)}>
                    Continuar <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => void finalizar()}
                    disabled={saving || envioProgress.active}
                    className="gap-1.5"
                  >
                    {saving || envioProgress.active ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {modo === "agora"
                      ? envioProgress.active
                        ? "Enviando…"
                        : "Enviar agora"
                      : "Agendar envio"}
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      }
    >
      <div className="mb-6">
        <Progress value={((step + 1) / steps.length) * 100} className="h-1.5" />
        <div className="grid grid-cols-4 mt-3 text-[11px] font-medium">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-1.5 ${i <= step ? "text-primary" : "text-muted-foreground"}`}
            >
              <span
                className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary/15 text-primary ring-2 ring-primary/30"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {i < step ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </span>
              {s}
            </div>
          ))}
        </div>
      </div>

      {step === 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Escolha a categoria
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(categoriaMeta) as (keyof typeof categoriaMeta)[]).map((k) => {
              const cat = categoriaMeta[k];
              const Icon = cat.icon;
              const ativo = categoria === k;
              return (
                <button
                  key={k}
                  onClick={() => setCategoria(k)}
                  className={`text-left rounded-xl border p-4 transition ${
                    ativo
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${cat.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="font-semibold text-sm mt-3">{cat.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {k === "licitacoes" && "Boletins e oportunidades diárias."}
                    {k === "certidoes" && "Alertas de vencimento e renovação."}
                    {k === "avisos" && "Comunicados, novidades e ações urgentes."}
                    {k === "boas-vindas" && "Trilha de onboarding para novos clientes."}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Selecione o público
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Filtros avançados por financeiro, comercial e risco. Contagem com e-mail válido.
            </p>
          </div>
          {opcoesPorGrupo.map(({ grupo, itens }) => (
            <div key={grupo} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {PUBLICO_GRUPO_LABEL[grupo] || grupo}
              </p>
              <div className="grid gap-2">
                {itens.map((p) => {
                  const ativo = publico === p.id;
                  const Icon = PUBLICO_ICON[p.id] || Users;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPublico(p.id)}
                      className={`text-left rounded-xl border p-3 flex items-center gap-3 transition ${
                        ativo
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{p.label}</p>
                        <p className="text-xs text-muted-foreground">{p.desc}</p>
                      </div>
                      <Badge variant="outline" className="bg-slate-50">
                        {p.count.toLocaleString("pt-BR")}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Mensagem da campanha
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={formato === "texto" ? "default" : "outline"}
                onClick={() => {
                  setFormato("texto");
                  setPreviewTab("codigo");
                }}
              >
                Texto
              </Button>
              <Button
                type="button"
                size="sm"
                variant={formato === "html" ? "default" : "outline"}
                className="gap-1.5"
                onClick={() => {
                  setFormato("html");
                  setPreviewTab("codigo");
                }}
              >
                <Code2 className="h-3.5 w-3.5" /> HTML
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-violet-600 hover:bg-violet-700"
                disabled={gerandoIa}
                onClick={() => void criarHtmlComIa()}
              >
                {gerandoIa ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <WandSparkles className="h-3.5 w-3.5" />
                )}
                {gerandoIa ? "Gerando…" : "Criar HTML com IA"}
              </Button>
              {formato === "html" && (
                <Button type="button" size="sm" variant="secondary" onClick={usarTemplateHtml}>
                  Usar template CADBRASIL
                </Button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Assunto</label>
            <Input
              ref={assuntoRef}
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              onFocus={() => setInsertTarget("assunto")}
            />
          </div>

          <VariaveisChips
            variaveis={varsList}
            onInsert={(token) => {
              if (insertTarget === "assunto") {
                insertToken(assunto, setAssunto, assuntoRef.current, token);
              } else {
                insertToken(mensagem, setMensagem, corpoRef.current, token);
              }
            }}
          />

          <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as "codigo" | "preview")}>
            <TabsList>
              <TabsTrigger value="codigo" className="gap-1.5">
                <Code2 className="h-3.5 w-3.5" /> {formato === "html" ? "Código HTML" : "Corpo"}
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="codigo" className="mt-3 space-y-2">
              <Textarea
                ref={corpoRef}
                rows={formato === "html" ? 16 : 10}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                onFocus={() => setInsertTarget("corpo")}
                className={formato === "html" ? "font-mono text-xs leading-relaxed" : ""}
                placeholder={formato === "html" ? "Cole ou escreva o HTML do e-mail..." : "Escreva a mensagem..."}
              />
              <p className="text-[11px] text-muted-foreground">
                Inserindo em: <strong>{insertTarget === "assunto" ? "assunto" : "corpo"}</strong> · aceita{" "}
                <code>{"{{variavel}}"}</code> (recomendado) ou <code>{"{variavel}"}</code>
              </p>
            </TabsContent>
            <TabsContent value="preview" className="mt-3 space-y-3">
              <div className="rounded-xl border bg-slate-50/80 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Assunto</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{previewAssunto || "—"}</p>
              </div>
              <div className="rounded-xl border overflow-hidden bg-white">
                <div className="flex items-center justify-between border-b px-3 py-2 bg-slate-50">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Preview do e-mail
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {formato === "html" ? "HTML" : "Texto"}
                  </Badge>
                </div>
                <iframe
                  title="Preview do e-mail"
                  sandbox=""
                  srcDoc={previewHtml}
                  className="w-full h-[380px] bg-white"
                />
              </div>
            </TabsContent>
          </Tabs>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Quando enviar?
          </h3>
          {!envioProgress.active && !envioProgress.done && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "agora", label: "Enviar agora", desc: "Disparo imediato para toda a base selecionada." },
                { id: "agendar", label: "Agendar", desc: "Escolha data e horário comercial." },
              ].map((o) => {
                const ativo = modo === (o.id as "agora" | "agendar");
                return (
                  <button
                    key={o.id}
                    onClick={() => setModo(o.id as "agora" | "agendar")}
                    className={`text-left rounded-xl border p-4 transition ${
                      ativo
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-semibold">{o.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{o.desc}</p>
                  </button>
                );
              })}
            </div>
          )}
          {modo === "agendar" && !envioProgress.active && !envioProgress.done && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data e horário</label>
              <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
            </div>
          )}

          <Separator />

          <div className="rounded-xl border bg-white p-4 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Resumo</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Categoria</p>
                <p className="font-semibold">{categoriaMeta[categoria].label}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Formato</p>
                <p className="font-semibold">{formato === "html" ? "HTML avançado" : "Texto"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Público</p>
                <p className="font-semibold">
                  {publicoSel.label} · {publicoSel.count.toLocaleString("pt-BR")} destinatários
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Assunto</p>
                <p className="font-semibold truncate">{assunto}</p>
              </div>
            </div>
          </div>

          <EnvioProgressPanel
            progress={envioProgress}
            pausing={pausing}
            onPause={() => void pausarEnvio()}
          />
        </section>
      )}
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/* Detalhes                                                            */
/* ------------------------------------------------------------------ */

function DetalhesCampanhaModal({
  campanha,
  onClose,
  onDuplicated,
}: {
  campanha: Campanha | null;
  onClose: () => void;
  onDuplicated: () => void;
}) {
  if (!campanha) return null;
  const cat = categoriaMeta[campanha.categoria] || categoriaMeta.avisos;
  const st = statusMeta[campanha.status] || statusMeta.rascunho;
  const taxaAb = campanha.enviados ? Math.round((campanha.aberturas / campanha.enviados) * 100) : 0;
  const taxaCl = campanha.enviados ? Math.round((campanha.cliques / campanha.enviados) * 100) : 0;
  const timeline = [
    { hora: "—", txt: "Campanha registrada", ok: true },
    { hora: "—", txt: `${campanha.enviados} e-mails enviados`, ok: campanha.enviados > 0 },
    { hora: "—", txt: `${campanha.aberturas} aberturas registradas`, ok: campanha.aberturas > 0 },
    { hora: "—", txt: `${campanha.cliques} cliques no portal`, ok: campanha.cliques > 0 },
  ];

  const duplicar = async () => {
    const res = await duplicateEmailCampanha(campanha.id);
    if (!res.ok) {
      toast.error(res.error || "Falha ao duplicar");
      return;
    }
    toast.success("Duplicada como rascunho");
    onDuplicated();
    onClose();
  };

  return (
    <ModalShell
      open={!!campanha}
      onOpenChange={(v) => !v && onClose()}
      icon={<BarChart3 className="h-5 w-5" />}
      tone={cat.cls}
      title={campanha.titulo}
      subtitle={`${cat.label} · ${campanha.publico}`}
      footer={
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className={st.cls}>{st.label}</Badge>
            <span>{campanha.data}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast.success("Link do painel copiado")}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar link
            </Button>
            <Button variant="outline" onClick={() => void duplicar()}>
              <PenSquare className="h-3.5 w-3.5 mr-1.5" /> Duplicar
            </Button>
            <Button onClick={onClose}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Fechar
            </Button>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatBox label="Destinatários" value={campanha.destinatarios} tone="bg-slate-100 text-slate-700" />
        <StatBox label="Enviados" value={campanha.enviados} tone="bg-blue-100 text-blue-700" />
        <StatBox label="Abertura" value={`${taxaAb}%`} tone="bg-emerald-100 text-emerald-700" />
        <StatBox label="Cliques" value={`${taxaCl}%`} tone="bg-violet-100 text-violet-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Desempenho
          </p>
          <div className="space-y-3">
            <BarLine label="Aberturas" value={taxaAb} tone="bg-emerald-500" />
            <BarLine label="Cliques" value={taxaCl} tone="bg-violet-500" />
            <BarLine
              label="Entregabilidade"
              value={campanha.enviados ? Math.round((campanha.enviados / campanha.destinatarios) * 100) : 0}
              tone="bg-blue-500"
            />
          </div>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Linha do tempo
          </p>
          <ul className="space-y-3">
            {timeline.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center text-[10px] ${
                    t.ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {t.ok ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                </span>
                <div>
                  <p className="font-medium text-slate-900">{t.txt}</p>
                  <p className="text-[11px] text-muted-foreground">{t.hora}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(campanha.assunto || campanha.corpo) && (
        <div className="mt-4 rounded-xl border overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Conteúdo enviado
            </p>
            <Badge variant="outline" className="text-[10px]">
              {campanha.formato === "html" ? "HTML" : "Texto"}
            </Badge>
          </div>
          <div className="p-4 space-y-2">
            {campanha.assunto && (
              <p className="text-sm font-semibold">{campanha.assunto}</p>
            )}
            {campanha.formato === "html" && campanha.corpo ? (
              <iframe
                title="Preview campanha"
                sandbox=""
                srcDoc={campanha.corpo}
                className="w-full h-64 border rounded-lg bg-white"
              />
            ) : (
              <p className="text-xs text-slate-600 whitespace-pre-line">{campanha.corpo}</p>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-xl p-3 ${tone}`}>
      <p className="text-[11px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

function BarLine({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 mt-1 overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Enviar (confirmação rascunho)                                      */
/* ------------------------------------------------------------------ */

function EnviarCampanhaModal({
  campanha,
  onClose,
  onSent,
}: {
  campanha: Campanha | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [envioProgress, setEnvioProgress] = useState<EnvioProgressState>(ENVIO_PROGRESS_IDLE);

  useEffect(() => {
    setEnviando(false);
    setPausing(false);
    setEnvioProgress(ENVIO_PROGRESS_IDLE);
  }, [campanha?.id]);

  if (!campanha) return null;

  const isRetomada =
    campanha.status === "pausado" ||
    campanha.status === "enviando" ||
    campanha.status === "falhou";

  const pausarEnvio = async () => {
    setPausing(true);
    const res = await pauseEmailCampanha(campanha.id);
    setPausing(false);
    if (!res.ok) {
      toast.error(res.error || "Falha ao pausar");
      return;
    }
    toast.success("Pausa solicitada — o envio para no próximo e-mail");
  };

  const enviar = async () => {
    setEnviando(true);
    setEnvioProgress({
      ...ENVIO_PROGRESS_IDLE,
      active: true,
      campanhaId: campanha.id,
      logs: [
        {
          id: `prep-${Date.now()}`,
          ok: true,
          email: "",
          message: isRetomada
            ? `Retomando "${campanha.titulo}" · pula e-mails já enviados…`
            : `Preparando envio de "${campanha.titulo}"…`,
          at: Date.now(),
        },
      ],
    });

    const result = await sendEmailCampanhaStream(campanha.id, (event) => {
      setEnvioProgress((prev) => applySendEvent(prev, event));
    });

    setEnviando(false);
    onSent();

    if (result.paused) {
      toast.message(`Campanha pausada · ${result.enviados ?? 0} enviados`);
      return;
    }
    if (!result.ok) {
      toast.error(result.error || "Falha no envio");
      return;
    }
    toast.success(`Campanha enviada · ${result.enviados ?? 0} ok · ${result.falhas ?? 0} falhas`);
  };

  return (
    <ModalShell
      open={!!campanha}
      onOpenChange={(v) => {
        if (envioProgress.active) return;
        if (!v) {
          setEnvioProgress(ENVIO_PROGRESS_IDLE);
          onClose();
        }
      }}
      icon={isRetomada ? <Play className="h-5 w-5" /> : <Send className="h-5 w-5" />}
      tone="bg-emerald-100 text-emerald-700"
      title={isRetomada ? "Retomar envio" : "Confirmar envio"}
      subtitle="Pausar e retomar a qualquer momento. Já enviados não são reenviados."
      size="max-w-xl"
      footer={
        <>
          <div className="text-xs text-muted-foreground">
            <strong className="text-slate-900">{campanha.destinatarios}</strong> destinatários
            {campanha.enviados > 0 ? ` · ${campanha.enviados} já enviados` : ""}
          </div>
          <div className="flex gap-2">
            {envioProgress.done ? (
              <Button
                onClick={() => {
                  setEnvioProgress(ENVIO_PROGRESS_IDLE);
                  onClose();
                }}
              >
                Fechar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={enviando || envioProgress.active}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => void enviar()}
                  disabled={enviando || envioProgress.active}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                >
                  {enviando || envioProgress.active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isRetomada ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {enviando || envioProgress.active
                    ? "Enviando…"
                    : isRetomada
                      ? "Retomar agora"
                      : "Confirmar envio"}
                </Button>
              </>
            )}
          </div>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl border p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Campanha</p>
          <p className="font-semibold text-slate-900 mt-1">{campanha.titulo}</p>
          <Badge variant="outline" className={`${categoriaMeta[campanha.categoria].cls} mt-2`}>
            {categoriaMeta[campanha.categoria].label}
          </Badge>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Público</p>
          <p className="text-sm text-slate-800 mt-1">{campanha.publico}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Status atual: {statusMeta[campanha.status]?.label || campanha.status} · Enviados{" "}
            {campanha.enviados}/{campanha.destinatarios}
          </p>
        </div>
        {!envioProgress.active && !envioProgress.done && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex gap-2 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              {isRetomada
                ? "A retomada continua de onde parou e não reenvia e-mails que já foram enviados com sucesso."
                : "Após o envio, a campanha não pode ser cancelada. Você pode pausar e retomar a qualquer momento."}
            </p>
          </div>
        )}
        <EnvioProgressPanel
          progress={envioProgress}
          pausing={pausing}
          onPause={() => void pausarEnvio()}
        />
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/* Agendamentos                                                        */
/* ------------------------------------------------------------------ */

function AgendamentosModal({
  open,
  onOpenChange,
  items,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: Campanha[];
  onChanged: () => void;
}) {
  const remove = async (id: string) => {
    const res = await deleteEmailCampanha(id);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível remover");
      return;
    }
    toast.success("Agendamento removido");
    onChanged();
  };

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      icon={<CalendarDays className="h-5 w-5" />}
      tone="bg-blue-100 text-blue-700"
      title="Agendamentos"
      subtitle="Campanhas programadas e rascunhos aguardando envio."
      footer={
        <>
          <div className="text-xs text-muted-foreground">{items.length} itens na fila</div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </>
      }
    >
      {items.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Nenhuma campanha na fila de agendamento.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => {
            const cat = categoriaMeta[c.categoria];
            const st = statusMeta[c.status];
            const Icon = cat.icon;
            return (
              <div key={c.id} className="rounded-xl border p-3 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${cat.cls}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{c.titulo}</p>
                    <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.publico} · {c.destinatarios} destinatários · {c.data}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => void remove(c.id)}>
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

function TemplateModal({
  alvo,
  onClose,
  onSaved,
  variaveis = VARIAVEIS_FALLBACK,
}: {
  alvo: Template | "novo" | null;
  onClose: () => void;
  onSaved: () => void;
  variaveis?: EmailMktVariavel[];
}) {
  const isNovo = alvo === "novo";
  const t = !isNovo && alvo ? alvo : null;
  const [nome, setNome] = useState(t?.nome ?? "");
  const [assunto, setAssunto] = useState(t?.assunto ?? "");
  const [corpo, setCorpo] = useState(
    t?.corpo ?? "Olá {{nome}},\n\nEste é o corpo do template para {{razaosocial}} ({{cnpj}}).\n\nAcesse: {{link}}",
  );
  const [categoria, setCategoria] = useState<string>(t?.categoria ?? "avisos");
  const [saving, setSaving] = useState(false);
  const [insertTarget, setInsertTarget] = useState<"assunto" | "corpo">("corpo");
  const assuntoRef = useRef<HTMLInputElement>(null);
  const corpoRef = useRef<HTMLTextAreaElement>(null);
  const varsList = variaveis.length ? variaveis : VARIAVEIS_FALLBACK;

  useEffect(() => {
    if (!alvo) return;
    if (alvo === "novo") {
      setNome("");
      setAssunto("");
      setCorpo(
        "Olá {{nome}},\n\nEste é o corpo do template para {{razaosocial}} ({{cnpj}}).\n\nAcesse: {{link}}",
      );
      setCategoria("avisos");
      return;
    }
    setNome(alvo.nome);
    setAssunto(alvo.assunto);
    setCorpo(alvo.corpo || "");
    setCategoria(alvo.categoria);
  }, [alvo]);

  const salvar = async () => {
    if (!nome || !assunto || !corpo) {
      toast.error("Preencha nome, assunto e corpo");
      return;
    }
    setSaving(true);
    const res = await saveEmailTemplate({
      id: t?.id,
      nome,
      assunto,
      corpo,
      categoria,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Falha ao salvar template");
      return;
    }
    toast.success(isNovo ? "Template criado" : "Template atualizado");
    onSaved();
    onClose();
  };

  const excluir = async () => {
    if (!t?.id) return;
    const res = await deleteEmailTemplate(t.id);
    if (!res.ok) {
      toast.error(res.error || "Falha ao excluir");
      return;
    }
    toast.success("Template removido");
    onSaved();
    onClose();
  };

  const cat = categoriaMeta[categoria] || categoriaMeta.avisos;

  return (
    <ModalShell
      open={!!alvo}
      onOpenChange={(v) => !v && onClose()}
      icon={<PenSquare className="h-5 w-5" />}
      tone={cat.cls}
      title={isNovo ? "Novo template" : `Editar · ${t?.nome ?? ""}`}
      subtitle="Templates são reutilizados em campanhas e automações."
      footer={
        <>
          {!isNovo && (
            <Button
              variant="ghost"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => void excluir()}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void salvar()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
              {isNovo ? "Criar template" : "Salvar alterações"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Nome do template</label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Boletim de licitações" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Categoria</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {(Object.keys(categoriaMeta) as (keyof typeof categoriaMeta)[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCategoria(k)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  categoria === k ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                }`}
              >
                {categoriaMeta[k].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Assunto</label>
          <Input
            ref={assuntoRef}
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            onFocus={() => setInsertTarget("assunto")}
          />
        </div>
        <VariaveisChips
          variaveis={varsList}
          onInsert={(token) => {
            if (insertTarget === "assunto") {
              insertToken(assunto, setAssunto, assuntoRef.current, token);
            } else {
              insertToken(corpo, setCorpo, corpoRef.current, token);
            }
          }}
        />
        <div>
          <label className="text-xs font-medium text-muted-foreground">Corpo</label>
          <Textarea
            ref={corpoRef}
            rows={9}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            onFocus={() => setInsertTarget("corpo")}
          />
          <p className="text-[11px] text-muted-foreground mt-2">
            Inserindo em: <strong>{insertTarget === "assunto" ? "assunto" : "corpo"}</strong> · use{" "}
            <code>{"{{razaosocial}}"}</code>, <code>{"{{cnpj}}"}</code>, <code>{"{{nome}}"}</code>, etc.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}