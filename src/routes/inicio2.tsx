import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/page-header";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEmpresas } from "@/lib/empresas-api";
import { fetchProntidao } from "@/lib/prontidao-api";
import { fetchLicitacoesKpis } from "@/lib/licitacoes-api";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Building2,
  ChevronRight,
  FileBadge2,
  FileCheck2,
  FileText,
  FolderOpen,
  Gavel,
  Gauge,
  Globe,
  GraduationCap,
  Layers,
  Loader2,
  PenLine,
  Radio,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/inicio2")({
  head: () => ({
    meta: [
      { title: "Plataforma — CADBRASIL" },
      {
        name: "description",
        content: "Hub de ferramentas para licitações, SICAF, documentação e gestão.",
      },
    ],
  }),
  component: Inicio2,
});

type ToolCategory = "todas" | "licitacoes" | "sicaf" | "documentos" | "ia" | "gestao" | "analise";

type PlatformTool = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: Exclude<ToolCategory, "todas">;
  to?: string;
  tag?: "Novo" | "IA" | "Em breve";
  accent?: string;
};

const CATEGORIES: { id: ToolCategory; label: string; icon: LucideIcon }[] = [
  { id: "todas", label: "Todas", icon: Layers },
  { id: "sicaf", label: "SICAF & Cadastro", icon: ShieldCheck },
  { id: "licitacoes", label: "Licitações", icon: Gavel },
  { id: "documentos", label: "Documentação", icon: FolderOpen },
  { id: "ia", label: "Inteligência Artificial", icon: Sparkles },
  { id: "gestao", label: "Gestão", icon: Building2 },
  { id: "analise", label: "Análise", icon: BarChart3 },
];

const PLATFORM_TOOLS: PlatformTool[] = [
  {
    id: "sicaf-hub",
    label: "Central SICAF",
    description: "Credenciamento, renovação e status do cadastro",
    icon: ShieldCheck,
    category: "sicaf",
    to: "/sicaf",
    accent: "from-emerald-500/15 to-emerald-600/5",
  },
  {
    id: "sicaf-assistente",
    label: "Assistente SICAF",
    description: "Passo a passo guiado com IA",
    icon: Bot,
    category: "sicaf",
    to: "/assistente",
    tag: "IA",
    accent: "from-violet-500/15 to-violet-600/5",
  },
  {
    id: "prontidao",
    label: "Prontidão",
    description: "Score de preparo para licitar",
    icon: Gauge,
    category: "sicaf",
    to: "/prontidao",
  },
  {
    id: "empresas",
    label: "Minhas Empresas",
    description: "Portfólio de CNPJs cadastrados",
    icon: Building2,
    category: "sicaf",
    to: "/empresas",
  },
  {
    id: "pagamentos",
    label: "Pagamentos SICAF",
    description: "Taxas, boletos e PIX",
    icon: Wallet,
    category: "sicaf",
    to: "/pagamentos",
  },
  {
    id: "licitacoes-busca",
    label: "Encontrar Licitações",
    description: "Radar PNCP com filtros avançados",
    icon: Search,
    category: "licitacoes",
    to: "/licitacoes",
  },
  {
    id: "licitacoes-radar",
    label: "Radar de Oportunidades",
    description: "Alertas automáticos por palavra-chave",
    icon: Radio,
    category: "licitacoes",
    to: "/licitacoes",
    tag: "Novo",
  },
  {
    id: "licitacoes-mira",
    label: "Licitações na Mira",
    description: "Pipeline de participação",
    icon: Target,
    category: "licitacoes",
    to: "/licitacoes",
  },
  {
    id: "documentos",
    label: "Gestão de Documentos",
    description: "Upload, validade e organização",
    icon: FolderOpen,
    category: "documentos",
    to: "/documentos",
  },
  {
    id: "certidoes",
    label: "Certidões",
    description: "Controle de vencimentos e alertas",
    icon: FileCheck2,
    category: "documentos",
    to: "/certidoes",
  },
  {
    id: "assinatura",
    label: "Assinatura Digital",
    description: "Assine documentos com um clique",
    icon: PenLine,
    category: "documentos",
    tag: "Em breve",
  },
  {
    id: "servicos-ia",
    label: "Serviços com IA",
    description: "Catálogo de automações inteligentes",
    icon: Sparkles,
    category: "ia",
    to: "/servicos-ia",
    tag: "IA",
  },
  {
    id: "resumo-edital",
    label: "Resumo de Edital",
    description: "Análise rápida de editais complexos",
    icon: ScanSearch,
    category: "ia",
    tag: "Em breve",
  },
  {
    id: "juridico-ia",
    label: "Consultor Jurídico IA",
    description: "Impugnações, recursos e teses",
    icon: FileText,
    category: "ia",
    tag: "Em breve",
  },
  {
    id: "servicos",
    label: "Meus Serviços",
    description: "Contratos e assessorias ativas",
    icon: FileBadge2,
    category: "gestao",
    to: "/servicos",
  },
  {
    id: "colaboradores",
    label: "Colaboradores",
    description: "Equipe e permissões de acesso",
    icon: Users,
    category: "gestao",
    to: "/colaboradores",
  },
  {
    id: "notificacoes",
    label: "Notificações",
    description: "Central de alertas e avisos",
    icon: Bell,
    category: "gestao",
    to: "/notificacoes",
  },
  {
    id: "concorrencia",
    label: "Concorrência",
    description: "Contratos e histórico de concorrentes",
    icon: Users,
    category: "analise",
    to: "/concorrencia",
    tag: "Novo",
  },
  {
    id: "sancoes",
    label: "Sanções & Penalidades",
    description: "CEIS, CNEP e compliance",
    icon: ShieldCheck,
    category: "analise",
    tag: "Em breve",
  },
  {
    id: "mercado",
    label: "Análise de Mercado",
    description: "Tendências e oportunidades por segmento",
    icon: BarChart3,
    category: "analise",
    tag: "Em breve",
  },
  {
    id: "portais",
    label: "Gerenciar Portais",
    description: "Compras.gov, BEC e credenciais",
    icon: Globe,
    category: "gestao",
    tag: "Em breve",
  },
  {
    id: "treinamento",
    label: "Capacitação",
    description: "Cursos e trilhas de licitação",
    icon: GraduationCap,
    category: "gestao",
    tag: "Em breve",
  },
];

