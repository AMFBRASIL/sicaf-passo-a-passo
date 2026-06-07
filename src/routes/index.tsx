import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/page-header";
import { AssistantCard } from "@/components/assistant-card";
import { cn } from "@/lib/utils";
import {
  Rocket,
  PlayCircle,
  Headphones,
  Bot,
  Building2,
  Gauge,
  Gavel,
  Bell,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Plus,
  ShieldCheck,
  Trophy,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — Portal CADBRASIL" },
      { name: "description", content: "Visão consolidada do seu portfólio de empresas." },
    ],
  }),
  component: HomePage,
});

type EmpresaResumo = {
  id: string;
  nome: string;
  cnpj: string;
  score: number;
  nivel: string;
  status: "ok" | "warn" | "danger";
  statusLabel: string;
  alertas: number;
};

const empresas: EmpresaResumo[] = [
  {
    id: "1",
    nome: "Construtora Horizonte LTDA",
    cnpj: "12.345.678/0001-90",
    score: 92,
    nivel: "Nível IV",
    status: "ok",
    statusLabel: "Apta",
    alertas: 0,
  },
  {
    id: "2",
    nome: "Tech Solutions Brasil",
    cnpj: "98.765.432/0001-10",
    score: 74,
    nivel: "Nível III",
    status: "warn",
    statusLabel: "Atualizar SICAF",
    alertas: 2,
  },
  {
    id: "3",
    nome: "Comércio Atlântico ME",
    cnpj: "45.678.912/0001-33",
    score: 58,
    nivel: "Nível II",
    status: "warn",
    statusLabel: "2 certidões vencendo",
    alertas: 3,
  },
  {
    id: "4",
    nome: "Serviços Modelo EIRELI",
    cnpj: "11.222.333/0001-44",
    score: 41,
    nivel: "Nível I",
    status: "danger",
    statusLabel: "Certidão vencida",
    alertas: 4,
  },
];

const alertasGlobais = [
  { empresa: "Serviços Modelo EIRELI", tipo: "Certidão Trabalhista vencida", quando: "Há 3 dias", severidade: "danger" as const },
  { empresa: "Comércio Atlântico ME", tipo: "Certidão Estadual vence em 5 dias", quando: "30/12/2025", severidade: "warn" as const },
  { empresa: "Tech Solutions Brasil", tipo: "SICAF expira em 12 dias", quando: "18/12/2025", severidade: "warn" as const },
  { empresa: "Comércio Atlântico ME", tipo: "FGTS vence em 18 dias", quando: "24/12/2025", severidade: "warn" as const },
];

