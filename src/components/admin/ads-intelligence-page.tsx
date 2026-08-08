import { Link } from "@tanstack/react-router";
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
  CalendarDays,
  CalendarRange,
  ArrowLeft,
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
  Legend,
} from "recharts";
import { toast } from "sonner";
import {
  fetchAdminGoogleAds,
  formatBRL,
  type AdsCanal,
  type GoogleAdsPalavra,
  type GoogleAdsClientePalavra,
  type GoogleAdsPeriodoSemana,
  type GoogleAdsPeriodoStats,
} from "@/lib/admin-google-ads-api";
import { GoogleAdsPagosModal } from "@/components/admin/google-ads-pagos-modal";

const PERIODOS_ADS = [
  { value: "0", label: "Hoje" },
  { value: "5", label: "Últimos 5 dias" },
  { value: "7", label: "Última semana" },
  { value: "15", label: "Últimos 15 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "-1", label: "Desde sempre" },
];

export function AdsIntelligencePage({ canal }: { canal: AdsCanal }) {
  const isBing = canal === "bing";
  const titulo = isBing ? "Bing Ads Intelligence" : "Google Ads Intelligence";
  const canalNome = isBing ? "Bing Ads" : "Google Ads";
  const periodos = PERIODOS_ADS;
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(isBing ? "7" : "30");
  const [kpis, setKpis] = useState<Awaited<ReturnType<typeof fetchAdminGoogleAds>>["kpis"]>();
  const [palavras, setPalavras] = useState<GoogleAdsPalavra[]>([]);
  const [periodoSemana, setPeriodoSemana] = useState<GoogleAdsPeriodoSemana | null>(null);
  const [notas, setNotas] = useState<string[]>([]);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [pagosOpen, setPagosOpen] = useState(false);
  const [palavraSel, setPalavraSel] = useState<GoogleAdsPalavra | null>(null);
  const [palavraPagosSel, setPalavraPagosSel] = useState<GoogleAdsPalavra | null>(null);
  const [clientes, setClientes] = useState<GoogleAdsClientePalavra[]>([]);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminGoogleAds({ days: parseInt(days, 10), canal });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || `Erro ao carregar ${canalNome}`);
      return;
    }
    setKpis(res.kpis);
    setPalavras(res.palavras || []);
    setPeriodoSemana(res.periodoSemana || null);
    setNotas(res.notas || []);
  }, [days, canal, canalNome]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const chartData = useMemo(
    () => [...palavras].sort((a, b) => b.fat - a.fat).slice(0, 8),
    [palavras],
  );
  const maxFat = Math.max(...chartData.map((p) => p.fat), 1);

  const chartDiaSemana = useMemo(
    () =>
      (periodoSemana?.porDia || []).map((d) => ({
        ...d,
        fill: d.tipo === "fim" ? "hsl(280 65% 55%)" : "hsl(210 80% 50%)",
      })),
    [periodoSemana],
  );

  const chartHora = useMemo(
    () =>
      (periodoSemana?.porHora || []).map((h) => ({
        ...h,
        label: `${String(h.hora).padStart(2, "0")}h`,
      })),
    [periodoSemana],
  );

  const abrirPagos = (p: GoogleAdsPalavra) => {
    if (p.pagos <= 0) return;
    setPalavraPagosSel(p);
    setPagosOpen(true);
  };

  const abrirDetalhe = async (p: GoogleAdsPalavra) => {
    setPalavraSel(p);
    setDetalheOpen(true);
    setLoadingDetalhe(true);
    const res = await fetchAdminGoogleAds({ days: parseInt(days, 10), palavra: p.palavra, canal });
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
          {isBing ? (
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 h-8 gap-1.5 text-muted-foreground" asChild>
              <Link to="/admin/google-ads">
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao Google Ads
              </Link>
            </Button>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{titulo}</h1>
          <p className="text-sm text-muted-foreground">
            Palavras que <strong>geram dinheiro</strong> — pagos validados no banco (taxas SICAF e Gerencianet)
            {isBing ? ", filtradas por msclkid / Bing." : "."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isBing ? (
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/bing-ads">Analisar Bing Ads</Link>
            </Button>
          ) : null}
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-9 w-52 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodos.map((p) => (
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
          Carregando métricas {canalNome}...
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

          {periodoSemana && periodoSemana.totalClicks > 0 && (
            <Card className="mt-5 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Onde rodar a campanha: semana × fim de semana</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Cliques, cadastros e clientes pagantes por dia do clique — use no agendamento de anúncios do{" "}
                    {canalNome}.
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Horário Brasil
                </Badge>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <PeriodoRecomendacaoCard
                  icon={CalendarDays}
                  titulo="Dias de semana (Seg–Sex)"
                  stats={periodoSemana.semana}
                  destaque={periodoSemana.recomendacao.melhorPeriodo === "semana"}
                  cor="sky"
                />
                <PeriodoRecomendacaoCard
                  icon={CalendarRange}
                  titulo="Fim de semana (Sáb–Dom)"
                  stats={periodoSemana.fimDeSemana}
                  destaque={periodoSemana.recomendacao.melhorPeriodo === "fim"}
                  cor="violet"
                />
              </div>

              <div className="mt-3 rounded-xl border border-dashed bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Veredito — onde é mais provável vir cliente
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {periodoSemana.recomendacao.veredito}
                </p>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Cliques por dia</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDiaSemana} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="dia"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: number, _n, item) => {
                            const tipo = (item?.payload as { tipo?: string })?.tipo;
                            return [
                              v.toLocaleString("pt-BR"),
                              tipo === "fim" ? "Fim de semana" : "Semana",
                            ];
                          }}
                        />
                        <Bar dataKey="clicks" radius={[6, 6, 0, 0]}>
                          {chartDiaSemana.map((d, i) => (
                            <Cell key={i} fill={d.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-sky-500" /> Semana
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-violet-500" /> Fim de semana
                    </span>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Cliques por hora (semana vs fim de semana)
                  </p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartHora} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          interval={2}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: number, name: string) => [
                            v.toLocaleString("pt-BR"),
                            name === "semana" ? "Semana" : "Fim de semana",
                          ]}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11 }}
                          formatter={(v) => (v === "semana" ? "Semana" : "Fim de semana")}
                        />
                        <Bar dataKey="semana" stackId="a" fill="hsl(210 80% 50%)" radius={[0, 0, 0, 0]} />
                        <Bar
                          dataKey="fimDeSemana"
                          stackId="a"
                          fill="hsl(280 65% 55%)"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Card>
          )}

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
                Nenhuma palavra-chave {canalNome} no período selecionado.
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
                          {p.pagos > 0 ? (
                            <button
                              type="button"
                              title={`Ver ${p.pagos} cliente(s) que pagaram`}
                              className="inline-flex rounded-full outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirPagos(p);
                              }}
                            >
                              <Badge variant="default" className="cursor-pointer text-[10px]">
                                {p.pagos}
                                {p.pagosValidados && (
                                  <CheckCircle2 className="ml-1 inline h-3 w-3" />
                                )}
                              </Badge>
                            </button>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              0
                            </Badge>
                          )}
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

      <GoogleAdsPagosModal
        open={pagosOpen}
        onOpenChange={setPagosOpen}
        palavra={palavraPagosSel}
        days={parseInt(days, 10)}
        canal={canal}
      />

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