const SICAF_QUICK_LINKS = [
  { label: "Ver status SICAF", to: "/sicaf", icon: ShieldCheck },
  { label: "Documentos pendentes", to: "/documentos", icon: FolderOpen },
  { label: "Pagar taxa anual", to: "/pagamentos", icon: Wallet },
  { label: "Assistente guiado", to: "/assistente", icon: Bot },
] as const;

function firstName(full?: string | null) {
  return full?.trim().split(/\s+/)[0] || "fornecedor";
}

function ToolCard({ tool }: { tool: PlatformTool }) {
  const Icon = tool.icon;
  const disabled = !tool.to;

  const content = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden border-border/70 shadow-soft transition-all",
        !disabled && "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        disabled && "opacity-80",
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        {tool.tag && (
          <Badge
            variant="secondary"
            className={cn(
              "absolute right-3 top-3 h-5 rounded-full px-2 text-[10px] font-semibold",
              tool.tag === "IA" && "bg-violet-600 text-white hover:bg-violet-600",
              tool.tag === "Novo" && "bg-emerald-600 text-white hover:bg-emerald-600",
              tool.tag === "Em breve" && "bg-muted text-muted-foreground",
            )}
          >
            {tool.tag}
          </Badge>
        )}
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-primary",
            tool.accent || "from-primary/15 to-primary/5",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">{tool.label}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {tool.description}
          </p>
        </div>
        {!disabled && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Abrir <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </CardContent>
    </Card>
  );

  if (tool.to) {
    return (
      <Link to={tool.to} className="block h-full">
        {content}
      </Link>
    );
  }

  return <div className="h-full cursor-default">{content}</div>;
}

function StatCard({
  label,
  value,
  hint,
  loading,
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  loading?: boolean;
  to?: string;
}) {
  const inner = (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <Loader2 className="mt-2 h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block transition-opacity hover:opacity-90">
        {inner}
      </Link>
    );
  }

  return inner;
}

