import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowDown, Loader2, Percent, RotateCcw, Tag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { mascararInputReal, parseRealToNumber } from "@/lib/money";
import { calcularDescontoTaxa, erroDescontoTaxa } from "@/lib/desconto-taxa";
import {
  aplicarDescontoTaxa,
  fetchDescontoTaxa,
  type DescontoTaxaInfo,
  type DescontoTipo,
} from "@/lib/admin-clientes-api";

export type DescontoFaturaDados = {
  taxaId: number;
  clienteId: number;
  faturaId: string;
  descricao: string;
  cliente: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dados: DescontoFaturaDados | null;
  onAplicado?: () => void;
}

const TIPOS: { id: DescontoTipo; label: string; hint: string }[] = [
  { id: "percentual", label: "Percentual", hint: "% sobre o valor cheio" },
  { id: "valor", label: "Valor (R$)", hint: "Abater um valor fixo" },
  { id: "valor_final", label: "Valor final", hint: "Quanto o cliente vai pagar" },
];

const ATALHOS_PERCENTUAL = [5, 10, 15, 20, 30];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function descricaoDescontoAtual(d: DescontoTaxaInfo) {
  if (d.tipo === "percentual") return `${d.input}% de desconto`;
  if (d.tipo === "valor") return `${brl(d.input)} de desconto`;
  return `valor fixado em ${brl(d.input)}`;
}

