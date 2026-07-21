import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  createEmailCampanha,
  deleteEmailCampanha,
  deleteEmailTemplate,
  duplicateEmailCampanha,
  fetchEmailMarketingDashboard,
  saveEmailTemplate,
  sendEmailCampanha,
  toggleEmailAutomacao,
  type EmailMktAutomacao,
  type EmailMktCampanha,
  type EmailMktPublicoOpcao,
  type EmailMktTemplate,
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
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setDetalheAlvo(c)}>
                        Detalhes
                      </Button>
                      {(c.status === "rascunho" || c.status === "agendado" || c.status === "falhou") && (
                        <Button size="sm" onClick={() => setEnviarAlvo(c)}>
                          <Send className="h-3.5 w-3.5 mr-1" /> Enviar
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
        <div className="border-b bg-gradient-to-r from-slate-50 via-white to-white px-6 py-5 flex items-start gap-3">
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
        <ScrollArea className="flex-1">
          <div className="px-6 py-5">{children}</div>
        </ScrollArea>
        {footer && (
          <div className="px-6 py-4 border-t bg-slate-50/60 flex items-center justify-between gap-3">
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

const publicoOpcoesFallback = [
  { id: "manutencao", label: "Clientes em manutenção", desc: "Todos os planos ativos", count: 0 },
  { id: "cnae", label: "Filtro por CNAE", desc: "Segmento compatível com editais", count: 0 },
  { id: "cert-venc", label: "Certidões vencendo (30d)", desc: "Preventivo automático", count: 0 },
  { id: "sicaf", label: "SICAF a vencer / vencido", desc: "Ação urgente", count: 0 },
  { id: "novos", label: "Novos clientes (7d)", desc: "Trilha de boas-vindas", count: 0 },
  { id: "todos", label: "Todos os clientes", desc: "Comunicação institucional", count: 0 },
];

function NovaCampanhaModal({
  open,
  onOpenChange,
  publicoOpcoes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  publicoOpcoes: EmailMktPublicoOpcao[];
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [categoria, setCategoria] = useState<keyof typeof categoriaMeta>("licitacoes");
  const [publico, setPublico] = useState("manutencao");
  const [assunto, setAssunto] = useState("Novas licitações para {empresa}");
  const [mensagem, setMensagem] = useState(
    "Olá {nome},\n\nSelecionamos as licitações mais compatíveis com o CNAE da {empresa} publicadas nas últimas 24h.\n\nAcesse o portal para conferir os detalhes e preparar sua proposta.",
  );
  const [modo, setModo] = useState<"agora" | "agendar">("agora");
  const [quando, setQuando] = useState("");
  const [saving, setSaving] = useState(false);

  const steps = ["Categoria", "Público", "Mensagem", "Envio"];
  const opcoes = publicoOpcoes.length ? publicoOpcoes : publicoOpcoesFallback;
  const publicoSel = opcoes.find((p) => p.id === publico) || opcoes[0];

  const reset = () => {
    setStep(0);
    setSaving(false);
  };

  const finalizar = async () => {
    if (modo === "agendar" && !quando) {
      toast.error("Informe data e horário para agendar");
      return;
    }
    setSaving(true);
    const res = await createEmailCampanha({
      titulo: assunto,
      categoria,
      publicoTipo: publico,
      assunto,
      corpo: mensagem,
      modo,
      dataAgendada: quando || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Falha ao criar campanha");
      return;
    }
    toast.success(
      modo === "agora"
        ? `Campanha enviada para ${res.campanha?.enviados ?? publicoSel.count} destinatários`
        : `Campanha agendada · ${publicoSel.count} destinatários`,
    );
    onOpenChange(false);
    onCreated();
    setTimeout(reset, 200);
  };

  return (
    <ModalShell
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
      icon={<Rocket className="h-5 w-5" />}
      tone="bg-primary/10 text-primary"
      title="Nova campanha"
      subtitle="Assistente guiado — categoria, público, mensagem e envio."
      footer={
        <>
          <div className="text-xs text-muted-foreground">
            Passo {step + 1} de {steps.length} · {steps[step]}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => void finalizar()} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {modo === "agora" ? "Enviar agora" : "Agendar envio"}
              </Button>
            )}
          </div>
        </>
      }
    >
      {/* Stepper */}
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
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Selecione o público
          </h3>
          <div className="grid gap-2">
            {opcoes.map((p) => {
              const ativo = publico === p.id;
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
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                  <Badge variant="outline" className="bg-slate-50">
                    {p.count}
                  </Badge>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Escreva a mensagem
          </h3>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Assunto</label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Corpo do e-mail</label>
            <Textarea rows={9} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-2">
              Variáveis: <code>{`{nome}`}</code>, <code>{`{empresa}`}</code>,{" "}
              <code>{`{certidao}`}</code>, <code>{`{dias}`}</code>, <code>{`{link}`}</code>
            </p>
          </div>
          <div className="rounded-xl border bg-slate-50/60 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Pré-visualização</p>
            <p className="text-sm font-semibold text-slate-900">{assunto || "Assunto do e-mail"}</p>
            <p className="text-xs text-slate-600 whitespace-pre-line mt-2">{mensagem}</p>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Quando enviar?
          </h3>
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
          {modo === "agendar" && (
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
                <p className="text-xs text-muted-foreground">Público</p>
                <p className="font-semibold">
                  {publicoSel.label} · {publicoSel.count}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Assunto</p>
                <p className="font-semibold truncate">{assunto}</p>
              </div>
            </div>
          </div>
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
  if (!campanha) return null;

  const enviar = async () => {
    setEnviando(true);
    const res = await sendEmailCampanha(campanha.id);
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.error || "Falha no envio");
      onSent();
      return;
    }
    toast.success(`Campanha enviada para ${res.enviados ?? campanha.destinatarios} destinatários`);
    onSent();
    onClose();
  };

  return (
    <ModalShell
      open={!!campanha}
      onOpenChange={(v) => !v && onClose()}
      icon={<Send className="h-5 w-5" />}
      tone="bg-emerald-100 text-emerald-700"
      title="Confirmar envio"
      subtitle="Revise as informações antes de disparar."
      size="max-w-xl"
      footer={
        <>
          <div className="text-xs text-muted-foreground">
            <strong className="text-slate-900">{campanha.destinatarios}</strong> destinatários
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={() => void enviar()} disabled={enviando} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              <Send className="h-4 w-4" />
              {enviando ? "Enviando..." : "Confirmar envio"}
            </Button>
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
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex gap-2 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <p>Após o envio, a campanha não pode ser cancelada. Cada envio é registrado no histórico do cliente.</p>
        </div>
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
}: {
  alvo: Template | "novo" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNovo = alvo === "novo";
  const t = !isNovo && alvo ? alvo : null;
  const [nome, setNome] = useState(t?.nome ?? "");
  const [assunto, setAssunto] = useState(t?.assunto ?? "");
  const [corpo, setCorpo] = useState(t?.corpo ?? "Olá {nome},\n\nEste é o corpo do template. Personalize livremente.");
  const [categoria, setCategoria] = useState<string>(t?.categoria ?? "avisos");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    if (alvo === "novo") {
      setNome("");
      setAssunto("");
      setCorpo("Olá {nome},\n\nEste é o corpo do template. Personalize livremente.");
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
          <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Corpo</label>
          <Textarea rows={9} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
          <p className="text-[11px] text-muted-foreground mt-2">
            Variáveis suportadas: <code>{`{nome}`}</code>, <code>{`{empresa}`}</code>,{" "}
            <code>{`{certidao}`}</code>, <code>{`{dias}`}</code>
          </p>
        </div>
      </div>
    </ModalShell>
  );
}