function PeriodoRecomendacaoCard({
  icon: Icon,
  titulo,
  stats,
  destaque,
  cor,
}: {
  icon: typeof CalendarDays;
  titulo: string;
  stats: GoogleAdsPeriodoStats;
  destaque: boolean;
  cor: "sky" | "violet";
}) {
  const cores = {
    sky: { barra: "bg-sky-500", texto: "text-sky-600" },
    violet: { barra: "bg-violet-500", texto: "text-violet-600" },
  }[cor];

  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque
          ? "border-emerald-400/60 bg-emerald-50/60 dark:border-emerald-700/60 dark:bg-emerald-950/20"
          : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {titulo}
        </div>
        {stats.recomendado ? (
          <Badge className="shrink-0 gap-1 bg-emerald-600 text-[10px] hover:bg-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            {destaque ? "Melhor período" : "Rodar campanha"}
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Não prioritário
          </Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliques</p>
          <p className="text-lg font-bold">{stats.clicks.toLocaleString("pt-BR")}</p>
          <p className={`text-[10px] font-medium ${cores.texto}`}>{stats.pct}% do total</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cadastros</p>
          <p className="text-lg font-bold">{stats.cadastros.toLocaleString("pt-BR")}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagantes</p>
          <p className="text-lg font-bold text-emerald-600">{stats.pagos}</p>
          <p className="text-[10px] text-muted-foreground">
            {stats.taxaPagosPorClique}% por clique
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Receita</p>
          <p className="text-lg font-bold text-emerald-600">{stats.receitaFormatada}</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${cores.barra}`} style={{ width: `${stats.pct}%` }} />
      </div>
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
