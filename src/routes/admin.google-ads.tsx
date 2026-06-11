import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TrendingUp,
  DollarSign,
  MousePointerClick,
  UserPlus,
  Target,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { toast } from "sonner";
import {
  fetchAdminGoogleAds,
  formatBRL,
  type GoogleAdsPalavra,
  type GoogleAdsClientePalavra,
} from "@/lib/admin-google-ads-api";

export const Route = createFileRoute("/admin/google-ads")({
  component: GoogleAdsPage,
});

const PERIODOS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
];

function GoogleAdsPage() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [kpis, setKpis] = useState<Awaited<ReturnType<typeof fetchAdminGoogleAds>>["kpis"]>();
  const [palavras, setPalavras] = useState<GoogleAdsPalavra[]>([]);
  const [notas, setNotas] = useState<string[]>([]);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [palavraSel, setPalavraSel] = useState<GoogleAdsPalavra | null>(null);
  const [clientes, setClientes] = useState<GoogleAdsClientePalavra[]>([]);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminGoogleAds({ days: parseInt(days, 10) });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar Google Ads");
      return;
    }
    setKpis(res.kpis);
    setPalavras(res.palavras || []);
    setNotas(res.notas || []);
  }, [days]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const chartData = useMemo(
    () => [...palavras].sort((a, b) => b.fat - a.fat).slice(0, 8),
    [palavras],
  );
  const maxFat = Math.max(...chartData.map((p) => p.fat), 1);

  const abrirDetalhe = async (p: GoogleAdsPalavra) => {
    setPalavraSel(p);
    setDetalheOpen(true);
    setLoadingDetalhe(true);
    const res = await fetchAdminGoogleAds({ days: parseInt(days, 10), palavra: p.palavra });
    setLoadingDetalhe(false);
    if (!res.ok) {
      toast.error(res.error || "Erro ao carregar clientes da palavra");
      setClientes([]);
      return;
    }
    setClientes(res.clientesPorPalavra || []);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Google Ads Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Palavras que <strong>geram dinheiro</strong> — pagos validados no banco (taxas SICAF e Gerencianet).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando métricas Google Ads...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat
              icon={DollarSign}
              label="Investimento"
              value={kpis?.investimento ? formatBRL(kpis.investimento) : "—"}
            />
            <Stat icon={MousePointerClick} label="Cliques" value={String(kpis?.clicks ?? 0)} />
            <Stat icon={UserPlus} label="Cadastros" value={String(kpis?.cadastros ?? 0)} />
            <Stat
              icon={TrendingUp}
              label="Receita validada"
              value={kpis?.receitaFormatada || formatBRL(0)}
              tone="emerald"
            />
            <Stat
              icon={Target}
              label="ROAS médio"
              value={kpis?.roasMedio != null ? `${kpis.roasMedio}x` : "—"}
              tone="violet"
              sub={`${kpis?.pagos ?? 0} clientes pagaram`}
            />
          </div>

          {chartData.length > 0 && (
            <Card className="mt-5 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Top palavras por receita validada</h3>
                <Badge variant="secondary" className="text-[10px]">
                  Pagos confirmados no BD
                </Badge>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="palavra"
                      type="category"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      width={150}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [formatBRL(v), "Receita validada"]}
                    />
                    <Bar dataKey="fat" radius={[0, 6, 6, 0]}>
                      {chartData.map((p, i) => (
                        <Cell
                          key={i}
                          fill={`hsl(${160 + (p.fat / maxFat) * 60} 70% ${50 - i * 3}%)`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="mt-5 p-5">
            <h3 className="mb-3 text-sm font-semibold">Tabela completa</h3>
            {palavras.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma palavra-chave Google Ads no período selecionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Palavra-chave</th>
                      <th className="px-3 py-2 font-medium text-right">Cliques</th>
                      <th className="px-3 py-2 font-medium text-right">Cadastros</th>
                      <th className="px-3 py-2 font-medium text-right">Pagos ✓</th>
                      <th className="px-3 py-2 font-medium text-right">Receita</th>
                      <th className="px-3 py-2 font-medium text-right">ROAS</th>
                      <th className="px-3 py-2 font-medium text-right">CPA</th>
                      <th className="px-3 py-2 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {palavras.map((p) => (
                      <tr
                        key={p.palavra}
                        className="border-b border-border/40 hover:bg-muted/30"
                      >
                        <td className="px-3 py-3 font-medium">{p.palavra}</td>
                        <td className="px-3 py-3 text-right">{p.clicks}</td>
                        <td className="px-3 py-3 text-right">{p.cadastros}</td>
                        <td className="px-3 py-3 text-right">
                          <Badge
                            variant={p.pagos > 0 ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {p.pagos}
                            {p.pagosValidados && (
                              <CheckCircle2 className="ml-1 inline h-3 w-3" />
                            )}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-emerald-600">
                          {p.receitaFormatada}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {p.roas != null ? (
                            <Badge
                              variant={p.roas >= 4 ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {p.roas.toFixed(1)}x
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {p.cpa != null ? formatBRL(p.cpa) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => void abrirDetalhe(p)}
                          >
                            <Users className="mr-1 h-3 w-3" />
                            Clientes
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {notas.length > 0 && (
            <Card className="mt-5 border-dashed p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Metodologia
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {notas.map((n, i) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <Sheet open={detalheOpen} onOpenChange={setDetalheOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Clientes — {palavraSel?.palavra}</SheetTitle>
            <SheetDescription>
              Sessões com esta palavra-chave e status de pagamento real no período.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {loadingDetalhe ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando clientes...
              </div>
            ) : clientes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum cliente vinculado a esta palavra no período.
              </p>
            ) : (
              clientes.map((c) => (
                <div
                  key={c.clienteId}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.documento || "—"} · {c.sessoes} sessão(ões)
                    </p>
                  </div>
                  <Badge variant={c.comprou ? "default" : "secondary"} className="shrink-0 text-[10px]">
                    {c.comprou ? "Comprou ✓" : "Não pagou"}
                  </Badge>
                </div>
              ))
            )}
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
  tone = "default",
  sub,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  tone?: "default" | "emerald" | "violet";
  sub?: string;
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600",
    violet: "text-violet-600",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className={`mt-2 text-xl font-bold ${tones[tone]}`}>{value}</p>
          {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </Card>
  );
}
