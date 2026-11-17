import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Copy,
  Eye,
  FileDown,
  Gavel,
  Globe2,
  KeyRound,
  Loader2,
  MapPin,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Target,
  Ticket,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requirePortalAuth } from "@/lib/require-portal-auth";
import {
  fetchClienteRelatorio,
  type ClienteRelatorio,
  type RelatorioMiraItem,
} from "@/lib/relatorio-api";
import { exportClienteRelatorioPdf } from "@/lib/relatorio-pdf";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/relatorio")({
  beforeLoad: async () => {
    await requirePortalAuth("/relatorio");
  },
  head: () => ({
    meta: [
      { title: "Relatório de uso — CADBRASIL" },
      {
        name: "description",
        content: "Indicadores de uso, licença, acessos e licitações na mira.",
      },
    ],
  }),
  component: RelatorioPage,
});

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return formatDateTime(value);
}

function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "slate" | "emerald" | "sky" | "amber" | "rose";
}) {
  const tones = {
    slate: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    sky: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    amber: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  };
  return (
    <Card className="border-border/70 shadow-none overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground leading-snug">{hint}</p> : null}
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiraRow({ item }: { item: RelatorioMiraItem }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug line-clamp-2">{item.titulo}</p>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">
          {[item.orgao, item.uf].filter(Boolean).join(" · ") || `ID ${item.id}`}
          {item.dataEncerramento ? ` · encerra ${formatDate(item.dataEncerramento)}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right space-y-1">
        <Badge variant="outline" className="text-[10px]">
          {item.pipelineStatus === "vai_participar" ? "Vai participar" : "Na mira"}
        </Badge>
        {item.valorEstimado != null ? (
          <p className="text-[11px] text-muted-foreground tabular-nums">{formatMoney(item.valorEstimado)}</p>
        ) : null}
      </div>
    </div>
  );
}

function RelatorioPage() {
  const [data, setData] = useState<ClienteRelatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchClienteRelatorio();
      if (!res.ok) {
        toast.error(res.error || "Não foi possível carregar o relatório.");
        setData(res);
        return;
      }
      setData(res);
    } catch {
      toast.error("Falha ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLicenca = async () => {
    const codigo = data?.licenca?.codigo;
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success("Código da licença copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const exportarPdf = async () => {
    if (!data?.ok) {
      toast.error("Aguarde o relatório carregar para exportar.");
      return;
    }
    setExportandoPdf(true);
    try {
      const docDigits = String(data.empresa?.documento || "")
        .replace(/\D/g, "")
        .slice(0, 14);
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `relatorio-cadbrasil-${docDigits || "cliente"}-${stamp}.pdf`;
      await exportClienteRelatorioPdf(data, fileName);
      toast.success("PDF gerado com os dados do relatório.");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Não foi possível gerar o PDF.";
      toast.error(msg);
    } finally {
      setExportandoPdf(false);
    }
  };

  const at = data?.atualizacoesSicaf;
  const usoPct =
    at && at.limite > 0 ? Math.min(100, Math.round((at.usadas / at.limite) * 100)) : 0;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Relatório de uso"
        subtitle="Visão da sua licença, acessos e engajamento com licitações e SICAF."
        icon={<BarChart3 className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap items-center gap-2" data-pdf-ignore>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void load()}
              disabled={loading || exportandoPdf}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => void exportarPdf()}
              disabled={!data?.ok || loading || exportandoPdf}
            >
              {exportandoPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              {exportandoPdf ? "Gerando PDF…" : "Extrair PDF"}
            </Button>
          </div>
        }
      />

      {loading && !data?.ok ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando indicadores…
        </div>
      ) : null}

      {data && !data.ok ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {data.error || "Relatório indisponível no momento."}
          </CardContent>
        </Card>
      ) : null}

      {data?.ok ? (
        <div className="space-y-6">
          {/* Hero licença */}
          <section className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white shadow-sm">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, #34d399 0%, transparent 40%), radial-gradient(circle at 80% 0%, #38bdf8 0%, transparent 35%)",
              }}
            />
            <div className="relative p-5 sm:p-7 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">
                  Código da licença
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xl sm:text-2xl font-bold tracking-wider">
                    {data.licenca?.codigo}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5 bg-white/10 text-white hover:bg-white/20 border-0"
                    data-pdf-ignore
                    onClick={() => void copyLicenca()}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {data.empresa?.razaoSocial || data.empresa?.nomeFantasia}
                  {data.empresa?.documento ? ` · CNPJ ${data.empresa.documento}` : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/20 border-0">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    SICAF {data.licenca?.status || "—"}
                  </Badge>
                  {data.manutencao?.ativa ? (
                    <Badge className="bg-sky-500/20 text-sky-100 hover:bg-sky-500/20 border-0">
                      <Wrench className="h-3 w-3 mr-1" /> Manutenção ativa
                    </Badge>
                  ) : (
                    <Badge className="bg-white/10 text-slate-200 hover:bg-white/10 border-0">
                      Sem manutenção
                    </Badge>
                  )}
                  {data.licenca?.dataValidade ? (
                    <Badge className="bg-white/10 text-slate-200 hover:bg-white/10 border-0">
                      Válida até {formatDate(data.licenca.dataValidade)}
                      {data.licenca.diasRestantes != null
                        ? ` · ${data.licenca.diasRestantes} dia(s)`
                        : ""}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-emerald-200/90 text-xs font-semibold uppercase tracking-wider">
                  <KeyRound className="h-3.5 w-3.5" /> Licença contratada
                </div>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  Este código identifica a licença anual CADBRASIL contratada pela sua empresa.
                  Use-o como referência em suporte, contratos e validações de acesso.
                </p>
                {data.acessos?.ultimoAcesso ? (
                  <div className="mt-4 rounded-lg bg-black/20 px-3 py-2.5 text-xs text-slate-300 space-y-1">
                    <p className="flex items-center gap-1.5">
                      <Globe2 className="h-3.5 w-3.5 text-sky-300" />
                      Último IP: <span className="font-mono text-white">{data.acessos.ultimoAcesso.ip || "—"}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Monitor className="h-3.5 w-3.5 text-slate-400" />
                      {data.acessos.ultimoAcesso.navegador || "Navegador"} ·{" "}
                      {formatDateTime(data.acessos.ultimoAcesso.em)}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* KPIs */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Acessos Licitações"
              value={data.licitacoes?.acessosTela ?? 0}
              hint={`${data.licitacoes?.acessosTela30d ?? 0} nos últimos 30 dias`}
              icon={Eye}
              tone="sky"
            />
            <KpiCard
              label="Na mira"
              value={data.licitacoes?.naMira ?? 0}
              hint={`${data.licitacoes?.vaiParticipar ?? 0} marcadas para participar`}
              icon={Target}
              tone="amber"
            />
            <KpiCard
              label="Atualizações SICAF"
              value={`${at?.usadas ?? 0}/${at?.limite ?? 0}`}
              hint={
                at?.manutencaoAtiva
                  ? "Ilimitadas com manutenção ativa"
                  : `${at?.restantes ?? 0} gratuitas restantes`
              }
              icon={RefreshCw}
              tone="emerald"
            />
            <KpiCard
              label="Logins"
              value={data.acessos?.loginsSucesso ?? 0}
              hint={`${data.acessos?.loginsTotal ?? 0} tentativas registradas`}
              icon={Activity}
              tone="slate"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-5">
            {/* Mira list */}
            <Card className="lg:col-span-3 border-border/70 shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-amber-600" />
                    Licitações na mira
                  </CardTitle>
                  <Button asChild variant="ghost" size="sm" className="h-8" data-pdf-ignore>
                    <Link to="/licitacoes">Abrir tela</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data.licitacoes?.itensMira?.length ?? 0) === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhuma licitação marcada ainda. Explore oportunidades e salve as melhores na mira.
                  </div>
                ) : (
                  data.licitacoes!.itensMira.map((item) => <MiraRow key={item.id} item={item} />)
                )}
              </CardContent>
            </Card>

            {/* Side panels */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-border/70 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Manutenção & SICAF
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Atualizações pelo Assistente</span>
                      <span className="font-medium tabular-nums">
                        {at?.usadas ?? 0}/{at?.limite ?? 0}
                      </span>
                    </div>
                    <Progress value={usoPct} className="h-2" />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {at?.manutencaoAtiva
                        ? "Plano de manutenção ativo — atualizações ilimitadas."
                        : "Contagem das Situações do Fornecedor enviadas pelo Assistente."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Manutenção</p>
                      <p className="mt-1 font-semibold flex items-center gap-1.5">
                        {data.manutencao?.ativa ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Ativa
                          </>
                        ) : (
                          "Não contratada"
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Detalhes abertos</p>
                      <p className="mt-1 font-semibold tabular-nums">
                        {data.licitacoes?.detalhesAbertos ?? 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-sky-600" />
                    IPs de acesso
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(data.acessos?.ipsRecentes?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum IP recente registrado.</p>
                  ) : (
                    data.acessos!.ipsRecentes.map((row) => (
                      <div
                        key={`${row.ip}-${row.em}`}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-medium">{row.ip}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {[row.navegador, row.dispositivo].filter(Boolean).join(" · ") || "Sessão"}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground shrink-0">
                          {formatDateTime(row.em)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Outros indicadores</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Central SICAF</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{data.usoPortal?.sicaf ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">acessos</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Assistente</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{data.usoPortal?.assistente ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">acessos</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Documentos
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{data.usoPortal?.documentos ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Ticket className="h-3 w-3" /> Tickets
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{data.usoPortal?.ticketsAbertos ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">abertos</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <p className="text-[11px] text-muted-foreground text-center">
            Relatório gerado em {formatDateTime(data.geradoEm)} · dados da conta autenticada
          </p>
        </div>
      ) : null}
    </PageContainer>
  );
}
