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
import { EyeOff, X } from "lucide-react";
import { useState } from "react";
import type { AlertaItem } from "./tratar-alerta-modal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alerta: AlertaItem | null;
  onConfirmar: (alerta: AlertaItem, motivo: string) => void;
}

const motivosRapidos = [
  "Cliente já resolveu por fora",
  "Falso positivo / dado desatualizado",
  "Será tratado em outra demanda",
  "Cliente solicitou ignorar",
];

export function IgnorarAlertaModal({ open, onOpenChange, alerta, onConfirmar }: Props) {
  const [motivo, setMotivo] = useState("");

  if (!alerta) return null;

  const confirmar = () => {
    onConfirmar(alerta, motivo.trim());
    setMotivo("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setMotivo("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-muted-foreground" />
            <DialogTitle>Ignorar alerta</DialogTitle>
          </div>
          <DialogDescription>
            Informe o motivo para ignorar <strong>{alerta.tipo}</strong> de{" "}
            <strong>{alerta.cli}</strong>. O registro fica no histórico para auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {motivosRapidos.map((m) => (
              <button
                key={m}
                onClick={() => setMotivo(m)}
                className="text-[11px] rounded-full border bg-card px-2.5 py-1 hover:bg-accent"
              >
                {m}
              </button>
            ))}
          </div>
          <label className="text-sm font-medium">Motivo</label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explique brevemente o motivo de ignorar este alerta..."
            className="min-h-[90px] resize-none"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-1.5">
            <X className="h-4 w-4" /> Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={!motivo.trim()}
            onClick={confirmar}
            className="gap-1.5"
          >
            Confirmar e ignorar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
