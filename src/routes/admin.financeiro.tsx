import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Loader2,
  RefreshCw,
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
import { toast } from "sonner";
import {
  fetchAdminFinanceiro,
  fetchPagamentosPendentes,
  formatBRL,
  formatDeltaPct,
  type FinanceiroMovimento,
  type FinanceiroMeio,
  type PagamentoPendente,
} from "@/lib/admin-financeiro-api";
import { validarPagamentoAdmin } from "@/lib/admin-clientes-api";

export const Route = createFileRoute("/admin/financeiro")({
  component: FinanceiroPage,
});

const statusCls: Record<string, string> = {
  Recebido: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Aguardando: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Vencido: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  Estornado: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const MEIO_FILTROS = ["Todos", "PIX", "Cartão", "Boleto", "Estornado"] as const;
type MeioFiltro = (typeof MEIO_FILTROS)[number];

function FinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Awaited<ReturnType<typeof fetchAdminFinanceiro>>["kpis"]>();
  const [serie, setSerie] = useState<{ d: string; v: number }[]>([]);
  const [meios, setMeios] = useState<FinanceiroMeio[]>([]);
  const [movimentos, setMovimentos] = useState<FinanceiroMovimento[]>([]);
  const [filtroMeio, setFiltroMeio] = useState<MeioFiltro>("Todos");
  const [conciliacaoOpen, setConciliacaoOpen] = useState(false);
  const [pendentes, setPendentes] = useState<PagamentoPendente[]>([]);
  const [loadingPendentes, setLoadingPendentes] = useState(false);
  const [validandoId, setValidandoId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminFinanceiro();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar painel financeiro");
      return;
    }
    setKpis(res.kpis);
    setSerie(res.serieMes || []);
    setMeios(res.meios || []);
    setMovimentos(res.movimentos || []);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarPendentes = useCallback(async () => {
    setLoadingPendentes(true);
    const res = await fetchPagamentosPendentes();
    setLoadingPendentes(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar pendências");
      return;
    }
    setPendentes(res.pagamentos || []);
  }, []);

  useEffect(() => {
    if (conciliacaoOpen) void carregarPendentes();
  }, [conciliacaoOpen, carregarPendentes]);

  const movimentosFiltrados = useMemo(() => {
    if (filtroMeio === "Todos") return movimentos;
    if (filtroMeio === "Estornado") return movimentos.filter((m) => m.status === "Estornado");
    return movimentos.filter((m) => m.meio === filtroMeio);
  }, [movimentos, filtroMeio]);

  const validarPendente = async (id: number) => {
    setValidandoId(id);
    const res = await validarPagamentoAdmin(id);
    setValidandoId(null);
    if (!res.ok) {
      toast.error(res.error || "Falha ao validar pagamento");
      return;
    }
    toast.success(res.message || "Pagamento validado");
    void carregarPendentes();
    void carregar();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Recebimentos, inadimplência, renovações e cancelamentos — dados reais do banco.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConciliacaoOpen(true)}>
            <ArrowDownToLine className="h-3.5 w-3.5" /> Conciliação
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={loading} onClick={() => void carregar()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          icon={Banknote}
          label="Recebimentos Hoje"
          value={loading ? "—" : formatBRL(kpis?.recebimentosHoje ?? 0)}
          delta={loading ? "Carregando…" : formatDeltaPct(kpis?.changeHoje ?? 0)}
          up={(kpis?.changeHoje ?? 0) >= 0}
          tone="emerald"
        />
        <Stat
          icon={TrendingUp}
          label="Recebimentos Mês"
          value={loading ? "—" : formatBRL(kpis?.recebimentosMes ?? 0)}
          delta={loading ? "" : formatDeltaPct(kpis?.changeMes ?? 0, "vs. mês anterior")}
          up={(kpis?.changeMes ?? 0) >= 0}
          tone="emerald"
        />
        <Stat
          icon={AlertTriangle}
          label="Inadimplentes"
          value={loading ? "—" : String(kpis?.inadimplentes ?? 0)}
          delta={loading ? "" : formatBRL(kpis?.inadimplenciaValor ?? 0)}
          tone="rose"
        />
        <Stat
          icon={RotateCcw}
          label="Renovações (30d)"
          value={loading ? "—" : String(kpis?.renovacoes30d ?? 0)}
          delta={
            loading
              ? ""
              : `${(kpis?.renovacoesDelta ?? 0) >= 0 ? "+" : ""}${kpis?.renovacoesDelta ?? 0} vs. período ant.`
          }
          up={(kpis?.renovacoesDelta ?? 0) >= 0}
          tone="violet"
        />
        <Stat
          icon={TrendingDown}
          label="Cancelamentos"
          value={loading ? "—" : String(kpis?.cancelamentos30d ?? 0)}
          delta={
            loading
              ? ""
              : `${(kpis?.cancelamentosDelta ?? 0) >= 0 ? "+" : ""}${kpis?.cancelamentosDelta ?? 0} vs. período ant.`
          }
          up={(kpis?.cancelamentosDelta ?? 0) <= 0}
          tone="rose"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Recebimentos no mês</h3>
          <p className="text-xs text-muted-foreground">Diário — pagamentos confirmados (SICAF, manutenção e PIX/boleto)</p>
          <div className="mt-4 h-64">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando gráfico…
              </div>
            ) : serie.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum recebimento registrado neste mês.
              </div>
            ) : (
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
                    formatter={(v: number | string) => [formatBRL(Number(v)), "Valor"]}
                  />
                  <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} fill="url(#fin)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold">Mix por meio</h3>
          <p className="text-xs text-muted-foreground">Últimos 30 dias (pagamentos confirmados)</p>
          <div className="mt-2 h-64">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              </div>
            ) : meios.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem dados de meio de pagamento.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={meios} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {meios.map((m) => (
                      <Cell key={m.name} fill={m.color} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number | string, _n, item) => {
                      const payload = item?.payload as FinanceiroMeio | undefined;
                      return [`${v}% · ${formatBRL(payload?.valor ?? 0)}`, payload?.name || "Meio"];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Movimentos recentes</h3>
          <div className="flex flex-wrap gap-1">
            {MEIO_FILTROS.map((label) => (
              <Pill
                key={label}
                icon={label === "PIX" ? QrCode : label === "Cartão" ? CreditCard : label === "Boleto" ? Banknote : RotateCcw}
                label={label}
                active={filtroMeio === label}
                onClick={() => setFiltroMeio(label)}
              />
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando movimentos…
            </div>
          ) : movimentosFiltrados.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhum movimento encontrado.</p>
          ) : (
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
                {movimentosFiltrados.map((m) => (
                  <tr key={m.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-3 font-medium">{m.cliente}</td>
                    <td className="px-3 py-3 text-muted-foreground">{m.meio}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatBRL(m.valor)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusCls[m.status] || statusCls.Aguardando}`}>
                        {m.status === "Recebido" && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                        {m.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{m.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Sheet open={conciliacaoOpen} onOpenChange={setConciliacaoOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Conciliação — pagamentos pendentes</SheetTitle>
            <SheetDescription>
              Cobranças aguardando confirmação. Valide manualmente quando o pagamento for identificado.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {loadingPendentes && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            )}
            {!loadingPendentes && pendentes.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhum pagamento pendente.</p>
            )}
            {!loadingPendentes &&
              pendentes.map((p) => (
                <div key={p.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.company}</p>
                      <p className="text-xs text-muted-foreground">{p.type}</p>
                      <p className="mt-1 text-sm font-mono">{formatBRL(p.amountNumber)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.method} · Vence {p.dueDate || "—"}
                      </p>
                    </div>
                    <Badge variant="outline">{p.status}</Badge>
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    disabled={validandoId === p.id}
                    onClick={() => void validarPendente(p.id)}
                  >
                    {validandoId === p.id ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    )}
                    Validar pagamento
                  </Button>
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  delta,
  up,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: string;
  up?: boolean;
  tone: "emerald" | "rose" | "violet";
}) {
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
      {delta ? (
        <p className={`mt-2 text-xs ${up ? "text-emerald-600" : "text-rose-600"}`}>{delta}</p>
      ) : null}
    </Card>
  );
}

function Pill({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-accent"
      }`}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
