import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  X,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Upload,
  FileText,
  Image as ImageIcon,
  CreditCard,
  QrCode,
  Receipt,
} from "lucide-react";

export interface AutorizarPagamentoDados {
  descricao: string;
  cliente: string;
  valor: number;
  ano: number;
  forma: "Boleto" | "PIX";
  dataGeracao: string;
  novaValidade: string;
  diasRenovados: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dados: AutorizarPagamentoDados | null;
  onConfirmar: (payload: { comprovante: File; observacoes?: string }) => void | Promise<void>;
}

const ACCEPT = "application/pdf,image/png,image/jpeg,image/jpg,image/webp,image/gif";
const MAX_MB = 10;

export function AutorizarPagamentoModal({
  open,
  onOpenChange,
  dados,
  onConfirmar,
}: Props) {
  const [processando, setProcessando] = useState(false);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setComprovante(null);
      setObservacoes("");
      setProcessando(false);
    }
  }, [open]);

  if (!dados) return null;

  const valorFmt = dados.valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo ${MAX_MB} MB.`);
      return;
    }
    setComprovante(file);
  };

  const isPdf = comprovante?.type === "application/pdf";
  const podeConfirmar = !!comprovante && !processando;
  const FormaIcon = dados.forma === "PIX" ? QrCode : Receipt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[920px] w-[95vw] p-0 gap-0 overflow-hidden sm:rounded-2xl border-0 shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 px-6 py-5 text-white">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-white/5 blur-xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold tracking-tight">Autorizar Pagamento Manual</h2>
              <p className="mt-1 text-sm text-white/85 line-clamp-2">{dados.cliente}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge className="border-0 bg-white/20 text-white hover:bg-white/25">
                  {dados.descricao}
                </Badge>
                <Badge className="border-0 bg-white/20 text-white hover:bg-white/25 gap-1">
                  <FormaIcon className="h-3 w-3" />
                  {dados.forma}
                </Badge>
                <Badge className="border-0 bg-amber-400/30 text-amber-50">Pendente</Badge>
              </div>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="text-[10px] uppercase tracking-widest text-white/70">Valor</p>
              <p className="text-3xl font-bold tabular-nums">{valorFmt}</p>
            </div>
          </div>
        </div>

        {/* Body — 2 colunas */}
        <div className="grid min-h-0 lg:grid-cols-[1fr_1.05fr]">
          {/* Coluna esquerda: resumo */}
          <div className="space-y-4 border-b border-border/60 bg-muted/20 p-6 lg:border-b-0 lg:border-r">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resumo da cobrança
            </p>

            <div className="grid grid-cols-2 gap-3 sm:hidden">
              <StatCard label="Valor" value={valorFmt} highlight />
              <StatCard label="Forma" value={dados.forma} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Ano referência" value={String(dados.ano)} />
              <StatCard label="Gerado em" value={dados.dataGeracao} />
              <StatCard label="Forma" value={dados.forma} className="hidden sm:flex" />
              <StatCard label="Status" value="Pendente" tone="warn" className="hidden sm:flex" />
            </div>

            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <Calendar className="h-4 w-4" />
                Após autorização
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-100 bg-white p-3 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Nova validade
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">{dados.novaValidade}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-white p-3 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Dias renovados
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">{dados.diasRenovados} dias</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <CheckItem>Taxa marcada como <strong>Pago</strong></CheckItem>
                <CheckItem>Comprovante salvo no histórico</CheckItem>
                <CheckItem>SICAF <strong>Ativo</strong> até {dados.novaValidade}</CheckItem>
              </ul>
            </div>

            <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <p>
                <strong>Atenção:</strong> valide o comprovante antes de confirmar. Esta ação não pode ser
                desfeita.
              </p>
            </div>
          </div>

          {/* Coluna direita: comprovante + obs */}
          <div className="flex flex-col p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Comprovante de pagamento</p>
                  <p className="text-xs text-muted-foreground">Obrigatório para concluir</p>
                </div>
              </div>
              <Badge variant="destructive" className="text-[10px]">Obrigatório</Badge>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {!comprovante ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4 flex min-h-[200px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/25 bg-primary/[0.03] px-6 py-10 transition hover:border-primary/45 hover:bg-primary/[0.06]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Upload className="h-7 w-7" />
                </div>
                <p className="mt-4 text-base font-semibold text-foreground">
                  Arraste ou clique para anexar
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  PDF, PNG, JPG ou WEBP — máx. {MAX_MB} MB
                </p>
              </button>
            ) : (
              <div className="mt-4 flex min-h-[200px] flex-col justify-center rounded-xl border border-primary/20 bg-primary/[0.04] p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-border/60">
                    {isPdf ? (
                      <FileText className="h-8 w-8 text-red-500" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-sky-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">{comprovante.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {(comprovante.size / 1024).toFixed(0)} KB · Pronto para envio
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Arquivo válido
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setComprovante(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                  >
                    Trocar
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-5 flex-1">
              <label className="text-sm font-medium text-foreground">Observações</label>
              <p className="text-xs text-muted-foreground">Opcional — referência do PIX, horário, etc.</p>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: PIX recebido em 10/06/2026 às 14h32..."
                className="mt-2 min-h-[88px] resize-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-3 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground hidden sm:block">
            O comprovante ficará vinculado à taxa e ao cliente no banco de dados.
          </p>
          <div className="flex w-full gap-3 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 flex-1 sm:flex-none sm:min-w-[120px]"
              disabled={processando}
            >
              Cancelar
            </Button>
            <Button
              disabled={!podeConfirmar}
              onClick={() => {
                if (!comprovante) return;
                void (async () => {
                  setProcessando(true);
                  try {
                    await onConfirmar({
                      comprovante,
                      observacoes: observacoes.trim() || undefined,
                    });
                    onOpenChange(false);
                  } catch {
                    /* mantém modal aberto */
                  } finally {
                    setProcessando(false);
                  }
                })();
              }}
              className="h-11 flex-1 gap-2 bg-emerald-600 px-8 font-semibold hover:bg-emerald-700 disabled:opacity-50 sm:min-w-[220px]"
            >
              {processando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Autorizando…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Autorizar pagamento
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  label,
  value,
  highlight,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "warn";
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-3.5 ${highlight ? "border-emerald-200 bg-emerald-50/40" : "border-border/60"} ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-semibold tabular-nums ${
          highlight ? "text-xl text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
