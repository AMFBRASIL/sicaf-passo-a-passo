import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  X,
  Info,
  Calendar,
  CheckCircle2,
  AlertTriangle,
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
  onConfirmar: () => void;
}

export function AutorizarPagamentoModal({
  open,
  onOpenChange,
  dados,
  onConfirmar,
}: Props) {
  if (!dados) return null;
  const valorFmt = dados.valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0 sm:rounded-2xl border-0">
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 ring-1 ring-emerald-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">Autorizar Pagamento Manual</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Confirmação de pagamento para <span className="font-medium">{dados.cliente}</span>
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Info className="h-4 w-4 text-sky-600" /> Detalhes do Pagamento
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Campo label="Descrição" value={dados.descricao} />
              <Campo label="Valor" value={<span className="text-emerald-600 font-bold text-base">{valorFmt}</span>} />
              <Campo label="Ano Referência" value={String(dados.ano)} />
              <Campo label="Forma Pagamento" value={dados.forma} />
              <Campo
                label="Status Atual"
                value={
                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-semibold">
                    Pendente
                  </span>
                }
              />
              <Campo label="Data Geração" value={dados.dataGeracao} />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Calendar className="h-4 w-4" /> Após Autorização
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Bloco label="Nova Validade" value={dados.novaValidade} />
              <Bloco label="Dias Renovados" value={`${dados.diasRenovados} dias`} />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
              <Item>Taxa será marcada como <strong>Pago</strong></Item>
              <Item>Renovação pendente será marcada como <strong>Concluída</strong></Item>
              <Item>SICAF será atualizado para <strong>Ativo</strong> até {dados.novaValidade}</Item>
            </ul>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex gap-2 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              <strong>Atenção:</strong> Esta ação autoriza o pagamento manualmente. Certifique-se de
              que o pagamento foi recebido antes de confirmar. Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 mt-4 border-t border-slate-200 flex items-center gap-3 bg-slate-50/40">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button
            onClick={() => {
              onConfirmar();
              onOpenChange(false);
            }}
            className="flex-1 h-11 gap-2 bg-emerald-600 hover:bg-emerald-700 font-semibold"
          >
            <ShieldCheck className="h-4 w-4" /> Autorizar Pagamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
      <div className="text-sm text-slate-900 font-medium mt-0.5">{value}</div>
    </div>
  );
}

function Bloco({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white border border-emerald-100 p-3 text-center">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
      <p className="text-lg font-bold text-emerald-600 mt-1">{value}</p>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
