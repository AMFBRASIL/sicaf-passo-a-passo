import { useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Receipt,
  Building2,
  CalendarDays,
  CreditCard,
  Hash,
  ExternalLink,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  enviarComprovanteManutencao,
  fetchBoletoManutencaoDetalhe,
  fmtBrl,
  type ManutencaoBoleto,
} from "@/lib/manutencao-api";
import { formatFinanceDateBR } from "@/lib/cliente-financeiro-api";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boletoId: number | null;
  /** Dados já carregados na lista (fallback enquanto busca detalhe). */
  boletoSeed?: ManutencaoBoleto | null;
  empresaNome?: string;
  empresaCnpj?: string;
  emailPadrao?: string;
};

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right break-all">{value || "—"}</span>
    </div>
  );
}

export function ManutencaoComprovanteModal({
  open,
  onOpenChange,
  boletoId,
  boletoSeed,
  empresaNome,
  empresaCnpj,
  emailPadrao,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [boleto, setBoleto] = useState<ManutencaoBoleto | null>(boletoSeed ?? null);
  const [emailCliente, setEmailCliente] = useState(emailPadrao || "");
  const [clienteNome, setClienteNome] = useState(empresaNome || "");
  const [clienteCnpj, setClienteCnpj] = useState(empresaCnpj || "");

  useEffect(() => {
    if (!open || !boletoId) return;
    let cancelled = false;
    setBoleto(boletoSeed ?? null);
    setEmailCliente(emailPadrao || "");
    setClienteNome(empresaNome || "");
    setClienteCnpj(empresaCnpj || "");
    setLoading(true);

    void (async () => {
      const res = await fetchBoletoManutencaoDetalhe(boletoId);
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !res.boleto) {
        toast.error(res.error || "Não foi possível carregar o comprovante.");
        return;
      }
      setBoleto(res.boleto);
      if (res.cliente?.email) setEmailCliente(res.cliente.email);
      if (res.cliente?.nome) setClienteNome(res.cliente.nome);
      if (res.cliente?.cnpj) setClienteCnpj(res.cliente.cnpj);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, boletoId, boletoSeed, emailPadrao, empresaNome, empresaCnpj]);

  const pdfUrl = boleto?.linkPdf || boleto?.linkBoleto || null;
  const referencia =
    boleto?.referencia ||
    (boleto?.mes && boleto?.ano
      ? `${String(boleto.mes).padStart(2, "0")}/${boleto.ano}`
      : null);

  const handleEnviar = async () => {
    if (!boletoId) return;
    const dest = emailCliente.trim();
    if (!dest || !dest.includes("@")) {
      toast.error("Informe um e-mail válido para envio.");
      return;
    }
    setSending(true);
    const res = await enviarComprovanteManutencao(boletoId, dest);
    setSending(false);
    if (!res.ok) {
      toast.error(res.error || "Falha ao enviar comprovante.");
      return;
    }
    if (res.emailNotificacao?.simulado) {
      toast.message(res.message || `E-mail simulado para ${dest}`);
    } else {
      toast.success(res.message || `Comprovante enviado para ${dest}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">Comprovante de pagamento — Manutenção</DialogTitle>

        <div className="border-b bg-gradient-to-br from-teal-700 to-teal-500 px-5 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-white/70">Comprovante</p>
              <h2 className="text-lg font-semibold leading-tight truncate">
                Manutenção {referencia ? `· ${referencia}` : ""}
              </h2>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {loading && !boleto ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhes…
            </div>
          ) : boleto ? (
            <>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{clienteNome || "—"}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {clienteCnpj || "CNPJ não informado"}
                    </p>
                  </div>
                  <Badge className="ml-auto shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-700">
                    Pago
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border px-4 divide-y">
                <InfoRow label="Referência" value={referencia} />
                <InfoRow label="Valor" value={<span className="text-teal-700 font-bold">{fmtBrl(boleto.valor)}</span>} />
                <InfoRow
                  label="Pago em"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatFinanceDateBR(boleto.dataPagamento)}
                    </span>
                  }
                />
                <InfoRow label="Vencimento" value={formatFinanceDateBR(boleto.vencimento)} />
                <InfoRow
                  label="Forma"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      {boleto.formaPagamento || "—"}
                    </span>
                  }
                />
                <InfoRow
                  label="Protocolo"
                  value={
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      {boleto.protocolo || `MANUT-${boleto.id}`}
                    </span>
                  }
                />
                {boleto.txid ? <InfoRow label="TXID" value={<span className="font-mono text-xs">{boleto.txid}</span>} /> : null}
                {boleto.chargeId ? (
                  <InfoRow label="Charge ID" value={<span className="font-mono text-xs">{String(boleto.chargeId)}</span>} />
                ) : null}
              </div>

              {pdfUrl && (
                <Button variant="outline" className="w-full gap-2" asChild>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" /> Abrir PDF / boleto
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                </Button>
              )}

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Mail className="h-4 w-4 text-teal-700" />
                  Enviar ao cliente
                </div>
                <p className="text-xs text-muted-foreground">
                  O comprovante será enviado por e-mail com o resumo deste pagamento.
                </p>
                <Input
                  type="email"
                  value={emailCliente}
                  onChange={(e) => setEmailCliente(e.target.value)}
                  placeholder="cliente@empresa.com.br"
                  className="h-10"
                />
                <Button
                  className={cn("w-full gap-2 bg-teal-700 hover:bg-teal-800")}
                  disabled={sending || loading}
                  onClick={() => void handleEnviar()}
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" /> Enviar comprovante
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <Receipt className="h-8 w-8 opacity-40" />
              Nenhum detalhe disponível.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
