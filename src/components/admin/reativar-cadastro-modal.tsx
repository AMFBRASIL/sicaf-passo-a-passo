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
import { RotateCcw, Loader2 } from "lucide-react";
import { useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  razao: string;
  cnpj: string;
  loading?: boolean;
  onConfirmar: (motivo: string) => void;
}

export function ReativarCadastroModal({
  open,
  onOpenChange,
  razao,
  cnpj,
  loading = false,
  onConfirmar,
}: Props) {
  const [motivo, setMotivo] = useState("");

  const handleConfirmar = () => {
    onConfirmar(motivo.trim() || "Cliente solicitou retorno / reativação pela equipe");
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
            <RotateCcw className="h-5 w-5 text-emerald-600" />
            <DialogTitle>Reativar cadastro</DialogTitle>
          </div>
          <DialogDescription>
            O CNPJ voltará ao status <strong>Ativo</strong>. Se o SICAF estiver cancelado, ele
            será colocado em <strong>Pendente</strong> para continuar o processo. Taxas e
            manutenção não são recriadas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">{razao}</p>
          <p className="font-mono text-xs text-emerald-800/80 dark:text-emerald-200/80">{cnpj}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Motivo da reativação (opcional)</label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: Cliente voltou a licitar, pediu reativação..."
            className="min-h-[80px] resize-none"
            disabled={loading}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Voltar
          </Button>
          <Button className="gap-1.5" onClick={handleConfirmar} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reativando...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" /> Reativar Cadastro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
