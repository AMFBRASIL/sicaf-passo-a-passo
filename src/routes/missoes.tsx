import { createFileRoute, Link } from "@tanstack/react-router";
import { Target, Rocket, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/missoes")({
  head: () => ({
    meta: [
      { title: "O que falta? — CADBRASIL" },
      { name: "description", content: "Veja exatamente o que falta para sua empresa participar de licitações." },
    ],
  }),
  component: MissoesPage,
});

const itens = [
  { feito: true, label: "Cadastro realizado" },
  { feito: true, label: "Documentos enviados" },
  { feito: true, label: "Certificado digital validado" },
  { feito: true, label: "CRC ativo no SICAF" },
  { feito: false, label: "Atualizar Nível III (Receita Federal)", cta: "/sicaf" },
  { feito: false, label: "Atualizar Nível IV (Qualificação técnica)", cta: "/sicaf" },
  { feito: false, label: "Validar Certidão Trabalhista", cta: "/certidoes" },
  { feito: false, label: "Finalizar processo e iniciar busca de licitações" },
];

function MissoesPage() {
  const done = itens.filter((i) => i.feito).length;
  const pct = Math.round((done / itens.length) * 100);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Target className="h-5 w-5" />}
        title="O que falta para participar de licitações"
        subtitle="Sua missão completa em uma lista clara."
      />

      <Card className="mt-6 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Progresso geral</p>
              <p className="text-4xl font-bold text-primary">{pct}%</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {done} de {itens.length} concluídos
            </p>
          </div>
          <Progress value={pct} className="mt-4 h-3" />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {itens.map((it, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                it.feito ? "border-success/20 bg-success/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                {it.feito ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                )}
                <span className={it.feito ? "text-muted-foreground line-through" : "font-medium"}>
                  {it.label}
                </span>
              </div>
              {!it.feito && it.cta && (
                <Button asChild size="sm" variant="outline">
                  <Link to={it.cta}>Resolver</Link>
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-center">
        <Button asChild size="lg" className="h-14 px-8 text-base">
          <Link to="/sicaf">
            <Rocket className="mr-2 h-5 w-5" />
            Continuar próximo passo
          </Link>
        </Button>
      </div>
    </div>
  );
}
