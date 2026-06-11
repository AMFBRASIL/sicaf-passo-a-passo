import { Link } from "@tanstack/react-router";
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, ListChecks, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Prioridade = "urgente" | "atencao" | "info";

type Tarefa = {
  id: string;
  prioridade: Prioridade;
  titulo: string;
  descricao: string;
  empresa: string;
  acaoLabel: string;
  link: "/empresas" | "/sicaf" | "/certidoes" | "/pagamentos" | "/assistente";
  linkSearch?: { cnpj?: string };
  tempoEstimado?: string;
};

export type { Tarefa };

const STYLE: Record<Prioridade, { ring: string; chip: string; icon: string; label: string; Icon: typeof AlertTriangle }> = {
  urgente: {
    ring: "border-destructive/40 bg-destructive/[0.04]",
    chip: "bg-destructive text-destructive-foreground",
    icon: "bg-destructive/15 text-destructive",
    label: "Urgente",
    Icon: AlertOctagon,
  },
  atencao: {
    ring: "border-warning/40 bg-warning/[0.04]",
    chip: "bg-warning text-warning-foreground",
    icon: "bg-warning/15 text-warning-foreground",
    label: "Atenção",
    Icon: AlertTriangle,
  },
  info: {
    ring: "border-primary/30 bg-primary/[0.03]",
    chip: "bg-primary/15 text-primary",
    icon: "bg-primary/15 text-primary",
    label: "Sugestão",
    Icon: CheckCircle2,
  },
};

export function CentralTarefas({ tarefas = [] }: { tarefas?: Tarefa[] }) {
  const urgentes = tarefas.filter((t) => t.prioridade === "urgente").length;
  const atencao = tarefas.filter((t) => t.prioridade === "atencao").length;

  if (tarefas.length === 0) {
    return (
      <Card className="overflow-hidden border-primary/20 shadow-soft">
        <CardHeader className="bg-gradient-to-br from-success/10 via-background to-background">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ListChecks className="h-4 w-4 text-success" />
            Central de Tarefas
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nenhuma pendência urgente no momento. Seu portfólio está em dia.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/20 shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-br from-primary/10 via-background to-background">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ListChecks className="h-4 w-4 text-primary" />
            Central de Tarefas
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {urgentes > 0 ? (
              <>
                <strong className="text-destructive">{urgentes} urgente{urgentes > 1 ? "s" : ""}</strong>
                {atencao > 0 && <> · {atencao} de atenção</>}
              </>
            ) : (
              <>Você está em dia — {atencao} tarefa{atencao > 1 ? "s" : ""} pendente{atencao > 1 ? "s" : ""}.</>
            )}
          </p>
        </div>
        <span className="hidden rounded-full bg-background px-3 py-1 text-xs font-semibold shadow-sm sm:inline-block">
          {tarefas.length} no total
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {tarefas.map((t) => {
            const s = STYLE[t.prioridade];
            const Icon = s.Icon;
            return (
              <li key={t.id} className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center", s.ring)}>
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", s.icon)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", s.chip)}>
                      {s.label}
                    </span>
                    <p className="font-semibold leading-tight">{t.titulo}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.empresa} · {t.descricao}
                    {t.tempoEstimado && (
                      <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        ~{t.tempoEstimado}
                      </span>
                    )}
                  </p>
                </div>
                <Button asChild size="sm" variant={t.prioridade === "urgente" ? "default" : "outline"} className="gap-1.5 self-start sm:self-center">
                  <Link to={t.link} search={t.linkSearch}>
                    {t.acaoLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
