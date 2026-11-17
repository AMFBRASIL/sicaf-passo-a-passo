import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Receipt,
  Search,
  Loader2,
  RefreshCw,
  Download,
  Eye,
  Ban,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-fetch";
import {
  fetchAdminFiscalPainel,
  cancelarAdminFiscal,
  adminFiscalArquivoUrl,
  formatMoneyBr,
  formatDocBr,
  formatDateTimeBr,
  type NfsePainelEmissao,
  type NfsePainelIndicadores,
  type NfsePainelSerie,
} from "@/lib/admin-fiscal-api";

export const Route = createFileRoute("/admin/fiscal")({
  component: FiscalAdminPage,
});

type FiltroStatus = "todos" | "autorizada" | "cancelada" | "rejeitada" | "pendente";

const STATUS_UI: Record<string, { label: string; className: string }> = {
  autorizada: {
    label: "Autorizada",
    className: "bg-teal-600/15 text-teal-800 dark:text-teal-200",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-rose-600/12 text-rose-800 dark:text-rose-200",
  },
  rejeitada: {
    label: "Rejeitada",
    className: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  },
  pendente: {
    label: "Pendente",
    className: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
};

function FiscalAdminPage() {
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<NfsePainelEmissao[]>([]);
  const [indicadores, setIndicadores] = useState<NfsePainelIndicadores | null>(null);
  const [serie, setSerie] = useState<NfsePainelSerie[]>([]);
  const [ambiente, setAmbiente] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfItem, setPdfItem] = useState<NfsePainelEmissao | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [buscaDebounced, filtro]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminFiscalPainel({
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: filtro,
        q: buscaDebounced,
      });
      if (!res.ok) {
        toast.error(res.error || "Erro ao carregar Fiscal");
        setItens([]);
        return;
      }
      setItens(res.emissoes || []);
      setIndicadores(res.indicadores || null);
      setSerie(res.serie || []);
      setAmbiente(res.ambiente || "");
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, buscaDebounced, filtro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const baixar = async (item: NfsePainelEmissao, tipo: "pdf" | "xml") => {
    const direct = tipo === "pdf" ? item.pdfUrl : item.xmlUrl;
    if (direct) {
      window.open(direct, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const res = await apiFetch(
        adminFiscalArquivoUrl(item.id, tipo, { clienteId: item.clienteId }),
      );
      if (!res.ok) {
        toast.error(`Falha ao baixar ${tipo.toUpperCase()}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NFSe_${item.id}.${tipo}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no download");
    }
  };

  const abrirPdf = async (item: NfsePainelEmissao) => {
    setPdfItem(item);
    setPdfOpen(true);
    setPdfLoading(true);
    setPdfUrl(null);
    try {
      if (item.pdfUrl) {
        setPdfUrl(item.pdfUrl);
        return;
      }
      const res = await apiFetch(
        adminFiscalArquivoUrl(item.id, "pdf", { clienteId: item.clienteId, inline: true }),
      );
      if (!res.ok) {
        toast.error("Não foi possível abrir o PDF");
        return;
      }
      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const fecharPdf = (open: boolean) => {
    setPdfOpen(open);
    if (!open && pdfUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setPdfItem(null);
    }
  };

  const cancelar = async (item: NfsePainelEmissao) => {
    if (!item.clienteId) {
      toast.error("Emissão sem cliente vinculado");
      return;
    }
    const ok = window.confirm(
      `Cancelar NFS-e #${item.id}?\n\n${item.clienteRazao || item.tomadorNome || ""}\nChave: ${item.chaveAcesso || "—"}\n\nEnvia o evento 101101 à SEFIN.`,
    );
    if (!ok) return;
    setCancellingId(item.id);
    try {
      const res = await cancelarAdminFiscal({
        emissaoId: item.id,
        clienteId: item.clienteId,
        motivo: "Cancelamento solicitado no painel Fiscal admin",
      });
      if (!res.ok) {
        toast.error(res.error || "Falha ao cancelar");
        return;
      }
      toast.success(res.alreadyCancelled ? "Já estava cancelada" : "NFS-e cancelada");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no cancelamento");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 px-5 py-6 text-white shadow-sm md:px-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-200/90">
              <Receipt className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">Fiscal · NFS-e Nacional</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Notas emitidas pelo sistema
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-300">
              Acompanhe autorizações, cancelamentos e arquivos (PDF/XML) da CadBrasil.
              {ambiente ? ` Ambiente: ${ambiente}.` : ""}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 bg-white/10 text-white hover:bg-white/15 border-0"
            onClick={() => void carregar()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Sparkles}
          label="Total emitidas"
          value={String(indicadores?.total ?? "—")}
          hint="Todas as tentativas registradas"
          tone="slate"
        />
        <Kpi
          icon={CheckCircle2}
          label="Autorizadas"
          value={String(indicadores?.autorizadas ?? "—")}
          hint={formatMoneyBr(indicadores?.valorAutorizado)}
          tone="teal"
        />
        <Kpi
          icon={Ban}
          label="Canceladas"
          value={String(indicadores?.canceladas ?? "—")}
          hint={formatMoneyBr(indicadores?.valorCancelado)}
          tone="rose"
        />
        <Kpi
          icon={AlertTriangle}
          label="Rejeitadas / pendentes"
          value={String((indicadores?.rejeitadas || 0) + (indicadores?.pendentes || 0))}
          hint={`${indicadores?.rejeitadas || 0} rejeitadas · ${indicadores?.pendentes || 0} pendentes`}
          tone="amber"
        />
      </div>

      {/* Chart + filters */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Autorizadas — últimos 14 dias</h3>
              <p className="text-xs text-muted-foreground">Quantidade diária de NFS-e autorizadas</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie}>
                <defs>
                  <linearGradient id="nfseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value, name) => [
                    name === "valor" ? formatMoneyBr(Number(value)) : value,
                    name === "valor" ? "Valor" : "Qtd",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="qtd"
                  stroke="#0f766e"
                  fill="url(#nfseFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Filtros</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Buscar cliente, chave, tomador…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroStatus)}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-transparent p-0 sm:grid-cols-3">
              {(
                [
                  ["todos", "Todos"],
                  ["autorizada", "Autorizadas"],
                  ["cancelada", "Canceladas"],
                  ["rejeitada", "Rejeitadas"],
                  ["pendente", "Pendentes"],
                ] as const
              ).map(([k, label]) => (
                <TabsTrigger
                  key={k}
                  value={k}
                  className="rounded-md border bg-muted/40 px-2 py-1.5 text-[11px] data-[state=active]:bg-teal-700 data-[state=active]:text-white"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="mt-auto text-[11px] text-muted-foreground leading-relaxed">
            Clique em <strong>Ver PDF</strong> para pré-visualizar. Cancelamento envia o evento
            oficial 101101 à SEFIN Nacional.
          </p>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Emissões
          </h3>
          <span className="text-xs text-muted-foreground">
            {pagination.total} registro{pagination.total === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-4">
            <Receipt className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma NFS-e encontrada neste filtro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente / Tomador</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item) => {
                  const st = STATUS_UI[item.status] || STATUS_UI.pendente;
                  const cancelling = cancellingId === item.id;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="min-w-[200px]">
                        <p className="text-sm font-medium truncate max-w-[240px]">
                          {item.clienteRazao || item.tomadorNome || "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {formatDocBr(item.clienteDocumento || item.tomadorDoc)}
                        </p>
                        {item.chaveAcesso && (
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            …{String(item.chaveAcesso).slice(-10)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="text-xs line-clamp-2">{item.descricao || "—"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          #{item.id}
                          {item.serie ? ` · série ${item.serie}` : ""}
                          {item.numeroDps ? ` · nDPS ${item.numeroDps}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums whitespace-nowrap">
                        {formatMoneyBr(item.valor)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] border-0 ${st.className}`}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTimeBr(item.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => void abrirPdf(item)}
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => void baixar(item, "pdf")}
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => void baixar(item, "xml")}
                          >
                            <Download className="h-3.5 w-3.5" /> XML
                          </Button>
                          {item.podeCancelar && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                              disabled={cancelling}
                              onClick={() => void cancelar(item)}
                            >
                              {cancelling ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* PDF modal */}
      <Dialog open={pdfOpen} onOpenChange={fecharPdf}>
        <DialogContent className="max-w-4xl h-[min(90vh,880px)] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="border-b px-5 py-4 space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-teal-700" />
              Pré-visualização PDF — NFS-e #{pdfItem?.id}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {pdfItem?.clienteRazao || pdfItem?.tomadorNome || "—"} ·{" "}
              {formatMoneyBr(pdfItem?.valor)}
              {pdfItem?.chaveAcesso
                ? ` · …${String(pdfItem.chaveAcesso).slice(-12)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-900">
            {pdfLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando PDF…
              </div>
            ) : pdfUrl ? (
              <iframe title="NFSe PDF" src={pdfUrl} className="h-full w-full border-0" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-8 w-8 opacity-40" />
                PDF indisponível para esta emissão.
              </div>
            )}
          </div>
          <DialogFooter className="border-t px-5 py-3 gap-2">
            {pdfItem && (
              <>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => void baixar(pdfItem, "pdf")}>
                  <Download className="h-3.5 w-3.5" /> Baixar PDF
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => void baixar(pdfItem, "xml")}>
                  <Download className="h-3.5 w-3.5" /> Baixar XML
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => fecharPdf(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  tone: "slate" | "teal" | "rose" | "amber";
}) {
  const tones = {
    slate: "from-slate-500/10 to-transparent text-slate-700 dark:text-slate-200",
    teal: "from-teal-500/15 to-transparent text-teal-800 dark:text-teal-200",
    rose: "from-rose-500/12 to-transparent text-rose-800 dark:text-rose-200",
    amber: "from-amber-500/15 to-transparent text-amber-900 dark:text-amber-100",
  };
  return (
    <Card className={`relative overflow-hidden p-4 bg-gradient-to-br ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          <p className="mt-1 text-[11px] opacity-70">{hint}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/60 ring-1 ring-border/60">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
