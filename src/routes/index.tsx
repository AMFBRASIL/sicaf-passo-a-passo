import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/page-header";
import { AssistantCard } from "@/components/assistant-card";
import { CentralTarefas } from "@/components/central-tarefas";
import { AgendamentosCard } from "@/components/agendamento-revisao";
import { CopyButton } from "@/components/copy-button";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEmpresas } from "@/lib/empresas-api";
import { fetchProntidao } from "@/lib/prontidao-api";
import { fetchLicitacoesKpis } from "@/lib/licitacoes-api";
import { isEmpresaApto } from "@/lib/empresas-shared";
import type { EmpresaData } from "@/lib/empresas-shared";
import type { EmpresaProntidao } from "@/lib/prontidao-api";
import {
  buildAlertasPortfolio,
  buildAssistantAlerts,
  buildAtividadesRecentes,
  buildEmpresasResumo,
  buildTarefas,
  firstName,
} from "@/lib/home-portfolio";
import {
  ProcessoClienteModal,
  useProcessoModalAutoOpen,
} from "@/components/processo-cliente-modal";
import { buildProcessoClienteEtapas } from "@/lib/processo-cliente-etapas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  Loader2,
  Map,
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

function HomePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [empresasRaw, setEmpresasRaw] = useState<EmpresaData[]>([]);
  const [prontidaoList, setProntidaoList] = useState<EmpresaProntidao[]>([]);
  const [scoreMedio, setScoreMedio] = useState(0);
  const [oportunidades, setOportunidades] = useState(0);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [empRes, prontRes, licRes] = await Promise.all([
          fetchEmpresas(),
          fetchProntidao(),
          fetchLicitacoesKpis().catch(() => ({ ok: false as const })),
        ]);

        if (!empRes.ok) {
          toast.error(empRes.error || "Erro ao carregar empresas");
        } else {
          setEmpresasRaw(empRes.empresas || []);
        }

        if (prontRes.ok) {
          setProntidaoList(prontRes.empresas || []);
          setScoreMedio(prontRes.resumo?.media ?? 0);
        }

        if (licRes.ok && licRes.kpis) {
          setOportunidades(licRes.kpis.na_mira ?? licRes.kpis.abertas_hoje ?? 0);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const empresas = useMemo(
    () => buildEmpresasResumo(empresasRaw, prontidaoList),
    [empresasRaw, prontidaoList],
  );

  const tarefas = useMemo(() => buildTarefas(empresasRaw, prontidaoList), [empresasRaw, prontidaoList]);
  const alertasGlobais = useMemo(() => buildAlertasPortfolio(empresasRaw, prontidaoList), [empresasRaw, prontidaoList]);
  const assistantAlerts = useMemo(() => buildAssistantAlerts(empresasRaw), [empresasRaw]);
  const atividades = useMemo(() => buildAtividadesRecentes(empresasRaw), [empresasRaw]);

  const totalEmpresas = empresas.length;
  const aptas = empresasRaw.filter((e) => isEmpresaApto(e)).length;
  const totalAlertas = empresas.reduce((s, e) => s + e.alertas, 0);
  const ranking = [...empresas].sort((a, b) => b.score - a.score);
  const empresaPrioridade = [...empresas].sort((a, b) => a.score - b.score)[0];
  const empresaPrioridadeRaw = empresaPrioridade
    ? empresasRaw.find((e) => e.cnpj.replace(/\D/g, "") === empresaPrioridade.cnpj.replace(/\D/g, ""))
    : empresasRaw[0];
  const processoPrioridade = empresaPrioridadeRaw
    ? buildProcessoClienteEtapas(empresaPrioridadeRaw)
    : null;
  const { open: processoModalOpen, setOpen: setProcessoModalOpen } = useProcessoModalAutoOpen(
    empresasRaw,
    loading,
  );
  const [processoModalManual, setProcessoModalManual] = useState(false);
  const processoModalVisivel = processoModalOpen || processoModalManual;
  const nomeUsuario = firstName(user?.nome);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Carregando seu portfólio...</p>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 sm:py-10">
      {empresasRaw.length > 0 && (
        <ProcessoClienteModal
          open={processoModalVisivel}
          onOpenChange={(v) => {
            setProcessoModalOpen(v);
            setProcessoModalManual(v);
          }}
          empresas={empresasRaw}
          empresaInicial={empresaPrioridadeRaw}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                Olá, {nomeUsuario} 👋
              </h1>
              <p className="mt-2 text-base text-muted-foreground">
                {totalEmpresas === 0 ? (
                  <>Você ainda não cadastrou empresas. Comece adicionando a primeira ao portfólio.</>
                ) : (
                  <>
                    Você gerencia <strong className="text-foreground">{totalEmpresas} empresas</strong>.
                    Aqui está a visão consolidada do seu portfólio.
                  </>
                )}
              </p>
            </div>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/empresas">
                <Plus className="h-4 w-4" />
                Nova empresa
              </Link>
            </Button>
          </div>

          {empresasRaw.length > 0 && processoPrioridade && (
            <Card
              className="cursor-pointer overflow-hidden border-primary/25 shadow-soft transition hover:border-primary/40 hover:shadow-lift"
              onClick={() => setProcessoModalManual(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setProcessoModalManual(true);
                }
              }}
            >
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
                    <Map className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Jornada do processo
                    </p>
                    <h2 className="mt-1 text-lg font-bold tracking-tight">
                      {processoPrioridade.processoConcluido
                        ? "Seu processo está completo"
                        : `${processoPrioridade.concluidas} de ${processoPrioridade.total} etapas concluídas`}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ativação SICAF, Habilitação Jurídica e Licitações Federais — veja o status de cada etapa.
                    </p>
                    <div className="mt-3 max-w-md">
                      <Progress value={processoPrioridade.percentual} className="h-2" />
                    </div>
                  </div>
                </div>
                <Button
                  className="shrink-0 gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProcessoModalManual(true);
                  }}
                >
                  Ver etapas
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<Building2 className="h-4 w-4" />}
              label="Empresas"
              value={totalEmpresas.toString()}
              hint={totalEmpresas === 0 ? "Cadastre a primeira" : `${aptas} aptas a licitar`}
              tone="primary"
            />
            <KpiCard
              icon={<Gauge className="h-4 w-4" />}
              label="Score médio"
              value={totalEmpresas === 0 ? "—" : `${scoreMedio}`}
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
              hint="Salvas na mira"
              tone="primary"
            />
          </div>

          {empresaPrioridade && (
            <Card className="border-primary/30 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lift">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-80">Próximo passo</p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {empresaPrioridade.score < 50 ? "Regularize seu SICAF" : "Atualize seu SICAF"}
                  </h2>
                  <p className="mt-1 text-sm opacity-90">
                    Comece por <strong>{empresaPrioridade.nome}</strong> — score {empresaPrioridade.score}/100.
                  </p>
                </div>
                <Button asChild size="lg" variant="secondary" className="h-14 px-6 text-base font-semibold shadow-lg">
                  <Link to="/sicaf" search={{ cnpj: empresaPrioridade.cnpj }}>
                    <Rocket className="mr-2 h-5 w-5" />
                    Atualizar SICAF
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <CentralTarefas tarefas={tarefas} />

          {empresas.length > 0 && (
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
                          <div className="mt-0.5 flex items-center gap-1">
                            <p className="truncate text-xs text-muted-foreground font-mono">{e.cnpj}</p>
                            <CopyButton value={e.cnpj} label="CNPJ" />
                          </div>
                        </div>
                        <div className="hidden sm:block w-32">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Score</span>
                            <span
                              className={cn(
                                "font-bold",
                                e.score >= 80 && "text-success",
                                e.score >= 60 && e.score < 80 && "text-warning",
                                e.score < 60 && "text-destructive",
                              )}
                            >
                              {e.score}
                            </span>
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
          )}

          {alertasGlobais.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-warning" />
                    Alertas do portfólio
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pendências nas suas empresas</p>
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
                    <li key={`${a.cnpj}-${i}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          a.severidade === "danger"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-warning/15 text-warning-foreground",
                        )}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{a.tipo}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.empresa} • {a.quando}
                        </p>
                      </div>
                      <StatusBadge status={a.severidade}>
                        {a.severidade === "danger" ? "Urgente" : "Atenção"}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

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

          {atividades.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Situação do portfólio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {atividades.map((a, i) => (
                    <Atividade key={i} tone={a.tone} texto={a.texto} tempo={a.tempo} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

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
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link to="/ajuda">
                  <PlayCircle className="mr-2 h-4 w-4 text-primary" />
                  Ver Vídeo Explicativo
                </Link>
              </Button>
            </CardContent>
          </Card>

          <AgendamentosCard />
          <AssistantCard alerts={assistantAlerts} />
        </aside>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
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
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              tone === "primary" && "bg-primary/10 text-primary",
              tone === "success" && "bg-success/15 text-success",
              tone === "warn" && "bg-warning/15 text-warning-foreground",
              tone === "danger" && "bg-destructive/15 text-destructive",
            )}
          >
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
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          tone === "success" && "bg-success",
          tone === "primary" && "bg-primary",
          tone === "warn" && "bg-warning",
        )}
      />
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
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
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
