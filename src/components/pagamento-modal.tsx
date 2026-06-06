import { useEffect, useState } from "react";
import {
  X,
  Barcode,
  QrCode,
  Check,
  Sparkles,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Download,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmpresaData } from "@/routes/empresas";

type Metodo = "boleto" | "pix";

export function PagamentoModal({
  open,
  onOpenChange,
  empresa,
  descricao,
  valor,
  vencimentoPadrao,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: EmpresaData | null;
  descricao: string;
  valor: number;
  vencimentoPadrao?: string;
}) {
  const [metodo, setMetodo] = useState<Metodo>("boleto");
  const [data, setData] = useState<string>(
    vencimentoPadrao ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [pago, setPago] = useState(false);

  useEffect(() => {
    if (open) {
      setMetodo("boleto");
      setPago(false);
      setData(vencimentoPadrao ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    }
  }, [open, vencimentoPadrao]);

  if (!empresa) return null;

  const valorFmt = valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 sm:rounded-2xl border-0">
        {/* Header verde */}
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
              <h2 className="text-xl font-bold leading-tight">
                {pago ? "Pagamento confirmado" : "Escolha a Forma de Pagamento"}
              </h2>
              <p className="text-sm opacity-90 truncate font-medium">{empresa.nome}</p>
              <p className="text-xs opacity-80 font-mono">CNPJ {empresa.cnpj}</p>
            </div>
          </div>
        </div>

        {pago ? (
          <div className="p-8 flex flex-col items-center text-center space-y-5 bg-white">
            <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {metodo === "pix" ? "PIX gerado!" : "Boleto gerado!"}
              </h3>
              <p className="text-sm text-slate-600 mt-2 max-w-md">
                {metodo === "pix"
                  ? "Escaneie o QR Code no seu app do banco para concluir o pagamento."
                  : `Seu boleto foi gerado com vencimento em ${new Date(data).toLocaleDateString("pt-BR")}.`}
              </p>
            </div>
            {metodo === "pix" ? (
              <div className="h-44 w-44 rounded-2xl border-4 border-emerald-200 bg-white p-3">
                <div className="h-full w-full bg-[linear-gradient(45deg,#000_25%,transparent_25%),linear-gradient(-45deg,#000_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#000_75%),linear-gradient(-45deg,transparent_75%,#000_75%)] bg-[length:12px_12px] rounded-lg opacity-80" />
              </div>
            ) : (
              <div className="w-full max-w-md rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">
                  Código de barras
                </p>
                <p className="font-mono text-xs text-slate-800 break-all">
                  34191.79001 01043.510047 91020.150008 9 98740000098500
                </p>
              </div>
            )}
            <div className="flex gap-2 w-full max-w-md">
              <Button variant="outline" className="flex-1 gap-2">
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Download className="h-4 w-4" /> Baixar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-5 bg-white">
              {/* Status banner */}
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>
                  Forma selecionada:{" "}
                  <strong>{metodo === "boleto" ? "Boleto Bancário" : "PIX"}</strong>. Clique em{" "}
                  <strong>{metodo === "boleto" ? '"Gerar Boleto"' : '"Gerar PIX"'}</strong> para
                  continuar.
                </span>
              </div>

              {/* Cards de pagamento */}
              <div className="grid sm:grid-cols-2 gap-3">
                <MetodoCard
                  ativo={metodo === "boleto"}
                  onClick={() => setMetodo("boleto")}
                  icon={Barcode}
                  titulo="Boleto Bancário"
                  desc="Pague em qualquer banco ou lotérica"
                  destaque={
                    <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                      <Clock className="h-3.5 w-3.5" /> Vencimento configurável
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

              {/* Detalhes */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 p-4 bg-white">
                  <p className="text-sm font-semibold text-slate-900 mb-2">
                    {metodo === "boleto" ? "Data de vencimento do boleto" : "Chave PIX"}
                  </p>
                  {metodo === "boleto" ? (
                    <>
                      <input
                        type="date"
                        value={data}
                        onChange={(e) => setData(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-slate-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                      />
                      <p className="text-xs text-slate-500 mt-2">
                        Escolha o vencimento do boleto (PIX não utiliza esta data).
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="h-10 px-3 rounded-lg border border-slate-300 bg-slate-50 text-sm font-mono flex items-center text-slate-700">
                        cadbrasil@pix.com.br
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Compensação imediata, 24h por dia.
                      </p>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col justify-center items-center text-center">
                  <p className="text-sm text-slate-700">Valor de {descricao}</p>
                  <p className="text-3xl font-bold text-emerald-700 mt-1">{valorFmt}</p>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Pagamento seguro
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50/50 px-6 py-4 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="gap-2"
              >
                <X className="h-4 w-4" /> Cancelar
              </Button>
              <Button
                onClick={() => setPago(true)}
                className="flex-1 h-12 text-base font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {metodo === "boleto" ? (
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
          </>
        )}
      </DialogContent>
    </Dialog>
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
          : "border-slate-200 hover:border-slate-300"
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
