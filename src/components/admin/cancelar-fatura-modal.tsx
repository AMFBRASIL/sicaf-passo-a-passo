import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  faturaId: string | null;
  loading?: boolean;
  onConfirmar: (faturaId: string, motivo: string) => void;
}

export function CancelarFaturaModal({
  open,
  onOpenChange,
  faturaId,
  loading = false,
  onConfirmar,
}: Props) {
  const [motivo, setMotivo] = useState("");

  const handleConfirmar = () => {
    if (!faturaId || !motivo.trim() || loading) return;
    onConfirmar(faturaId, motivo.trim());
    setMotivo("");
  };

  const handleOpenChange = (v: boolean) => {
    if (loading) return;
    if (!v) setMotivo("");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <DialogTitle>Cancelar Fatura</DialogTitle>
          </div>
          <DialogDescription>
            Informe o motivo do cancelamento da fatura {faturaId ?? ""}.
            Essa ação poderá ser consultada no histórico posteriormente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <label className="text-sm font-medium">Motivo do cancelamento</label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Cliente solicitou cancelamento, pagamento duplicado, erro na geração..."
            className="min-h-[80px] resize-none"
            disabled={loading}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading} className="gap-1.5">
            <X className="h-4 w-4" /> Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={!motivo.trim() || loading}
            onClick={handleConfirmar}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
