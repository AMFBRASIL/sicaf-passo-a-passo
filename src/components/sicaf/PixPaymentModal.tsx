import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, X, CheckCircle2, Copy, Info, Clipboard, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";

interface PixData {
  qrcodeText: string;
  qrcodeImage: string;
  valor: number;
  protocolo: string;
  txid: string;
  pagamentoId?: number;
}

interface PixPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: string;
  documento?: string;
  pixData?: PixData | null;
  onPaymentConfirmed?: () => void;
  /** Consulta automática na Efí/Gerencianet (padrão: ligada). */
  autoPoll?: boolean;
  pollIntervalMs?: number;
}

function formatValor(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type VerificationStatus = "idle" | "checking" | "paid" | "not_paid" | "error" | "expired" | "cancelled";

const DEFAULT_POLL_MS = 30_000;

export function PixPaymentModal({
  open,
  onOpenChange,
  client,
  documento,
  pixData,
  onPaymentConfirmed,
  autoPoll = true,
  pollIntervalMs = DEFAULT_POLL_MS,
}: PixPaymentModalProps) {
  const qrcodeText = pixData?.qrcodeText || "";
  const valor = pixData?.valor || 0;

  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("idle");
  const [checkCount, setCheckCount] = useState(0);
  const [pollingAtivo, setPollingAtivo] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPollingAtivo(false);
  }, []);

  const checkPaymentStatus = useCallback(async (): Promise<VerificationStatus> => {
    try {
      const body: Record<string, unknown> = {};
      if (pixData?.pagamentoId) body.pagamentoId = pixData.pagamentoId;
      else if (pixData?.txid) body.txid = pixData.txid;
      else return "error";

      const res = await apiFetch("/api/pagamentos/check-status", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!result.ok) return "error";

      if (result.status === "pago") return "paid";
      if (result.status === "expirado") return "expired";
      if (result.status === "cancelado") return "cancelled";
      return "not_paid";
    } catch {
      return "error";
    }
  }, [pixData]);

  const runCheck = useCallback(async () => {
    if (!isMountedRef.current || !pixData) return;
    setVerificationStatus("checking");
    const status = await checkPaymentStatus();
    if (!isMountedRef.current) return;

    setCheckCount((c) => c + 1);

    if (status === "paid") {
      setVerificationStatus("paid");
      stopPolling();
      toast.success("Pagamento confirmado!", { description: "O PIX foi recebido com sucesso." });
      onPaymentConfirmed?.();
      return;
    }
    if (status === "expired" || status === "cancelled") {
      setVerificationStatus(status);
      stopPolling();
      return;
    }
    setVerificationStatus(status === "error" ? "not_paid" : "not_paid");
  }, [checkPaymentStatus, onPaymentConfirmed, pixData, stopPolling]);

  const startPolling = useCallback(() => {
    if (!pixData?.pagamentoId && !pixData?.txid) return;
    stopPolling();
    setPollingAtivo(true);
    void runCheck();
    intervalRef.current = setInterval(() => {
      void runCheck();
    }, pollIntervalMs);
  }, [pixData, pollIntervalMs, runCheck, stopPolling]);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setVerificationStatus("idle");
      setCheckCount(0);
      return;
    }
    if (autoPoll && pixData && (pixData.pagamentoId || pixData.txid)) {
      startPolling();
    }
    return () => stopPolling();
  }, [open, autoPoll, pixData, startPolling, stopPolling]);

  const handleCopyPayload = () => {
    if (!qrcodeText) return;
    navigator.clipboard.writeText(qrcodeText);
    toast.success("Código PIX copiado!", { description: "Cole no app do seu banco" });
  };

  const handleClose = () => {
    stopPolling();
    onOpenChange(false);
  };

  if (verificationStatus === "paid") {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden gap-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Pagamento Confirmado</DialogTitle>
          <div className="flex flex-col items-center justify-center py-12 px-6 space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-emerald-600">Pagamento Confirmado!</h3>
            <p className="text-sm text-muted-foreground text-center">
              O pagamento PIX de <strong>{formatValor(valor)}</strong> foi recebido.
            </p>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Pagamento PIX</DialogTitle>
        <div className="bg-emerald-600 p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-white font-bold text-lg">Pagamento PIX</h2>
            {client && <p className="text-emerald-100 text-sm truncate">{client}</p>}
          </div>
        </div>

        {pollingAtivo && verificationStatus !== "expired" && verificationStatus !== "cancelled" && (
          <div className="flex items-center gap-2 bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 text-sm text-emerald-800">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
            <span>
              {verificationStatus === "checking"
                ? "Consultando pagamento na Efí/Gerencianet…"
                : "Aguardando pagamento — nova verificação em até 30 segundos"}
              {checkCount > 0 && (
                <span className="text-emerald-600/80 font-mono text-xs ml-1">({checkCount}×)</span>
              )}
            </span>
          </div>
        )}

        {(verificationStatus === "expired" || verificationStatus === "cancelled") && (
          <div className="flex items-center gap-2 bg-red-50 border-b border-red-100 px-5 py-2.5 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{verificationStatus === "expired" ? "PIX expirado. Gere um novo pagamento." : "PIX cancelado."}</span>
          </div>
        )}

        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <div className="bg-emerald-50 rounded-2xl p-6 flex items-center justify-center">
                {pixData?.qrcodeImage ? (
                  <img src={pixData.qrcodeImage} alt="QR Code PIX" className="w-[200px] h-[200px]" />
                ) : qrcodeText ? (
                  <QRCodeSVG
                    value={qrcodeText}
                    size={200}
                    level="H"
                    includeMargin={false}
                    bgColor="transparent"
                    fgColor="currentColor"
                    className="text-foreground"
                  />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center text-muted-foreground text-sm text-center px-4">
                    QR Code indisponível
                  </div>
                )}
              </div>
              <div className="mt-3 text-center">
                <p className="text-2xl font-extrabold text-foreground">{formatValor(valor)}</p>
                {documento && <p className="text-xs text-muted-foreground font-mono mt-1">{documento}</p>}
              </div>
            </div>

            <div className="flex-1 space-y-5 min-w-0">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-foreground">Como pagar:</h3>
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li><span className="font-bold text-foreground">1.</span> Abra o app do seu banco</li>
                  <li><span className="font-bold text-foreground">2.</span> Escolha a opção PIX</li>
                  <li><span className="font-bold text-foreground">3.</span> Escaneie o QR Code ou copie o código</li>
                  <li><span className="font-bold text-foreground">4.</span> Confirme o pagamento</li>
                </ol>
              </div>

              {qrcodeText && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clipboard className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-bold text-foreground text-sm">PIX Copia e Cola:</h3>
                  </div>
                  <textarea
                    readOnly
                    value={qrcodeText}
                    rows={3}
                    className="w-full text-xs font-mono text-foreground bg-muted/50 rounded-lg border border-border p-3 resize-none focus:outline-none break-all"
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                  <Button variant="outline" className="w-full text-sm mt-2" onClick={handleCopyPayload}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar código PIX Copia e Cola
                  </Button>
                </div>
              )}

              {verificationStatus === "not_paid" && checkCount > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Pagamento ainda não identificado. Após pagar, a confirmação é automática em até 30 segundos.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <Button variant="outline" className="flex-1 h-11" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>
            <Button
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={() => void runCheck()}
              disabled={verificationStatus === "checking"}
            >
              {verificationStatus === "checking" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Já fiz o pagamento
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