export function DescontoFaturaModal({ open, onOpenChange, dados, onAplicado }: Props) {
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [valorCheio, setValorCheio] = useState(0);
  const [valorMinimo, setValorMinimo] = useState(5);
  const [descontoAtual, setDescontoAtual] = useState<DescontoTaxaInfo | null>(null);
  const [valorAtual, setValorAtual] = useState(0);
  const [cobrancasAbertas, setCobrancasAbertas] = useState(0);
  const [tipo, setTipo] = useState<DescontoTipo>("percentual");
  const [percentual, setPercentual] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!open || !dados) return;
    setTipo("percentual");
    setPercentual("");
    setValorTexto("");
    setMotivo("");
    setLoading(true);
    fetchDescontoTaxa(dados.taxaId, dados.clienteId)
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error || "Não foi possível carregar a taxa");
          onOpenChange(false);
          return;
        }
        setValorCheio(res.valorCheio ?? 0);
        setValorAtual(res.valorAtual ?? 0);
        setValorMinimo(res.valorMinimo ?? 5);
        setDescontoAtual(res.desconto ?? null);
        setCobrancasAbertas(res.cobrancasAbertas?.length ?? 0);
        if (res.desconto) {
          setTipo(res.desconto.tipo);
          if (res.desconto.tipo === "percentual")
            setPercentual(String(res.desconto.input).replace(".", ","));
          else setValorTexto(mascararInputReal(String(Math.round(res.desconto.input * 100))));
          setMotivo(res.desconto.motivo || "");
        }
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar taxa");
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, dados, onOpenChange]);

  const input = useMemo(() => {
    if (tipo === "percentual") {
      const n = parseFloat(percentual.replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }
    return parseRealToNumber(valorTexto) ?? 0;
  }, [tipo, percentual, valorTexto]);

  const calc = useMemo(
    () => calcularDescontoTaxa(valorCheio, tipo, input),
    [valorCheio, tipo, input],
  );

  const erro = useMemo(
    () => erroDescontoTaxa(valorCheio, tipo, input, valorMinimo),
    [input, tipo, valorCheio, valorMinimo],
  );

  const podeAplicar = !loading && !salvando && input > 0 && !erro && motivo.trim().length >= 3;

  const executar = async (acao: DescontoTipo | "remover") => {
    if (!dados) return;
    setSalvando(true);
    try {
      const res = await aplicarDescontoTaxa({
        taxaId: dados.taxaId,
        clienteId: dados.clienteId,
        tipo: acao,
        valor: acao === "remover" ? undefined : input,
        motivo: acao === "remover" ? undefined : motivo.trim(),
      });
      if (!res.ok) {
        toast.error(res.error || "Não foi possível aplicar o desconto");
        return;
      }
      toast.success(res.message || "Desconto aplicado");
      onAplicado?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar desconto");
    } finally {
      setSalvando(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (salvando) return;
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-amber-600" />
            <DialogTitle>Desconto na fatura</DialogTitle>
          </div>
          <DialogDescription>
            {dados ? `${dados.cliente} · ${dados.faturaId} · ${dados.descricao}` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando valores...
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {descontoAtual && (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Desconto atual: {descricaoDescontoAtual(descontoAtual)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cobrando hoje {brl(valorAtual)}
                    {descontoAtual.motivo ? ` · ${descontoAtual.motivo}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 gap-1 text-xs"
                  disabled={salvando}
                  onClick={() => void executar("remover")}
                >
                  <RotateCcw className="h-3 w-3" /> Remover
                </Button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTipo(t.id);
                    setPercentual("");
                    setValorTexto("");
                  }}
                  className={`rounded-lg border p-2.5 text-left transition ${
                    tipo === t.id
                      ? "border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 dark:bg-amber-950/30"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.hint}</p>
                </button>
              ))}
            </div>

            {tipo === "percentual" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Percentual de desconto</label>
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    value={percentual}
                    onChange={(e) => setPercentual(e.target.value.replace(/[^\d,.]/g, ""))}
                    placeholder="Ex: 10"
                    className="pr-9 text-lg font-semibold"
                    autoFocus
                  />
                  <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ATALHOS_PERCENTUAL.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      size="sm"
                      variant={input === p ? "default" : "outline"}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setPercentual(String(p))}
                    >
                      {p}%
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {tipo === "valor" ? "Valor do desconto" : "Valor que o cliente vai pagar"}
                </label>
                <Input
                  inputMode="numeric"
                  value={valorTexto}
                  onChange={(e) => setValorTexto(mascararInputReal(e.target.value))}
                  placeholder="R$ 0,00"
                  className="text-lg font-semibold"
                  autoFocus
                />
              </div>
            )}

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Valor cheio</span>
                <span
                  className={`tabular-nums ${calc.desconto > 0 ? "line-through text-muted-foreground" : "font-medium"}`}
                >
                  {brl(valorCheio)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Desconto</span>
                <span className="tabular-nums font-medium text-amber-700 dark:text-amber-400">
                  {calc.desconto > 0
                    ? `− ${brl(calc.desconto)} (${calc.percentual.toLocaleString("pt-BR")}%)`
                    : "—"}
                </span>
              </div>
              <div className="my-3 flex items-center gap-2 text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <ArrowDown className="h-3.5 w-3.5" />
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex items-end justify-between">
                <span className="text-sm font-medium">Valor do novo boleto</span>
                <span
                  className={`text-3xl font-bold tabular-nums tracking-tight ${
                    erro ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {brl(calc.final)}
                </span>
              </div>
              {erro && <p className="mt-2 text-xs text-rose-600">{erro}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo do desconto</label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Negociação comercial — cliente não aceitou o valor cheio"
                className="min-h-[64px] resize-none"
                maxLength={255}
              />
            </div>

            {cobrancasAbertas > 0 && (
              <div className="flex gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-sky-800 dark:text-sky-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {cobrancasAbertas === 1
                    ? "O boleto atual"
                    : `As ${cobrancasAbertas} cobranças atuais`}{" "}
                  de {brl(valorAtual)}{" "}
                  {cobrancasAbertas === 1 ? "será cancelado" : "serão canceladas"} na Efí e um novo
                  boleto de <strong>{brl(calc.final)}</strong> será emitido. O link de pagamento do
                  cliente continua o mesmo.
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={salvando}
            className="gap-1.5"
          >
            <X className="h-4 w-4" /> Voltar
          </Button>
          <Button
            disabled={!podeAplicar}
            onClick={() => void executar(tipo)}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
            Aplicar e emitir boleto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
