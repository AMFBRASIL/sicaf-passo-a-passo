import { createFileRoute, Link } from "@tanstack/react-router";
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

interface KpiProps {
  title: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon: any;
  tone: Tone;
  hint?: string;
  spark?: number[];
}

function Kpi({ title, value, delta, trend = "flat", icon: Icon, tone, hint, spark }: KpiProps) {
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
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${t.bg} ${t.text} ${t.ring}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {delta ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {delta}
          </span>
        ) : (
          <span />
        )}
        {spark && spark.length > 0 && (
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

const faturamentoData = [
  { d: "Seg", v: 12400 }, { d: "Ter", v: 9800 }, { d: "Qua", v: 15200 },
  { d: "Qui", v: 11900 }, { d: "Sex", v: 18400 }, { d: "Sáb", v: 7200 }, { d: "Hoje", v: 14800 },
];

const funilData = [
  { etapa: "Visitou site", v: 1280 },
  { etapa: "Cadastrou", v: 612 },
  { etapa: "Pagou", v: 287 },
  { etapa: "Enviou docs", v: 214 },
  { etapa: "SICAF OK", v: 168 },
  { etapa: "Manutenção", v: 142 },
  { etapa: "Renovou", v: 96 },
];

const funilCores = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#10b981"];

const alertas = [
  { tipo: "Certidão vencendo", cliente: "JR Construtora EIRELI", em: "3 dias", tom: "rose" as Tone },
  { tipo: "Boleto vencido", cliente: "Nova Filial Brasília LTDA", em: "5 dias", tom: "amber" as Tone },
  { tipo: "Ticket sem resposta", cliente: "Construtora Aurora", em: "SLA 2h", tom: "rose" as Tone },
  { tipo: "SICAF Pendente Nível IV", cliente: "Engemax Serviços", em: "Hoje", tom: "amber" as Tone },
  { tipo: "Risco de cancelamento", cliente: "Pavimar Obras", em: "Score 82%", tom: "violet" as Tone },
];

const palavras = [
  { palavra: "como tirar sicaf", clicks: 412, pagos: 38, receita: "R$ 11.400" },
  { palavra: "cadastro sicaf brasilia", clicks: 287, pagos: 31, receita: "R$ 9.300" },
  { palavra: "licitação mei", clicks: 198, pagos: 18, receita: "R$ 5.400" },
  { palavra: "renovar sicaf vencido", clicks: 154, pagos: 22, receita: "R$ 6.600" },
];

const equipe = [
  { nome: "Anderson L.", tickets: 47, sla: "98%", media: "12min" },
  { nome: "Maria S.", tickets: 39, sla: "95%", media: "18min" },
  { nome: "João P.", tickets: 31, sla: "92%", media: "22min" },
  { nome: "Carla R.", tickets: 24, sla: "89%", media: "28min" },
];

function DashboardExecutivo() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <Badge variant="outline" className="rounded-sm text-[10px] tracking-wider">
              AO VIVO
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">
            Dashboard Executivo
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada da operação CADBRASIL — atualizado agora.
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

      {/* 10 KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi title="Faturamento Hoje" value="R$ 14.820" delta="+12,4% vs ontem" trend="up" icon={DollarSign} tone="emerald" spark={[8,9,7,11,10,12,14]} />
        <Kpi title="Faturamento Mês" value="R$ 287.450" delta="+8,1% vs mês ant." trend="up" icon={TrendingUp} tone="emerald" spark={[140,160,180,210,240,260,287]} />
        <Kpi title="Novos Clientes" value="34" delta="+6 hoje" trend="up" icon={Users} tone="blue" hint="14 pagaram • 20 pendentes" spark={[2,4,3,5,6,4,7]} />
        <Kpi title="SICAF Atualizados" value="128" delta="meta 150" trend="flat" icon={FileCheck2} tone="emerald" spark={[10,12,14,11,16,18,20]} />
        <Kpi title="SICAF Pendentes" value="42" delta="9 vencendo 7d" trend="down" icon={AlertTriangle} tone="amber" hint="🟡 17  🔴 25" spark={[20,25,30,28,35,38,42]} />
        <Kpi title="Tickets Abertos" value="23" delta="4 fora do SLA" trend="down" icon={Ticket} tone="rose" spark={[18,22,19,24,21,25,23]} />
        <Kpi title="Chamadas Pendentes" value="11" delta="-3 vs ontem" trend="up" icon={PhoneCall} tone="sky" spark={[15,14,16,12,10,13,11]} />
        <Kpi title="Conversão Google Ads" value="6,8%" delta="+0,9 p.p." trend="up" icon={Target} tone="violet" hint="ROAS 4,2x" spark={[4,5,5.5,6,6.2,6.5,6.8]} />
        <Kpi title="Boletos Vencidos" value="R$ 18.430" delta="14 clientes" trend="down" icon={Receipt} tone="amber" spark={[10,12,11,14,16,17,18]} />
        <Kpi title="Certidões Vencidas" value="27" delta="+5 esta semana" trend="down" icon={ShieldAlert} tone="rose" spark={[15,18,20,22,24,26,27]} />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Faturamento — últimos 7 dias</h3>
              <p className="text-xs text-muted-foreground">PIX, Cartão e Boleto consolidados</p>
            </div>
            <Badge variant="secondary" className="rounded-sm">R$ 89.700</Badge>
          </div>
          <div className="h-64">
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
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [`R$ ${v.toLocaleString("pt-BR")}`, "Faturamento"]}
                />
                <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#fat)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Funil Comercial</h3>
              <p className="text-xs text-muted-foreground">Onde você perde dinheiro</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
              <Link to="/admin/funil">Ver <ArrowUpRight className="h-3 w-3" /></Link>
            </Button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funilData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="etapa" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={88} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="v" radius={[0, 6, 6, 0]}>
                  {funilData.map((_, i) => (
                    <Cell key={i} fill={funilCores[i % funilCores.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Lower row: alertas, palavras, equipe */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Central de Alertas</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/admin/alertas">Todos</Link>
            </Button>
          </div>
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
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Palavras que geram dinheiro</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/admin/google-ads">Google Ads</Link>
            </Button>
          </div>
          <div className="space-y-3">
            {palavras.map((p, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate">{p.palavra}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{p.receita}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{p.clicks} cliques</span>
                  <span>·</span>
                  <span>{p.pagos} pagos</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500"
                    style={{ width: `${Math.min(100, (p.pagos / p.clicks) * 600)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Equipe — Produtividade</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link to="/admin/equipe">Ver</Link>
            </Button>
          </div>
          <div className="space-y-2">
            {equipe.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {e.nome.split(" ").map((s) => s[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{e.nome}</p>
                    <p className="text-[10px] text-muted-foreground">média {e.media}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{e.tickets}</p>
                  <p className="text-[10px] text-muted-foreground">SLA {e.sla}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