function HomePage() {
  const totalEmpresas = empresas.length;
  const scoreMedio = Math.round(empresas.reduce((s, e) => s + e.score, 0) / totalEmpresas);
  const aptas = empresas.filter((e) => e.status === "ok").length;
  const totalAlertas = empresas.reduce((s, e) => s + e.alertas, 0);
  const oportunidades = 27;

  const empresaPrioridade = [...empresas].sort((a, b) => a.score - b.score)[0];
  const ranking = [...empresas].sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Greeting */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                Olá, João 👋
              </h1>
              <p className="mt-2 text-base text-muted-foreground">
                Você gerencia <strong className="text-foreground">{totalEmpresas} empresas</strong>. Aqui está a visão consolidada do seu portfólio.
              </p>
            </div>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/empresas">
                <Plus className="h-4 w-4" />
                Nova empresa
              </Link>
            </Button>
          </div>

          {/* Portfolio KPIs */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<Building2 className="h-4 w-4" />}
              label="Empresas"
              value={totalEmpresas.toString()}
              hint={`${aptas} aptas a licitar`}
              tone="primary"
            />
            <KpiCard
              icon={<Gauge className="h-4 w-4" />}
              label="Score médio"
              value={`${scoreMedio}`}
              hint="Prontidão do portfólio"
              tone={scoreMedio >= 80 ? "success" : scoreMedio >= 60 ? "warn" : "danger"}
            />
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Alertas ativos"
              value={totalAlertas.toString()}
              hint="Certidões + SICAF"
              tone={totalAlertas === 0 ? "success" : "warn"}
            />
            <KpiCard
              icon={<Gavel className="h-4 w-4" />}
              label="Oportunidades"
              value={oportunidades.toString()}
              hint="Compatíveis hoje (PNCP)"
              tone="primary"
            />
          </div>

          {/* Próximo passo — CTA mantido, agora apontando para empresa prioritária */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lift">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider opacity-80">Próximo passo</p>
                <h2 className="mt-1 text-2xl font-bold">Atualize seu SICAF agora</h2>
                <p className="mt-1 text-sm opacity-90">
                  Comece por <strong>{empresaPrioridade.nome}</strong> — score {empresaPrioridade.score}/100. Leva ~5 minutos.
                </p>
              </div>
              <Button asChild size="lg" variant="secondary" className="h-14 px-6 text-base font-semibold shadow-lg">
                <Link to="/empresas">
                  <Rocket className="mr-2 h-5 w-5" />
                  Atualizar SICAF
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Ranking de empresas */}
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-warning" />
                  Suas empresas
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Ranking por prontidão para licitar</p>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                <Link to="/prontidao">
                  Ver tudo <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {ranking.map((e, i) => (
                  <li key={e.id}>
                    <Link
                      to="/empresas"
                      className="group flex items-center gap-3 rounded-xl border border-transparent bg-muted/30 p-3 transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-sm",
                          i === 0 && "bg-warning/15 text-warning-foreground",
                          i === 1 && "bg-muted text-foreground",
                          i === 2 && "bg-muted text-foreground",
                          i > 2 && "bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {i + 1}º
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold truncate">{e.nome}</p>
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            <ShieldCheck className="h-3 w-3" />
                            {e.nivel}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground font-mono">{e.cnpj}</p>
                      </div>
                      <div className="hidden sm:block w-32">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Score</span>
                          <span className={cn(
                            "font-bold",
                            e.score >= 80 && "text-success",
                            e.score >= 60 && e.score < 80 && "text-warning",
                            e.score < 60 && "text-destructive",
                          )}>{e.score}</span>
                        </div>
                        <Progress value={e.score} className="mt-1 h-1.5" />
                      </div>
                      <StatusBadge status={e.status}>{e.statusLabel}</StatusBadge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Alertas consolidados do portfólio */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4 text-warning" />
                  Alertas do portfólio
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Próximos vencimentos em todas as suas empresas</p>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                <Link to="/certidoes">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {alertasGlobais.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      a.severidade === "danger" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground",
                    )}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.tipo}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.empresa} • {a.quando}</p>
                    </div>
                    <StatusBadge status={a.severidade}>
                      {a.severidade === "danger" ? "Urgente" : "Atenção"}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Diferenciais */}
          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureCard
              to="/prontidao"
              icon={<Gauge className="h-5 w-5" />}
              tag="Novo"
              title="Prontidão para Licitar"
              desc="Score 0–100 por CNPJ com ranking e plano de ação."
            />
            <FeatureCard
              to="/certidoes"
              icon={<Bell className="h-5 w-5" />}
              tag="Automático"
              title="Monitor de Certidões"
              desc="Alertas 30 / 15 / 5 dias por e-mail e WhatsApp."
            />
            <FeatureCard
              to="/licitacoes"
              icon={<Gavel className="h-5 w-5" />}
              tag="PNCP"
              title="Feed de Oportunidades"
              desc="Licitações compatíveis com seu perfil, em tempo real."
            />
          </div>

          {/* Atividade recente do portfólio */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Atividade recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <Atividade tone="success" texto="Construtora Horizonte teve SICAF renovado automaticamente" tempo="há 2h" />
                <Atividade tone="primary" texto="Nova oportunidade compatível com Tech Solutions Brasil" tempo="há 5h" />
                <Atividade tone="warn" texto="Comércio Atlântico ME: certidão estadual vence em 5 dias" tempo="ontem" />
                <Atividade tone="success" texto="Você adicionou Serviços Modelo EIRELI ao portfólio" tempo="3 dias" />
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Precisa de ajuda?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link to="/ajuda">
                  <Bot className="mr-2 h-4 w-4 text-primary" />
                  Assistente Virtual
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link to="/suporte">
                  <Headphones className="mr-2 h-4 w-4 text-primary" />
                  Abrir Chamado
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start">
                <PlayCircle className="mr-2 h-4 w-4 text-primary" />
                Ver Vídeo Explicativo
              </Button>
            </CardContent>
          </Card>

          <AssistantCard />
        </aside>

      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, hint, tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "success" | "warn" | "danger";
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            tone === "primary" && "bg-primary/10 text-primary",
            tone === "success" && "bg-success/15 text-success",
            tone === "warn" && "bg-warning/15 text-warning-foreground",
            tone === "danger" && "bg-destructive/15 text-destructive",
          )}>
            {icon}
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Atividade({ tone, texto, tempo }: { tone: "success" | "primary" | "warn"; texto: string; tempo: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn(
        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
        tone === "success" && "bg-success",
        tone === "primary" && "bg-primary",
        tone === "warn" && "bg-warning",
      )} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">{texto}</p>
        <p className="text-xs text-muted-foreground">{tempo}</p>
      </div>
    </li>
  );
}

function FeatureCard({
  to,
  icon,
  tag,
  title,
  desc,
}: {
  to: "/prontidao" | "/certidoes" | "/licitacoes";
  icon: ReactNode;
  tag: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {tag}
        </span>
      </div>
      <div>
        <p className="font-semibold leading-tight">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary opacity-80 group-hover:opacity-100">
        Abrir <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
