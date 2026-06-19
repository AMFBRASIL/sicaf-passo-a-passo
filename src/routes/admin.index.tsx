import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  FileCheck2,
  AlertTriangle,
  Ticket,
  PhoneCall,
  Target,
  Receipt,
  ShieldAlert,
  ArrowUpRight,
  Activity,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  fetchAdminDashboard,
  formatBRL,
  formatDeltaPct,
  formatMediaMin,
  shortName,
  trendFromChange,
  type AdminDashboardExecutive,
} from "@/lib/admin-dashboard-api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: DashboardExecutivo,
});

type Tone = "emerald" | "blue" | "amber" | "rose" | "violet" | "sky";

const toneMap: Record<Tone, { bg: string; text: string; ring: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/20" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/20" },
  sky: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", ring: "ring-sky-500/20" },
};

const funilCores = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#10b981"];

interface KpiProps {
  title: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  hint?: string;
  spark?: number[];
  loading?: boolean;
}

function Kpi({ title, value, delta, trend = "flat", icon: Icon, tone, hint, spark, loading }: KpiProps) {
  const t = toneMap[tone];
  const TrendIcon = trend === "down" ? TrendingDown : TrendingUp;
  const trendColor =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";

  return (
    <Card className="group relative overflow-hidden p-4 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          {loading ? (
            <Loader2 className="mt-3 h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          )}
          {hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${t.bg} ${t.text} ${t.ring}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {delta && !loading ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {delta}
          </span>
        ) : (
          <span />
        )}
        {spark && spark.length > 0 && !loading && (
          <div className="h-7 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark.map((v, i) => ({ i, v }))}>
                <defs>
                  <linearGradient id={`sp-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  fill={`url(#sp-${title})`}
                  className={t.text}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}

function DashboardExecutivo() {
  const [loading, setLoading] = useState(true);
  const [exec, setExec] = useState<AdminDashboardExecutive | null>(null);
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminDashboard();
        if (!cancelled && data.executive) {
          setExec(data.executive);
          setTodayLabel(data.todayLabel || "");
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Erro ao carregar dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fat = exec?.faturamento;
  const novos = exec?.novosClientes;
  const sicaf = exec?.sicaf;
  const tickets = exec?.tickets;
  const chamadas = exec?.chamadasPendentes;
  const gads = exec?.googleAds;
  const boletos = exec?.boletosVencidos;
  const cert = exec?.certidoesVencidas;

  const faturamentoData = fat?.chart7d ?? [];
  const funilData = exec?.funil ?? [];
  const alertas = exec?.alertas ?? [];
  const palavras = exec?.palavras ?? [];
  const equipe = exec?.equipe ?? [];

  const fatSpark = faturamentoData.map((d) => d.v);
  const novosSpark = fatSpark.length ? fatSpark.map((_, i) => (novos?.hoje ?? 0) + i) : undefined;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <Badge variant="outline" className="rounded-sm text-[10px] tracking-wider">
              AO VIVO
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">Dashboard Executivo</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada da operação CADBRASIL — dados reais do banco
            {todayLabel ? ` · ${todayLabel}` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Perguntar à IA
          </Button>
          <Button size="sm" asChild>
            <Link to="/admin/clientes">
              Ver clientes <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi
          loading={loading}
          title="Faturamento Hoje"
          value={formatBRL(fat?.hoje ?? 0)}
          delta={fat ? formatDeltaPct(fat.changeHoje, "vs ontem") : undefined}
          trend={fat ? trendFromChange(fat.changeHoje) : "flat"}
          icon={DollarSign}
          tone="emerald"
          spark={fatSpark.length ? fatSpark : undefined}
        />
        <Kpi
          loading={loading}
          title="Faturamento Mês"
          value={formatBRL(fat?.mes ?? 0)}
          delta={fat ? formatDeltaPct(fat.changeMes, "vs mês ant.") : undefined}
          trend={fat ? trendFromChange(fat.changeMes) : "flat"}
          icon={TrendingUp}
          tone="emerald"
        />
        <Kpi
          loading={loading}
          title="Cadastros Hoje"
          value={String(novos?.hoje ?? 0)}
          delta={novos ? formatDeltaPct(novos.changeHoje, "vs ontem") : undefined}
          trend={novos ? trendFromChange(novos.changeHoje) : "flat"}
          icon={Users}
          tone="blue"
          hint={novos ? `${novos.mes} no mês · ${novos.pagos} pagaram · ${novos.pendentes} pendentes` : undefined}
          spark={novosSpark}
        />
        <Kpi
          loading={loading}
          title="SICAF Atualizados"
          value={String(sicaf?.atualizados ?? 0)}
          delta={sicaf ? `meta ${sicaf.meta}` : undefined}
          trend="flat"
          icon={FileCheck2}
          tone="emerald"
        />
        <Kpi
          loading={loading}
          title="SICAF Pendentes"
          value={String(sicaf?.pendentes ?? 0)}
          delta={sicaf?.vencendo7d ? `${sicaf.vencendo7d} vencendo 7d` : undefined}
          trend="down"
          icon={AlertTriangle}
          tone="amber"
          hint={sicaf ? `🟡 ${sicaf.amarelo}  🔴 ${sicaf.vermelho}` : undefined}
        />
        <Kpi
          loading={loading}
          title="Tickets Abertos"
          value={String(tickets?.abertos ?? 0)}
          delta={tickets?.foraSla ? `${tickets.foraSla} fora do SLA` : undefined}
          trend={tickets?.foraSla ? "down" : "flat"}
          icon={Ticket}
          tone="rose"
        />
        <Kpi
          loading={loading}
          title="Chamadas Pendentes"
          value={String(chamadas?.total ?? 0)}
          delta={
            chamadas
              ? `${chamadas.changeOntem >= 0 ? "+" : ""}${chamadas.changeOntem}% vs ontem`
              : undefined
          }
          trend={chamadas ? trendFromChange(-chamadas.changeOntem) : "flat"}
          icon={PhoneCall}
          tone="sky"
        />
        <Kpi
          loading={loading}
          title="Conversão Google Ads"
          value={gads?.sessions ? `${gads.conversao.toLocaleString("pt-BR")}%` : "—"}
          delta={gads?.converted ? `${gads.converted} conversões` : undefined}
          trend={gads?.conversao ? "up" : "flat"}
          icon={Target}
          tone="violet"
          hint={gads?.roas ? `ROAS ${gads.roas}x` : gads?.sessions ? `${gads.sessions} sessões` : undefined}
        />
        <Kpi
          loading={loading}
          title="Boletos Vencidos"
          value={formatBRL(boletos?.valor ?? 0)}
          delta={boletos?.clientes ? `${boletos.clientes} clientes` : undefined}
          trend="down"
          icon={Receipt}
          tone="amber"
        />
        <Kpi
          loading={loading}
          title="Certidões Vencidas"
          value={String(cert?.total ?? 0)}
          delta={cert?.changeSemana ? `+${cert.changeSemana} esta semana` : undefined}
          trend="down"
          icon={ShieldAlert}
          tone="rose"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Faturamento — últimos 7 dias</h3>
              <p className="text-xs text-muted-foreground">Manutenção + taxas SICAF pagas</p>
            </div>
            <Badge variant="secondary" className="rounded-sm">
              {loading ? "…" : formatBRL(fat?.total7d ?? 0)}
            </Badge>
          </div>
          <div className="h-64">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={faturamentoData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [formatBRL(v), "Faturamento"]}
                  />
                  <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#fat)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Funil Comercial</h3>
              <p className="text-xs text-muted-foreground">Onde você perde dinheiro</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
              <Link to="/admin/funil">
                Ver <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="h-64">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : funilData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados de funil</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funilData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="etapa"
                    type="category"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={88}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="v" radius={[0, 6, 6, 0]}>
                    {funilData.map((_, i) => (
                      <Cell key={i} fill={funilCores[i % funilCores.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Central de Alertas</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/admin/alertas">Todos</Link>
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alertas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum alerta crítico no momento</p>
          ) : (
            <ul className="space-y-2">
              {alertas.map((a, i) => {
                const t = toneMap[a.tom];
                return (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{a.tipo}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{a.cliente}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}>
                      {a.em}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Palavras que geram dinheiro</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/admin/google-ads">Google Ads</Link>
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : palavras.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem dados de campanhas ainda</p>
          ) : (
            <div className="space-y-3">
              {palavras.map((p, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{p.palavra}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(p.receita)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{p.clicks} cliques</span>
                    <span>·</span>
                    <span>{p.pagos} pagos</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500"
                      style={{ width: `${Math.min(100, p.clicks > 0 ? (p.pagos / p.clicks) * 600 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Equipe — Produtividade</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/admin/equipe">Ver</Link>
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : equipe.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum ticket atribuído no período</p>
          ) : (
            <div className="space-y-2">
              {equipe.map((e, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {e.nome
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{shortName(e.nome)}</p>
                      <p className="text-[10px] text-muted-foreground">média {formatMediaMin(e.mediaMin)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{e.tickets}</p>
                    <p className="text-[10px] text-muted-foreground">SLA {e.sla}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
