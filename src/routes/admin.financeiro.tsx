import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownToLine,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  QrCode,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/admin/financeiro")({
  component: FinanceiroPage,
});

const serie = [
  { d: "01", v: 4200 }, { d: "05", v: 6100 }, { d: "10", v: 5800 }, { d: "15", v: 8200 },
  { d: "20", v: 9400 }, { d: "25", v: 11200 }, { d: "Hoje", v: 14820 },
];

const meios = [
  { name: "PIX", value: 58, color: "#10b981" },
  { name: "Cartão", value: 27, color: "#6366f1" },
  { name: "Boleto", value: 15, color: "#f59e0b" },
];

const movimentos = [
  { cli: "Solar Brasil Energia", tipo: "PIX", valor: 2100, status: "Recebido", data: "Hoje 16:40" },
  { cli: "Construtora Aurora", tipo: "Cartão", valor: 1490, status: "Recebido", data: "Hoje 11:05" },
  { cli: "JR Construtora EIRELI", tipo: "Boleto", valor: 890, status: "Aguardando", data: "Vence 08/06" },
  { cli: "Nova Filial Brasília", tipo: "PIX", valor: 590, status: "Estornado", data: "Ontem" },
  { cli: "Engemax Serviços", tipo: "Cartão", valor: 1290, status: "Recebido", data: "Hoje 09:21" },
  { cli: "MEI José Roberto", tipo: "Boleto", valor: 290, status: "Vencido", data: "Vencia 02/06" },
];

const statusCls: Record<string, string> = {
  Recebido: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Aguardando: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Vencido: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  Estornado: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

function FinanceiroPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Recebimentos, inadimplência, renovações e cancelamentos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowDownToLine className="h-3.5 w-3.5" /> Conciliação
          </Button>
          <Button size="sm">Lançar manual</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={Banknote} label="Recebimentos Hoje" value="R$ 14.820" delta="+12,4%" up tone="emerald" />
        <Stat icon={TrendingUp} label="Recebimentos Mês" value="R$ 287.450" delta="+8,1%" up tone="emerald" />
        <Stat icon={AlertTriangle} label="Inadimplentes" value="14" delta="R$ 18.430" tone="rose" />
        <Stat icon={RotateCcw} label="Renovações (30d)" value="76" delta="+9 vs mês ant." up tone="violet" />
        <Stat icon={TrendingDown} label="Cancelamentos" value="6" delta="-2 vs mês ant." up tone="rose" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Recebimentos no mês</h3>
          <p className="text-xs text-muted-foreground">Diário, consolidado por meio de pagamento</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [`R$ ${v.toLocaleString("pt-BR")}`, "Valor"]}
                />
                <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} fill="url(#fin)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold">Mix por meio</h3>
          <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={meios} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {meios.map((m) => <Cell key={m.name} fill={m.color} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => `${v}%`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Movimentos recentes</h3>
          <div className="flex gap-1">
            <Pill icon={QrCode} label="PIX" />
            <Pill icon={CreditCard} label="Cartão" />
            <Pill icon={Banknote} label="Boleto" />
            <Pill icon={RotateCcw} label="Estornos / MED" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Meio</th>
                <th className="px-3 py-2 font-medium text-right">Valor</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-3 font-medium">{m.cli}</td>
                  <td className="px-3 py-3 text-muted-foreground">{m.tipo}</td>
                  <td className="px-3 py-3 text-right font-mono">R$ {m.valor.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusCls[m.status]}`}>
                      {m.status === "Recebido" && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                      {m.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{m.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, delta, up, tone }: any) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
    violet: "bg-violet-500/10 text-violet-600",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-bold">{value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`mt-2 text-xs ${up ? "text-emerald-600" : "text-rose-600"}`}>{delta}</p>
    </Card>
  );
}

function Pill({ icon: Icon, label }: any) {
  return (
    <button className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent">
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
