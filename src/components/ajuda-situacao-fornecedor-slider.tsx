import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

export const PASSOS_SITUACAO_FORNECEDOR = [
  {
    id: "01",
    titulo: "Acesse Minhas Empresas",
    descricao:
      "No menu lateral da página inicial, clique em Minhas Empresas para ver todos os CNPJs cadastrados.",
    imagem: "/ajuda/situacao-fornecedor/passo-01.png",
  },
  {
    id: "02",
    titulo: "Abra o painel SICAF da empresa",
    descricao:
      "Na lista, localize a empresa e clique no botão verde SICAF para acessar o acompanhamento do cadastro.",
    imagem: "/ajuda/situacao-fornecedor/passo-02.png",
  },
  {
    id: "03",
    titulo: "Regularize a documentação (se necessário)",
    descricao:
      "Se houver certidões pendentes, use Renovar pendentes com IA na etapa de documentação antes de enviar a situação.",
    imagem: "/ajuda/situacao-fornecedor/passo-03.png",
  },
  {
    id: "04",
    titulo: "Envie a Situação do Fornecedor (PDF)",
    descricao:
      "Na área Situação do Fornecedor, arraste o PDF emitido no Compras.gov.br ou clique para selecionar o arquivo (até 10 MB).",
    imagem: "/ajuda/situacao-fornecedor/passo-04.png",
  },
] as const;

export function AjudaSituacaoFornecedorSlider({ className }: { className?: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [passoAtual, setPassoAtual] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setPassoAtual(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Como colocar a Situação Fornecedor</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Passo a passo visual para enviar o PDF da Situação do Fornecedor e atualizar os níveis SICAF.
          </p>
        </div>
      </div>

      <Carousel setApi={setApi} opts={{ loop: false }} className="w-full">
        <CarouselContent>
          {PASSOS_SITUACAO_FORNECEDOR.map((passo, index) => (
            <CarouselItem key={passo.id}>
              <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                <div className="border-b border-border bg-card px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    Passo {index + 1} de {PASSOS_SITUACAO_FORNECEDOR.length}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">{passo.titulo}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{passo.descricao}</p>
                </div>
                <div className="flex items-center justify-center bg-muted/50 p-2 sm:p-4">
                  <img
                    src={passo.imagem}
                    alt={passo.titulo}
                    className="max-h-[min(52vh,520px)] w-full rounded-lg object-contain shadow-sm"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2 border-border bg-background/95 shadow-md" />
        <CarouselNext className="right-2 border-border bg-background/95 shadow-md" />
      </Carousel>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {PASSOS_SITUACAO_FORNECEDOR.map((passo, index) => (
          <button
            key={passo.id}
            type="button"
            aria-label={`Ir para passo ${index + 1}: ${passo.titulo}`}
            aria-current={passoAtual === index ? "step" : undefined}
            onClick={() => api?.scrollTo(index)}
            className={cn(
              "h-2 rounded-full transition-all",
              passoAtual === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
