import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TutorialGovTopico } from "@/lib/ajuda-tutoriais-sicaf";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topico: TutorialGovTopico | null;
};

export function AjudaTutorialGovModal({ open, onOpenChange, topico }: Props) {
  const url = topico?.url ?? "";
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!open || !url) return;
    setCarregando(true);
    const t = window.setTimeout(() => setCarregando(false), 1200);
    return () => window.clearTimeout(t);
  }, [open, url, topico?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,1100px)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="text-base leading-snug sm:text-lg">
                {topico?.titulo}
              </DialogTitle>
              {topico?.subtitulo && (
                <p className="mt-0.5 text-xs text-muted-foreground">{topico.subtitulo}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Material oficial do Compras.gov.br (sistema atual)
              </p>
            </div>
            {url && (
              <Button variant="default" size="sm" className="shrink-0 gap-1.5" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir no portal
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 bg-muted/30">
          {url ? (
            <>
              {carregando && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Carregando tutorial oficial…</p>
                </div>
              )}
              <iframe
                key={url}
                title={topico?.titulo ?? "Tutorial SICAF"}
                src={url}
                className="h-[min(72vh,720px)] w-full border-0 bg-white"
                onLoad={() => setCarregando(false)}
              />
            </>
          ) : null}
        </div>

        {url && (
          <div className="flex shrink-0 flex-col gap-2 border-t bg-muted/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-[11px] text-muted-foreground sm:items-center">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0" />
              Se a prévia não aparecer (bloqueio do gov.br), abra o PDF no portal oficial.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5 self-end sm:self-auto" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir em nova aba
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
