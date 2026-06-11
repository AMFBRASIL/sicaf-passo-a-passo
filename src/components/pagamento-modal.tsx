import { useEffect, useMemo, useState } from "react";
import {
  X,
  Barcode,
  QrCode,
  Check,
  Sparkles,
  Zap,
  Clock,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmpresaData } from "@/routes/empresas";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  gerarBoletoManutencaoPagamento,
  gerarPixManutencaoPagamento,
} from "@/lib/manutencao-api";
import { BoletoGeradoModal, type BoletoData } from "@/components/sicaf/BoletoGeradoModal";
import { PixPaymentModal } from "@/components/sicaf/PixPaymentModal";

type Metodo = "boleto" | "pix";

function isStaffTipo(tipo?: string | null) {
  const t = String(tipo || "").toLowerCase();
  return t === "admin" || t === "colaborador" || t === "gestor" || t === "analista";
}

function formatDateBR(iso: string) {
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return iso;
  return `${day}/${m}/${y}`;
}

export function PagamentoModal({
  open,
  onOpenChange,
  empresa,
  descricao,
  valor,
  vencimentoPadrao,
  boletoId,
  clienteId,
  onPaymentGenerated,
  initialMethod = "boleto",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: EmpresaData | null;
  descricao: string;
  valor: number;
  vencimentoPadrao?: string;
  /** Boleto de manutenção — obrigatório para integração Gerencianet */
  boletoId?: number;
  clienteId?: number;
  onPaymentGenerated?: () => void;
  initialMethod?: Metodo;
}) {
  const { user } = useAuth();
  const [metodo, setMetodo] = useState<Metodo>(initialMethod);
  const [data, setData] = useState<string>(
    vencimentoPadrao ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [boletoModalOpen, setBoletoModalOpen] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [boletoData, setBoletoData] = useState<BoletoData | null>(null);
  const [pixData, setPixData] = useState<{
    qrcodeText: string;
    qrcodeImage: string;
    valor: number;
    protocolo: string;
    txid: string;
    pagamentoId?: number;
  } | null>(null);

  const effectiveClienteId = clienteId ?? empresa?.clienteId;
  const podeGerar = !!(boletoId && effectiveClienteId);
  const allowCustomizeDueDate = isStaffTipo(user?.perfil?.tipo);
  const podeEditarVencimento = podeGerar && allowCustomizeDueDate && metodo === "boleto";

  const vencimentoExibicao = useMemo(() => {
    if (vencimentoPadrao && /^\d{4}-\d{2}-\d{2}$/.test(vencimentoPadrao)) {
      const hoje = new Date().toISOString().slice(0, 10);
      return vencimentoPadrao >= hoje ? vencimentoPadrao : hoje;
    }
    return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  }, [vencimentoPadrao]);

  useEffect(() => {
    if (!open) return;
    setMetodo(initialMethod);
    setProcessing(false);
    setErrorMsg("");
    setBoletoData(null);
    setPixData(null);
    setData(vencimentoExibicao);
  }, [open, initialMethod, vencimentoExibicao]);

  if (!empresa) return null;

  const valorFmt = valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const handleGerar = async () => {
    if (!effectiveClienteId) {
      toast.error("Empresa sem identificador. Recarregue a página.");
      return;
    }
    if (!boletoId) {
      toast.error("Selecione um boleto de manutenção na aba Boletos antes de gerar o pagamento.");
      return;
    }

    if (metodo === "boleto" && podeEditarVencimento) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const venc = new Date(`${data}T00:00:00`);
      if (Number.isNaN(venc.getTime()) || venc < hoje) {
        setErrorMsg("Data de vencimento inválida. Informe uma data de hoje em diante.");
        return;
      }
    }

    setProcessing(true);
    setErrorMsg("");

    const result =
      metodo === "boleto"
        ? await gerarBoletoManutencaoPagamento(
            boletoId!,
            effectiveClienteId,
            podeEditarVencimento ? data : undefined,
          )
        : await gerarPixManutencaoPagamento(boletoId!, effectiveClienteId);

    setProcessing(false);

    if (!result.ok) {
      let errText = result.error || "Erro ao gerar pagamento";
      if (errText.toLowerCase().includes("unauthorized")) {
        errText =
          "Erro de autenticação com o gateway de pagamento (Efí/Gerencianet). Verifique as credenciais no servidor.";
      }
      setErrorMsg(errText);
      return;
    }

    if (metodo === "boleto") {
      setBoletoData({
        barcode: result.barcode || "",
        link: result.link || "",
        pdf: result.pdf || "",
        valor: result.valor ?? valor,
        vencimento: result.vencimento || data,
        protocolo: result.protocolo || "",
        chargeId: result.chargeId,
      });
      onOpenChange(false);
      setBoletoModalOpen(true);
      toast.success("Boleto gerado com sucesso!");
    } else {
      setPixData({
        qrcodeText: result.qrcodeText || "",
        qrcodeImage: result.qrcodeImage || "",
        valor: result.valor ?? valor,
        protocolo: result.protocolo || "",
        txid: result.txid || "",
        pagamentoId: result.pagamentoId,
      });
      onOpenChange(false);
      setPixModalOpen(true);
      toast.success("PIX gerado com sucesso!");
    }

    onPaymentGenerated?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 sm:rounded-2xl border-0">
          <div className="relative bg-gradient-to-br from-emerald-600 to-emerald-500 text-white px-6 py-5">
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full hover:bg-white/20 flex items-center justify-center transition"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold leading-tight">Escolha a Forma de Pagamento</h2>
                <p className="text-sm opacity-90 truncate font-medium">{empresa.nome}</p>
                <p className="text-xs opacity-80 font-mono">CNPJ {empresa.cnpj}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5 bg-white">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                Forma selecionada:{" "}
                <strong>{metodo === "boleto" ? "Boleto Bancário" : "PIX"}</strong>. Clique em{" "}
                <strong>{metodo === "boleto" ? '"Gerar Boleto"' : '"Gerar PIX"'}</strong> para
                continuar.
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <MetodoCard
                ativo={metodo === "boleto"}
                onClick={() => setMetodo("boleto")}
                icon={Barcode}
                titulo="Boleto Bancário"
                desc="Pague em qualquer banco ou lotérica"
                destaque={
                  <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                    <Clock className="h-3.5 w-3.5" />{" "}
                    {podeEditarVencimento
                      ? "Vencimento configurável"
                      : `Vencimento: ${formatDateBR(data)}`}
                  </span>
                }
              />
              <MetodoCard
                ativo={metodo === "pix"}
                onClick={() => setMetodo("pix")}
                icon={QrCode}
                titulo="PIX"
                desc="Pagamento instantâneo via QR Code"
                destaque={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-semibold">
                    <Zap className="h-3 w-3" /> Pagamento instantâneo
                  </span>
                }
              />
            </div>

            <div className={cn("grid gap-3", metodo === "boleto" ? "sm:grid-cols-2" : "grid-cols-1")}>
              {metodo === "boleto" && (
                <div className="rounded-xl border border-slate-200 p-4 bg-white">
                  <p className="text-sm font-semibold text-slate-900 mb-2">Data de vencimento do boleto</p>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    readOnly={!podeEditarVencimento}
                    className={cn(
                      "w-full h-10 px-3 rounded-lg border border-slate-300 bg-slate-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500",
                      !podeEditarVencimento && "opacity-80 cursor-default",
                    )}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    {podeEditarVencimento
                      ? "Escolha o vencimento do boleto."
                      : "Vencimento conforme o boleto de manutenção."}
                  </p>
                </div>
              )}

              <div
                className={cn(
                  "rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col justify-center items-center text-center",
                  metodo === "pix" && "sm:py-8",
                )}
              >
                <p className="text-sm text-slate-700">Valor de {descricao}</p>
                <p className="text-3xl font-bold text-emerald-700 mt-1">{valorFmt}</p>
                {metodo === "pix" && (
                  <p className="text-xs text-slate-600 mt-2 max-w-sm">
                    Após gerar, você verá o QR Code e o código copia e cola. A confirmação do pagamento é automática.
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Pagamento seguro via Gerencianet/Efí
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/50 px-6 py-4 flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2" disabled={processing}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
            <Button
              onClick={() => void handleGerar()}
              disabled={processing}
              className="flex-1 h-12 text-base font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Gerando…
                </>
              ) : metodo === "boleto" ? (
                <>
                  <Barcode className="h-5 w-5" /> Gerar Boleto
                </>
              ) : (
                <>
                  <QrCode className="h-5 w-5" /> Gerar PIX e Pagar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BoletoGeradoModal
        open={boletoModalOpen}
        onOpenChange={setBoletoModalOpen}
        client={empresa.nome}
        documento={empresa.cnpj}
        boletoData={boletoData}
      />

      <PixPaymentModal
        open={pixModalOpen}
        onOpenChange={setPixModalOpen}
        client={empresa.nome}
        documento={empresa.cnpj}
        pixData={pixData}
        onPaymentConfirmed={() => onPaymentGenerated?.()}
      />
    </>
  );
}

function MetodoCard({
  ativo,
  onClick,
  icon: Icon,
  titulo,
  desc,
  destaque,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: typeof Barcode;
  titulo: string;
  desc: string;
  destaque: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border-2 p-5 text-center transition-all bg-white",
        ativo
          ? "border-emerald-500 bg-emerald-50/40 shadow-[0_0_0_4px_rgba(16,185,129,0.08)]"
          : "border-slate-200 hover:border-slate-300",
      )}
    >
      {ativo && (
        <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
          <Check className="h-4 w-4" />
        </div>
      )}
      <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-7 w-7" />
      </div>
      <p className="font-bold text-slate-900">{titulo}</p>
      <p className="text-xs text-slate-600 mt-1">{desc}</p>
      <div className="mt-3 text-xs">{destaque}</div>
    </button>
  );
}
