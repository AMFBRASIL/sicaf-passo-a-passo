import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/page-header";
import { AssistantCard } from "@/components/assistant-card";
import {
  Rocket,
  PlayCircle,
  Headphones,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  ShieldCheck,
  FileText,
  Gauge,
  Gavel,
  Bell,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — Portal CADBRASIL" },
      { name: "description", content: "Acompanhe o status do seu cadastro e o próximo passo da sua jornada." },
    ],
  }),
  component: HomePage,
});

const steps = [
  { label: "Cadastro realizado", status: "done" as const },
  { label: "Documentação enviada", status: "done" as const },
  { label: "Atualização SICAF pendente", status: "current" as const },
  { label: "Processo concluído", status: "pending" as const },
];

const certidoes = [
  { nome: "Federal", status: "ok" as const, validade: "12/08/2026" },
  { nome: "Estadual", status: "warn" as const, validade: "30/12/2025" },
  { nome: "Municipal", status: "ok" as const, validade: "05/04/2026" },
  { nome: "FGTS", status: "ok" as const, validade: "18/02/2026" },
  { nome: "Trabalhista", status: "danger" as const, validade: "Vencida" },
];

function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Greeting */}
          <div>
            <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Olá, João 👋
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Seu processo está em andamento. Falta pouco para sua empresa estar 100% apta.
            </p>
          </div>

          {/* Status timeline */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Status atual</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {steps.map((s) => (
                  <li key={s.label} className="flex items-center gap-3">
                    {s.status === "done" && <CheckCircle2 className="h-5 w-5 text-success" />}
                    {s.status === "current" && <Clock className="h-5 w-5 text-warning" />}
                    {s.status === "pending" && <Circle className="h-5 w-5 text-muted-foreground/50" />}
                    <span
                      className={
                        s.status === "current"
                          ? "font-medium text-foreground"
                          : s.status === "pending"
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }
                    >
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Next step — big CTA */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lift">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider opacity-80">Próximo passo</p>
                <h2 className="mt-1 text-2xl font-bold">Atualize seu SICAF agora</h2>
                <p className="mt-1 text-sm opacity-90">
                  Leva cerca de 5 minutos. Vamos te guiar em cada etapa.
                </p>
              </div>
              <Button asChild size="lg" variant="secondary" className="h-14 px-6 text-base font-semibold shadow-lg">
                <Link to="/empresas">
                  <Rocket className="mr-2 h-5 w-5" />
                  Atualizar SICAF
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Resumo SICAF + Certidões */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Meu SICAF / CRC</CardTitle>
                <ShieldCheck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Válido</div>
                <p className="mt-1 text-xs text-muted-foreground">até 28/02/2026</p>
                <StatusBadge status="warn">Atualização recomendada</StatusBadge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Certidões</CardTitle>
                <FileText className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5 documentos</div>
                <p className="mt-1 text-xs text-muted-foreground">1 vencida · 1 vence em breve</p>
                <Button asChild variant="link" className="h-auto p-0 text-xs">
                  <Link to="/certidoes">Ver detalhes →</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Certidões breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Situação das certidões</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {certidoes.map((c) => (
                  <li key={c.nome} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-medium">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">Validade: {c.validade}</p>
                    </div>
                    <StatusBadge status={c.status}>
                      {c.status === "ok" ? "Válida" : c.status === "warn" ? "Vence em breve" : "Vencida"}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Missões mini */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                🎯 O que falta para participar de licitações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso geral</span>
                <span className="font-semibold text-primary">85% concluído</span>
              </div>
              <Progress value={85} className="h-3" />
              <Button asChild variant="outline" className="w-full">
                <Link to="/empresas">Ver checklist completo</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar with assistant + help */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <AssistantCard />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Precisa de ajuda?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link to="/ajuda">
                  <Bot className="mr-2 h-4 w-4 text-primary" />
                  Assistente Virtual
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link to="/suporte">
                  <Headphones className="mr-2 h-4 w-4 text-primary" />
                  Abrir Chamado
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start">
                <PlayCircle className="mr-2 h-4 w-4 text-primary" />
                Ver Vídeo Explicativo
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
