import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";

export type LinkPagamentoFaturaDados = {
  faturaId: string;
  descricao: string;
  valor: number;
  vencimento: string;
  payCode: string;
  payLink: string;
  cliente: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dados: LinkPagamentoFaturaDados | null;
}

export function LinkPagamentoFaturaModal({ open, onOpenChange, dados }: Props) {
  const copyLink = async () => {
    if (!dados?.payLink) {
      toast.error("Link de pagamento indisponível");
      return;
    }
    try {
      await navigator.clipboard.writeText(dados.payLink);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-sky-600" />
            <DialogTitle>Link de pagamento</DialogTitle>
          </div>
          <DialogDescription>
            Página pública do cliente com boleto e demais guias pendentes.
          </DialogDescription>
        </DialogHeader>

        {dados ? (
          <div className="space-y-4 py-1">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium">{dados.cliente}</p>
              <p className="text-muted-foreground">
                {dados.faturaId} · {dados.descricao} ·{" "}
                {dados.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="text-xs text-muted-foreground">Vencimento: {dados.vencimento}</p>
            </div>

            {dados.payLink ? (
              <>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">URL de pagamento</p>
                  <div className="rounded-lg border bg-slate-50 p-3 text-xs font-mono break-all dark:bg-slate-900/40">
                    {dados.payLink}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void copyLink()}>
                    <Copy className="h-3.5 w-3.5" /> Copiar link
                  </Button>
                  <Button size="sm" className="gap-1.5" asChild>
                    <a href={dados.payLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir página
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Código: <strong className="font-mono">{dados.payCode}</strong>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Link indisponível para esta fatura.</p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
