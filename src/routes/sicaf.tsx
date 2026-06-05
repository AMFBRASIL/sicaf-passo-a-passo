import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, ArrowRight, PlayCircle, CheckCircle2, Lock, FileCheck, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/sicaf")({
  head: () => ({
    meta: [
      { title: "Atualizar SICAF — CADBRASIL" },
      { name: "description", content: "Atualize seu SICAF passo a passo com o assistente CADBRASIL." },
    ],
  }),
  component: SicafPage,
});

const passos = [
  {
    n: 1,
    titulo: "Verificar certificado digital",
    descricao: "Vamos checar se seu certificado e-CNPJ A1 ou A3 está conectado.",
    status: "done" as const,
  },
  {
    n: 2,
    titulo: "Conectar ao Compras.gov.br",
    descricao: "O assistente faz login automaticamente para você.",
    status: "done" as const,
  },
  {
    n: 3,
    titulo: "Atualizar Nível III — Receita Federal",
    descricao: "Encontramos documentos que precisam ser atualizados.",
    status: "current" as const,
  },
  {
    n: 4,
    titulo: "Atualizar Nível IV — Qualificação técnica",
    descricao: "Envie ou confirme os documentos da sua atividade.",
    status: "pending" as const,
  },
  {
    n: 5,
    titulo: "Validar e enviar",
    descricao: "Confirmação final — você pronto para licitar.",
    status: "pending" as const,
  },
];

function SicafPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="Atualizar SICAF"
        subtitle="Não se preocupe — vamos fazer juntos, um passo de cada vez."
      />

      <Card className="mt-6 border-warning/30 bg-warning/5">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
          <div className="text-sm">
            <p className="font-semibold">
              Encontramos documentos que precisam ser atualizados para que sua empresa continue apta a participar de licitações.
            </p>
            <p className="mt-1 text-muted-foreground">
              Isso leva cerca de 5 minutos. Clique em "Resolver agora" abaixo.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Progresso da atualização</CardTitle>
          <span className="text-sm font-semibold text-primary">2 de 5 etapas</span>
        </CardHeader>
        <CardContent>
          <Progress value={40} className="h-3" />
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {passos.map((p) => (
          <Card
            key={p.n}
            className={
              p.status === "current"
                ? "border-primary/40 shadow-lift"
                : p.status === "done"
                ? "bg-muted/40"
                : "opacity-70"
            }
          >
            <CardContent className="flex items-start gap-4 p-5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
                  p.status === "done"
                    ? "bg-success text-success-foreground"
                    : p.status === "current"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : p.status === "pending" ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  p.n
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{p.titulo}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{p.descricao}</p>
                {p.status === "current" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm">
                      Resolver agora
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <PlayCircle className="mr-1.5 h-4 w-4" />
                      Ver vídeo (2 min)
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border-dashed">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <FileCheck className="h-5 w-5 text-primary" />
          <span>
            Travou em alguma etapa?{" "}
            <Link to="/suporte" className="font-medium text-primary underline-offset-2 hover:underline">
              Fale com um especialista
            </Link>{" "}
            — respondemos em minutos.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
