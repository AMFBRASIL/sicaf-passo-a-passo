import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Receipt,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Building2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  fetchClienteFinanceiro,
  formatFinanceBRL,
  formatFinanceDateBR,
  isFormaPix,
  type ClienteFinanceiroPainel,
  type PagamentoFinanceiroItem,
} from "@/lib/cliente-financeiro-api";
import { cn } from "@/lib/utils";
import wizardBg from "@/assets/wizard-bg.jpg";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: { nome: string; cnpj: string; clienteId: number };
  validade?: string | null;
};

function sortPagamentos(items: PagamentoFinanceiroItem[]) {
  return [...items].sort((a, b) => {
    const da = a.dataPagamento || a.dataVencimento || a.createdAt || "";
    const db = b.dataPagamento || b.dataVencimento || b.createdAt || "";
    return db.localeCompare(da);
  });
}

function labelForma(item: PagamentoFinanceiroItem) {
  if (isFormaPix(item)) return "PIX";
  const f = String(item.formaPagamento || "").trim();
  if (f) return f;
  return item.linkBoleto || item.barcode ? "Boleto" : "—";
}

function statusMeta(item: PagamentoFinanceiroItem) {
  if (item.pago) {
    return { label: "Pago", cls: "bg-success/10 text-success border-success/20" };
  }
  if (item.vencido) {
    return { label: "Vencido", cls: "bg-danger/10 text-danger border-danger/20" };
  }
  if (item.pendente) {
    return { label: "Pendente", cls: "bg-warning/15 text-warning-foreground border-warning/30" };
  }
  return { label: item.status || "—", cls: "bg-muted text-muted-foreground border-border" };
}

function PagamentoRow({ item }: { item: PagamentoFinanceiroItem }) {
  const meta = statusMeta(item);
  const comprovante = item.linkPdf || item.linkBoleto;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            item.pago ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground",
          )}
        >
          {item.pago ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {item.descricao || "Taxa SICAF"}
            {item.anoReferencia ? ` · ${item.anoReferencia}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] font-medium">
              {labelForma(item)}
            </Badge>
            {item.dataPagamento ? (
              <span>Pago em {formatFinanceDateBR(item.dataPagamento)}</span>
            ) : item.dataVencimento ? (
              <span>Vence {formatFinanceDateBR(item.dataVencimento)}</span>
            ) : null}
            {item.protocolo ? <span>· {item.protocolo}</span> : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:shrink-0">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor</p>
          <p className="text-sm font-bold">{formatFinanceBRL(item.valor)}</p>
        </div>
        <Badge className={cn("gap-1 border", meta.cls)}>{meta.label}</Badge>
        {comprovante && item.pago && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={comprovante} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
              Comprovante
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

export function PagamentoSicafResumoModal({ open, onOpenChange, empresa, validade }: Props) {
  const [loading, setLoading] = useState(false);
  const [financeiro, setFinanceiro] = useState<ClienteFinanceiroPainel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchClienteFinanceiro(empresa.clienteId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || "Erro ao carregar pagamentos");
      setFinanceiro(null);
      return;
    }
    setFinanceiro(res.financeiro ?? null);
  }, [empresa.clienteId]);

  useEffect(() => {
    if (!open) return;
    void carregar();
  }, [open, carregar]);

  const pagos = useMemo(
    () => sortPagamentos(financeiro?.sicaf?.pagos ?? []),
    [financeiro],
  );
  const pendentes = useMemo(
    () => sortPagamentos(financeiro?.sicaf?.pendentes ?? []),
    [financeiro],
  );
  const todos = useMemo(() => sortPagamentos([...pagos, ...pendentes]), [pagos, pendentes]);

  const resumo = financeiro?.resumo;
  const ultimoPago = pagos[0];
  const totalPago = resumo?.totalPagoSicaf ?? pagos.reduce((s, p) => s + (p.valor || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">Histórico de pagamentos SICAF — {empresa.nome}</DialogTitle>
        <div className="grid md:grid-cols-[240px_1fr] min-h-[480px]">
          <aside
            className="relative hidden md:flex flex-col p-6 text-white overflow-hidden"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.88), rgba(15,23,42,0.96)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80 tracking-wider">SICAF</span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">Pagamentos SICAF</h2>
            <p className="mt-1 text-xs text-white/70 truncate">{empresa.nome}</p>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/60">Total pago</p>
                <p className="text-xl font-bold mt-1">{formatFinanceBRL(totalPago)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/60">Pagamentos</p>
                <p className="text-xl font-bold mt-1">{pagos.length}</p>
              </div>
              {validade && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-200/80">Licença válida até</p>
                  <p className="text-sm font-semibold mt-1 text-emerald-100">{validade}</p>
                </div>
              )}
            </div>

            <div className="mt-auto pt-6 text-[11px] text-white/60">
              <p className="font-semibold">CNPJ {empresa.cnpj}</p>
            </div>
          </aside>

          <div className="flex flex-col min-h-0 bg-background">
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
              <div className="min-w-0 md:hidden">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm font-semibold truncate">{empresa.nome}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">CNPJ {empresa.cnpj}</p>
              </div>
              <div className="hidden md:block">
                <h3 className="text-lg font-bold">Histórico de pagamentos</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Taxas SICAF quitadas e comprovantes disponíveis.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => void carregar()}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Atualizar
              </Button>
            </div>

            <ScrollArea className="flex-1 max-h-[min(70vh,560px)]">
              <div className="space-y-4 p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:hidden">
                  <KpiMini label="Total pago" value={formatFinanceBRL(totalPago)} />
                  <KpiMini label="Pagamentos" value={String(pagos.length)} />
                  {validade ? <KpiMini label="Válido até" value={validade} /> : null}
                </div>

                {ultimoPago && (
                  <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Situação em dia</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Último pagamento em{" "}
                          <strong className="text-foreground">
                            {formatFinanceDateBR(ultimoPago.dataPagamento)}
                          </strong>
                          {" · "}
                          {formatFinanceBRL(ultimoPago.valor)} via {labelForma(ultimoPago)}
                          {validade ? ` · Licença até ${validade}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                {loading && !financeiro && (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <p className="text-sm">Carregando histórico...</p>
                  </div>
                )}

                {!loading && !error && todos.length === 0 && (
                  <div className="rounded-xl border border-dashed p-10 text-center">
                    <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm font-medium">Nenhum pagamento registrado</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Quando a taxa SICAF for quitada, o histórico aparecerá aqui.
                    </p>
                  </div>
                )}

                {pendentes.length > 0 && (
                  <>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Em aberto ({pendentes.length})
                      </p>
                      <div className="space-y-2">
                        {pendentes.map((item) => (
                          <PagamentoRow key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                    {pagos.length > 0 && <Separator />}
                  </>
                )}

                {pagos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Pagamentos realizados ({pagos.length})
                    </p>
                    <div className="space-y-2">
                      {pagos.map((item) => (
                        <PagamentoRow key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold mt-1 truncate">{value}</p>
    </div>
  );
}
