import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Search, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/concluido")({
  head: () => ({
    meta: [
      { title: "Parabéns! — CADBRASIL" },
      { name: "description", content: "Sua empresa está apta para participar de licitações." },
    ],
  }),
  component: DonePage,
});

const itens = [
  "SICAF atualizado",
  "Certidões válidas",
  "CRC ativo",
  "Monitoramento ativo",
  "Assistente habilitado",
];

function DonePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-10 sm:py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success text-success-foreground shadow-lift">
        <Trophy className="h-10 w-10" />
      </div>
      <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">🎉 Parabéns, João!</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Sua empresa está apta para participar de licitações públicas.
      </p>

      <Card className="mt-8 w-full text-left">
        <CardContent className="p-6">
          <p className="mb-4 text-sm font-semibold text-muted-foreground">Resumo do que foi feito</p>
          <ul className="space-y-3">
            {itens.map((i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="h-4 w-4" />
                </div>
                <span className="font-medium">{i}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button asChild size="lg" className="mt-8 h-16 px-10 text-lg font-semibold shadow-lift">
        <a href="#">
          <Search className="mr-2 h-5 w-5" />
          Procurar Licitações Agora
        </a>
      </Button>

      <Button asChild variant="link" className="mt-4">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