function Inicio2() {
  const { user } = useAuth();
  const [category, setCategory] = useState<ToolCategory>("todas");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    empresas: 0,
    scoreMedio: 0,
    naMira: 0,
    oportunidades: 0,
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [empRes, prontRes, licRes] = await Promise.all([
          fetchEmpresas(),
          fetchProntidao(),
          fetchLicitacoesKpis().catch(() => ({ ok: false as const })),
        ]);

        const empresas = empRes.ok ? (empRes.empresas?.length ?? 0) : 0;
        const scoreMedio = prontRes.ok ? (prontRes.resumo?.media ?? 0) : 0;

        setStats({
          empresas,
          scoreMedio: Math.round(scoreMedio),
          naMira: licRes.ok ? (licRes.kpis?.na_mira ?? 0) : 0,
          oportunidades: licRes.ok
            ? (licRes.kpis?.abertas_hoje ?? licRes.kpis?.na_mira ?? 0)
            : 0,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PLATFORM_TOOLS.filter((tool) => {
      const matchCategory = category === "todas" || tool.category === category;
      const matchSearch =
        !q ||
        tool.label.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [category, search]);

  const toolsByCategory = useMemo(() => {
    const groups = CATEGORIES.filter((c) => c.id !== "todas");
    return groups
      .map((cat) => ({
        ...cat,
        tools: PLATFORM_TOOLS.filter((t) => t.category === cat.id),
      }))
      .filter((g) => g.tools.length > 0);
  }, []);

  return (
    <PageContainer className="space-y-8 pb-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 via-background to-emerald-500/5 p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <Badge variant="outline" className="mb-3 rounded-full border-primary/30 bg-primary/5 text-primary">
            Plataforma CADBRASIL · Layout v2 (beta)
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Olá, {firstName(user?.nome)} — sua central de licitações
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            SICAF, documentação, radar de oportunidades, IA e gestão em um único hub.
            Tudo que sua empresa precisa para vender ao governo.
          </p>
          <div className="mt-5 flex max-w-md gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ferramenta..."
                className="h-10 bg-background/80 pl-9"
              />
            </div>
            <Button asChild className="h-10 shrink-0 gap-1.5">
              <Link to="/licitacoes">
                <Gavel className="h-4 w-4" />
                <span className="hidden sm:inline">Licitações</span>
              </Link>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-8 -top-8 hidden h-48 w-48 rounded-full bg-primary/10 blur-3xl lg:block" />
        <div className="pointer-events-none absolute -bottom-12 right-24 hidden h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl lg:block" />
      </section>

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Empresas"
          value={stats.empresas}
          hint="CNPJs no portfólio"
          loading={loading}
          to="/empresas"
        />
        <StatCard
          label="Prontidão média"
          value={stats.scoreMedio > 0 ? `${stats.scoreMedio}%` : "—"}
          hint="Preparo para licitar"
          loading={loading}
          to="/prontidao"
        />
        <StatCard
          label="Na mira"
          value={stats.naMira}
          hint="Licitações em acompanhamento"
          loading={loading}
          to="/licitacoes"
        />
        <StatCard
          label="Oportunidades"
          value={stats.oportunidades}
          hint="Abertas no radar"
          loading={loading}
          to="/licitacoes"
        />
      </section>

      {/* SICAF Command Center */}
      <section>
        <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-background shadow-soft dark:border-emerald-900/40 dark:from-emerald-950/30">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Pilar principal</Badge>
              </div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Central SICAF & Cadastro</h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Credenciamento, renovação anual, documentação exigida e pagamento de taxas —
                o coração da sua operação com o governo federal.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {SICAF_QUICK_LINKS.map((link) => (
                  <Button key={link.label} asChild variant="secondary" size="sm" className="h-8 gap-1.5">
                    <Link to={link.to}>
                      <link.icon className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: FileCheck2, title: "Documentos", desc: "Validade e pendências" },
                { icon: Wallet, title: "Taxas", desc: "Boleto e PIX" },
                { icon: Bot, title: "Assistente", desc: "Passo a passo com IA" },
                { icon: Zap, title: "Prontidão", desc: "Score de preparo" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-emerald-200/50 bg-background/60 p-3 dark:border-emerald-900/30"
                >
                  <item.icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="mt-2 text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Category filter */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Ferramentas da plataforma</h2>
            <p className="text-sm text-muted-foreground">
              {filteredTools.length} ferramenta{filteredTools.length !== 1 ? "s" : ""} disponíve
              {filteredTools.length !== 1 ? "is" : "l"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = category === cat.id;
            return (
              <Button
                key={cat.id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className={cn("h-8 gap-1.5 rounded-full", active && "shadow-sm")}
                onClick={() => setCategory(cat.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </Button>
            );
          })}
        </div>

        {category === "todas" && !search ? (
          <div className="space-y-8">
            {toolsByCategory.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.id}>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.tools.map((tool) => (
                      <ToolCard key={tool.id} tool={tool} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTools.length > 0 ? (
              filteredTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)
            ) : (
              <Card className="col-span-full border-dashed">
                <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Nenhuma ferramenta encontrada</p>
                  <p className="text-xs text-muted-foreground">Tente outro termo ou categoria</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* Bottom promos */}
      <section className="grid gap-3 lg:grid-cols-3">
        <Card className="bg-gradient-to-br from-violet-500/10 to-background shadow-soft">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <Badge className="mb-2 bg-violet-600 text-white hover:bg-violet-600">IA</Badge>
              <h3 className="font-semibold">Assistente SICAF com IA</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Guia inteligente para credenciamento, documentos e dúvidas do processo SICAF.
              </p>
            </div>
            <Button asChild size="sm" variant="secondary" className="w-fit gap-1">
              <Link to="/assistente">
                Abrir assistente <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-sky-500/10 to-background shadow-soft">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <Badge className="mb-2 bg-sky-600 text-white hover:bg-sky-600">Licitações</Badge>
              <h3 className="font-semibold">Radar PNCP</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Encontre editais, configure alertas e acompanhe oportunidades em tempo real.
              </p>
            </div>
            <Button asChild size="sm" variant="secondary" className="w-fit gap-1">
              <Link to="/licitacoes">
                Explorar licitações <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-background shadow-soft">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <Badge className="mb-2 bg-amber-600 text-white hover:bg-amber-600">Análise</Badge>
              <h3 className="font-semibold">Concorrência & Mercado</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Analise contratos de concorrentes e prepare sanções/penalidades (em breve).
              </p>
            </div>
            <Button asChild size="sm" variant="secondary" className="w-fit gap-1">
              <Link to="/concorrencia">
                Ver concorrência <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Layout experimental em <strong className="text-foreground">/inicio2</strong> — compare com o início atual e
          nos diga qual prefere.
        </p>
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link to="/">Ver início atual</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
