import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  ListChecks,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-header";
import { FrenteCadastroCard } from "@/components/frente-cadastro-card";
import {
  FRENTES_CADASTRO,
  getFrenteCadastro,
  mensagemWhatsAppFrente,
} from "@/lib/frentes-cadastro";
import { buildWhatsAppSuporteUrl } from "@/lib/whatsapp-suporte";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cadastros/$frente")({
  beforeLoad: ({ params }) => {
    const frente = getFrenteCadastro(params.frente);
    if (!frente) throw redirect({ to: "/", replace: true });
    if (frente.rotaPropria) throw redirect({ to: frente.rotaPropria, replace: true });
  },
  head: ({ params }) => {
    const frente = getFrenteCadastro(params.frente);
    return {
      meta: [
        { title: `${frente?.sigla ?? "Cadastro"} — Portal CADBRASIL` },
        { name: "description", content: frente?.resumo ?? "Frentes de cadastro CADBRASIL." },
      ],
    };
  },
  component: FrenteCadastroPage,
});

function FrenteCadastroPage() {
  const { frente: frenteId } = Route.useParams();
  const frente = getFrenteCadastro(frenteId);
  if (!frente) return null;

  const Icon = frente.icon;
  const whatsappUrl = buildWhatsAppSuporteUrl(mensagemWhatsAppFrente(frente));
  const outras = FRENTES_CADASTRO.filter((f) => f.id !== frente.id);

  return (
    <PageContainer className="space-y-6 pb-12">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Início
        </Link>
      </Button>

      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-border/60 bg-gradient-to-br p-6 sm:p-8",
          frente.accent,
        )}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md",
                frente.cor,
              )}
            >
              <Icon className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <Badge variant="outline" className="mb-2 rounded-full bg-background/70">
                {frente.abrangencia}
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{frente.sigla}</h1>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{frente.nome}</p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
                {frente.descricao}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Button asChild size="lg" className="h-12 gap-2 text-base font-semibold">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" />
                Quero me cadastrar
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 gap-2 bg-background/70">
              <a href={frente.siteOficial.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                {frente.siteOficial.label}
              </a>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader className="border-b bg-muted/30 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Por que se cadastrar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ul className="space-y-3">
              {frente.beneficios.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="border-b bg-muted/30 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Documentos necessários
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ul className="space-y-2">
              {frente.documentos.map((d) => (
                <li
                  key={d}
                  className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="border-b bg-muted/30 py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" />
            Como funciona com a CADBRASIL
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ol className="divide-y divide-border">
            {frente.etapas.map((etapa, i) => (
              <li key={etapa.titulo} className="flex items-start gap-3 px-5 py-4">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                    frente.cor,
                  )}
                >
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{etapa.titulo}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{etapa.descricao}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {frente.observacao && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm">{frente.observacao}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/40">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-lg font-bold leading-tight">
              Vamos cuidar do seu cadastro no {frente.sigla}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Fale com um especialista CADBRASIL e receba o passo a passo para a sua empresa.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {frente.id === "pncp" && (
              <Button asChild size="lg" variant="outline" className="h-12 gap-2">
                <Link to="/licitacoes">
                  <Search className="h-4 w-4" />
                  Abrir Radar de Licitações
                </Link>
              </Button>
            )}
            <Button asChild size="lg" className="h-12 gap-2 text-base font-semibold">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" />
                Falar com especialista
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Outras frentes de cadastro
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {outras.map((f) => (
            <FrenteCadastroCard key={f.id} frente={f} compact />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
