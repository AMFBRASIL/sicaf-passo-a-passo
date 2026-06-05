import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  FileSearch,
  ShieldCheck,
  Calculator,
  MessageSquareText,
  FileSignature,
  TrendingUp,
  Upload,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/servicos-ia")({
  head: () => ({
    meta: [
      { title: "Serviços com IA — CADBRASIL" },
      {
        name: "description",
        content: "Ferramentas inteligentes para ler editais, analisar sua empresa e ganhar mais licitações.",
      },
    ],
  }),
  component: ServicosIAPage,
});

type Modulo = {
  id: string;
  titulo: string;
  resumo: string;
  descricao: string;
  icon: typeof Sparkles;
  tag: string;
  destaque?: boolean;
  cta: string;
  ui: "upload" | "analise" | "texto" | "match" | "preco" | "documento";
};

const modulos: Modulo[] = [
  {
    id: "edital",
    titulo: "Leitura de Edital com IA",
    resumo: "Envie o PDF do edital e receba um resumo claro em segundos.",
    descricao:
      "Nossa IA lê o edital inteiro, destaca os pontos mais importantes e diz se sua empresa pode participar.",
    icon: FileSearch,
    tag: "Mais usado",
    destaque: true,
    cta: "Analisar edital agora",
    ui: "upload",
  },
  {
    id: "situacao",
    titulo: "Análise da Situação do Fornecedor",
    resumo: "Diagnóstico completo da sua empresa em 30 segundos.",
    descricao:
      "Verificamos SICAF, certidões, documentos e capacidade técnica para mostrar exatamente o que falta para você vender mais.",
    icon: ShieldCheck,
    tag: "Recomendado",
    cta: "Fazer análise",
    ui: "analise",
  },
  {
    id: "match",
    titulo: "Match de Licitações",
    resumo: "Descubra as licitações com mais chance de você ganhar.",
    descricao:
      "A IA cruza seu histórico, sua região e seu CNAE com milhares de licitações em aberto.",
    icon: TrendingUp,
    tag: "Novo",
    cta: "Ver licitações compatíveis",
    ui: "match",
  },
  {
    id: "preco",
    titulo: "Sugestão de Preço Vencedor",
    resumo: "Saiba o preço ideal para vencer sem perder margem.",
    descricao:
      "Analisamos vencedores anteriores de licitações semelhantes para sugerir o melhor lance.",
    icon: Calculator,
    tag: "Beta",
    cta: "Calcular preço sugerido",
    ui: "preco",
  },
  {
    id: "impugnacao",
    titulo: "Gerador de Impugnação",
    resumo: "Crie uma impugnação profissional em poucos cliques.",
    descricao:
      "Descreva o problema do edital e a IA monta o documento jurídico completo no formato correto.",
    icon: FileSignature,
    tag: "Pro",
    cta: "Gerar impugnação",
    ui: "documento",
  },
  {
    id: "assistente",
    titulo: "Assistente de Licitações",
    resumo: "Tire qualquer dúvida em linguagem simples.",
    descricao:
      "Pergunte sobre SICAF, prazos, documentos, recursos — a IA responde como se fosse seu consultor pessoal.",
    icon: MessageSquareText,
    tag: "24/7",
    cta: "Conversar agora",
    ui: "texto",
  },
];

function ServicosIAPage() {
  const [active, setActive] = useState<Modulo | null>(null);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Sparkles className="h-5 w-5" />}
        title="Serviços com IA"
        subtitle="Use a inteligência da CADBRASIL para vender mais e errar menos."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {modulos.map((m) => (
          <button
            key={m.id}
            onClick={() => setActive(m)}
            className="group text-left"
          >
            <Card
              className={`h-full transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                m.destaque ? "border-primary/40 ring-1 ring-primary/20" : ""
              }`}
            >
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {m.tag}
                  </Badge>
                </div>
                <div>
                  <p className="font-semibold leading-snug">{m.titulo}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{m.resumo}</p>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-primary">
                  Abrir serviço
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <ModuloDialog modulo={active} onClose={() => setActive(null)} />
    </div>
  );
}

function ModuloDialog({ modulo, onClose }: { modulo: Modulo | null; onClose: () => void }) {
  return (
    <Dialog open={!!modulo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {modulo && (
          <>
            <DialogHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <modulo.icon className="h-5 w-5" />
              </div>
              <DialogTitle>{modulo.titulo}</DialogTitle>
              <DialogDescription>{modulo.descricao}</DialogDescription>
            </DialogHeader>

            <div className="py-2">
              {modulo.ui === "upload" && (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center hover:bg-muted/50">
                  <Upload className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm font-medium">Clique para enviar o PDF do edital</p>
                  <p className="text-xs text-muted-foreground">Em até 30 segundos você recebe o resumo</p>
                  <input type="file" accept=".pdf" className="hidden" />
                </label>
              )}

              {modulo.ui === "analise" && (
                <div className="space-y-3 rounded-lg bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Vamos verificar sua empresa agora:</p>
                  <ul className="space-y-1.5 text-muted-foreground">
                    <li>✓ Situação do SICAF</li>
                    <li>✓ Certidões federais, estaduais e municipais</li>
                    <li>✓ Documentos exigidos em licitação</li>
                    <li>✓ Capacidade técnica e financeira</li>
                  </ul>
                </div>
              )}

              {modulo.ui === "match" && (
                <div className="space-y-3 rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
                  Encontramos <span className="font-semibold text-foreground">12 licitações</span> com alta
                  compatibilidade para sua empresa nesta semana.
                </div>
              )}

              {modulo.ui === "preco" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Valor do edital (R$)</p>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Ex.: 280000"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    A IA usa o histórico de licitações semelhantes para sugerir o melhor lance.
                  </p>
                </div>
              )}

              {modulo.ui === "texto" && (
                <Textarea
                  placeholder="Escreva sua dúvida. Ex.: O que é o Nível VI do SICAF?"
                  className="min-h-[110px]"
                />
              )}

              {modulo.ui === "documento" && (
                <Textarea
                  placeholder="Descreva o ponto do edital que você quer impugnar..."
                  className="min-h-[110px]"
                />
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button>
                <Sparkles className="mr-1.5 h-4 w-4" />
                {modulo.cta}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
