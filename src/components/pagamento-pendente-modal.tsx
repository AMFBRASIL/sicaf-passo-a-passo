import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Receipt, ShieldCheck, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PagamentoPendenteModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: { nome: string; cnpj: string } | null;
  onPagar?: () => void;
}

export function PagamentoPendenteModal({
  open,
  onOpenChange,
  empresa,
  onPagar,
}: PagamentoPendenteModalProps) {
  if (!empresa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">Pagamento da taxa SICAF pendente</DialogTitle>
        <div className="relative overflow-hidden">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-warning via-warning/90 to-warning/70 px-6 py-8 text-white relative">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
                  Atenção — Pendência Financeira
                </p>
                <h3 className="text-xl font-bold mt-1 leading-tight">
                  Pagamento da taxa SICAF pendente
                </h3>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Empresa</p>
              <p className="font-semibold mt-1">{empresa.nome}</p>
              <p className="text-xs text-muted-foreground">CNPJ {empresa.cnpj}</p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-warning/10 text-warning-foreground flex items-center justify-center">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Taxa de cadastro não paga</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    O pagamento da taxa CADBRASIL está pendente para esta empresa.
                    Sem ela não conseguimos iniciar a atualização ou cadastro do SICAF.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Como resolver?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Clique em "Pagar taxa SICAF" abaixo para escolher a forma de pagamento.
                    Após a confirmação, liberamos o acesso em até 24 horas.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-warning/5 border border-warning/20 p-4 text-sm flex gap-3">
              <AlertTriangle className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Importante</p>
                <p className="text-muted-foreground mt-0.5">
                  Enquanto a taxa não for paga, esta empresa não poderá participar de licitações
                  nem ter o SICAF atualizado pela CADBRASIL.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2 sm:flex-1">
                <X className="h-4 w-4" /> Fechar
              </Button>
              <Button onClick={onPagar} className="gap-2 sm:flex-1">
                Pagar taxa SICAF <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
