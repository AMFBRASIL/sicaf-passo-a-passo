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
import { AlertTriangle, Ban, Loader2 } from "lucide-react";
import { useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  razao: string;
  cnpj: string;
  loading?: boolean;
  onConfirmar: (motivo: string) => void;
}

export function CancelarCnpjModal({
  open,
  onOpenChange,
  razao,
  cnpj,
  loading = false,
  onConfirmar,
}: Props) {
  const [motivo, setMotivo] = useState("");

  const handleConfirmar = () => {
    const m = motivo.trim();
    if (!m) return;
    onConfirmar(m);
  };

  const handleOpenChange = (v: boolean) => {
    if (!loading) {
      if (!v) setMotivo("");
      onOpenChange(v);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <DialogTitle>Cancelar CNPJ</DialogTitle>
          </div>
          <DialogDescription>
            O cliente não deseja mais usar este CNPJ no portal. O cadastro será inativado, o SICAF
            cancelado e cobranças em aberto serão encerradas.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm dark:border-rose-900/50 dark:bg-rose-950/30">
          <p className="font-medium text-rose-900 dark:text-rose-100">{razao}</p>
          <p className="font-mono text-xs text-rose-800/80 dark:text-rose-200/80">{cnpj}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Motivo do cancelamento <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Cliente solicitou encerramento, migrou para outro CNPJ, não vai mais licitar..."
            className="min-h-[88px] resize-none"
            disabled={loading}
          />
          <p className="text-[11px] text-muted-foreground">
            Registrado no histórico do cliente. O usuário pode manter acesso a outros CNPJs do mesmo
            login.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={!motivo.trim() || loading}
            onClick={handleConfirmar}
            className="gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <Ban className="h-4 w-4" />
                Confirmar cancelamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
