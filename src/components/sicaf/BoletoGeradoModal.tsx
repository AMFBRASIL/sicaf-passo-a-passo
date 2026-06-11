import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Barcode, X } from "lucide-react";
import { BoletoGeradoPanel, type BoletoData } from "@/components/sicaf/BoletoGeradoPanel";

export type { BoletoData };

interface BoletoGeradoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: string;
  documento?: string;
  boletoData?: BoletoData | null;
}

export function BoletoGeradoModal({ open, onOpenChange, client, documento, boletoData }: BoletoGeradoModalProps) {
  if (!boletoData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0 z-[100]" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Boleto Gerado</DialogTitle>
        <div className="bg-emerald-600 p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <Barcode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Boleto Gerado</h2>
            {client && <p className="text-emerald-100 text-sm">{client}</p>}
          </div>
        </div>

        <div className="p-6 space-y-4">
          <BoletoGeradoPanel boletoData={boletoData} documento={documento} />
          <Button variant="outline" className="w-full h-11" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
