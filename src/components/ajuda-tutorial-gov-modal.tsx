import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import type { TutorialGovTopico } from "@/lib/ajuda-tutoriais-sicaf";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topico: TutorialGovTopico | null;
};

export function AjudaTutorialGovModal({ open, onOpenChange, topico }: Props) {
  const [api, setApi] = useState<CarouselApi>();
  const [passoAtual, setPassoAtual] = useState(0);

  const multiplo = (topico?.urls.length ?? 0) > 1;
  const urlAtual = topico?.urls[passoAtual] ?? topico?.urls[0] ?? "";

  const onSelect = useCallback(() => {
    if (!api) return;
    setPassoAtual(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!open) {
      setPassoAtual(0);
      return;
    }
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect, open]);

  useEffect(() => {
    if (open) setPassoAtual(0);
  }, [open, topico?.id]);

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
              {multiplo && topico && (
                <p className="mt-1 text-xs font-medium text-primary">
                  Etapa {passoAtual + 1} de {topico.urls.length}
                </p>
              )}
            </div>
            {urlAtual && (
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                <a href={urlAtual} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir em nova aba
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 bg-muted/30">
          {topico && multiplo ? (
            <>
              <Carousel setApi={setApi} opts={{ loop: false }} className="h-full w-full">
                <CarouselContent className="ml-0 h-[min(72vh,720px)]">
                  {topico.urls.map((url, index) => (
                    <CarouselItem key={url} className="basis-full pl-0">
                      <iframe
                        title={`${topico.titulo} — etapa ${index + 1}`}
                        src={url}
                        className="h-[min(72vh,720px)] w-full border-0 bg-white"
                        loading={index === 0 ? "eager" : "lazy"}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-3 border-border bg-background/95 shadow-md" />
                <CarouselNext className="right-3 border-border bg-background/95 shadow-md" />
              </Carousel>

              <div className="flex flex-wrap items-center justify-center gap-2 border-t bg-card px-4 py-3">
                {topico.urls.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Ir para etapa ${index + 1}`}
                    aria-current={passoAtual === index ? "step" : undefined}
                    onClick={() => api?.scrollTo(index)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      passoAtual === index
                        ? "w-6 bg-primary"
                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                    )}
                  />
                ))}
              </div>
            </>
          ) : urlAtual ? (
            <iframe
              key={urlAtual}
              title={topico?.titulo ?? "Tutorial SICAF"}
              src={urlAtual}
              className="h-[min(72vh,720px)] w-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
