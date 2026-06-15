import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Loader2,
  Receipt,
  Sparkles,
  X,
} from "lucide-react";
import {
  fetchAdminGoogleAds,
  formatBRL,
  type GoogleAdsClientePago,
  type GoogleAdsPalavra,
} from "@/lib/admin-google-ads-api";

function formatDataHora(raw?: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatData(raw?: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("pt-BR");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  palavra: GoogleAdsPalavra | null;
  days: number;
}

export function GoogleAdsPagosModal({ open, onOpenChange, palavra, days }: Props) {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<GoogleAdsClientePago[]>([]);
  const [resumo, setResumo] = useState<{
    totalClientes: number;
    totalPagamentos: number;
    totalValor: number;
    totalValorFormatado: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !palavra?.palavra) return;

    let cancelled = false;
    setLoading(true);
    setClientes([]);
    setResumo(null);

    void fetchAdminGoogleAds({ days, palavra: palavra.palavra, pagos: true }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error || "Erro ao carregar pagamentos da palavra-chave");
        return;
      }
      setClientes(res.pagosDetalhe?.clientes || []);
      setResumo(res.pagosDetalhe?.resumo || null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, palavra?.palavra, days]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[100] max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden sm:rounded-2xl border-0 shadow-2xl [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">
          Pagos validados — {palavra?.palavra || "palavra-chave"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Lista de clientes que pagaram após clicar na palavra-chave do Google Ads.
        </DialogDescription>

        {!palavra ? null : (
          <>
        <div
          className="relative overflow-hidden px-6 py-5 text-white"
          style={{
            background:
              "linear-gradient(135deg, hsl(160 84% 28%) 0%, hsl(200 70% 32%) 50%, hsl(262 55% 38%) 100%)",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/15">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Pagos validados
                </Badge>
                <Badge variant="outline" className="border-white/25 text-white/90">
                  Últimos {days} dias
                </Badge>
              </div>
              <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">{palavra.palavra}</h2>
              <p className="mt-1 text-sm text-white/80">
                Clientes que pagaram após clicar nesta palavra-chave no Google Ads.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-white hover:bg-white/15 hover:text-white"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {resumo && !loading && (
            <div className="relative mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Clientes</p>
                <p className="mt-1 text-2xl font-bold">{resumo.totalClientes}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Pagamentos</p>
                <p className="mt-1 text-2xl font-bold">{resumo.totalPagamentos}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Receita</p>
                <p className="mt-1 text-2xl font-bold">{resumo.totalValorFormatado}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando clientes que pagaram...
            </div>
          ) : clientes.length === 0 ? (
            <div className="py-20 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">Nenhum pagamento validado nesta palavra no período.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[min(70vh,640px)]">
              <div className="space-y-3 p-4 sm:p-5">
                {clientes.map((c) => (
                  <div
                    key={c.clienteId}
                    className="overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{c.nome}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{c.documento || "—"}</span>
                            {c.documento && (
                              <button
                                type="button"
                                className="rounded p-0.5 hover:bg-muted"
                                title="Copiar documento"
                                onClick={() => {
                                  void navigator.clipboard.writeText(c.documento!.replace(/\D/g, ""));
                                  toast.success("Documento copiado");
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            )}
                            {c.email && <span className="truncate">{c.email}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600">{c.valorTotalFormatado}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.qtdPagamentos} pagamento{c.qtdPagamentos !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
                      <InfoChip icon={Calendar} label="Primeiro clique" value={formatDataHora(c.primeiraSessao)} />
                      <InfoChip icon={CreditCard} label="Primeiro pagamento" value={formatDataHora(c.primeiroPagamento)} />
                      <InfoChip icon={Clock} label="Dias até pagar" value={c.diasAtePagar != null ? `${c.diasAtePagar} dia(s)` : "—"} />
                      <InfoChip icon={Receipt} label="Cadastro" value={formatData(c.cadastroEm)} />
                    </div>

                    <div className="border-t px-4 py-3 sm:px-5">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Pagamentos no período
                      </p>
                      <div className="space-y-2">
                        {c.pagamentos.map((p) => (
                          <div
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/80 px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">{p.descricao}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {p.origemLabel}
                                </Badge>
                                {p.forma && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {p.forma}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Pago em {formatDataHora(p.dataPagamento)}
                                {p.status ? ` · ${p.status}` : ""}
                              </p>
                            </div>
                            <span className="shrink-0 font-semibold text-emerald-600">{formatBRL(p.valor)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-background/70 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-xs font-medium leading-snug">{value}</p>
    </div>
  );
}
