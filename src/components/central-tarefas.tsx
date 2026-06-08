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
  tempoEstimado?: string;
};

const TAREFAS: Tarefa[] = [
  {
    id: "t1",
    prioridade: "urgente",
    titulo: "Pagar taxa CADBRASIL",
    descricao: "Liberação do SICAF depende deste pagamento.",
    empresa: "Comércio Atlântico ME",
    acaoLabel: "Ir para pagamento",
    link: "/empresas",
    tempoEstimado: "2 min",
  },
  {
    id: "t2",
    prioridade: "urgente",
    titulo: "Renovar Certidão Trabalhista",
    descricao: "Vencida há 3 dias — risco de bloqueio em editais.",
    empresa: "Serviços Modelo EIRELI",
    acaoLabel: "Renovar agora",
    link: "/certidoes",
    tempoEstimado: "5 min",
  },
  {
    id: "t3",
    prioridade: "atencao",
    titulo: "SICAF expira em 12 dias",
    descricao: "Atualize agora para evitar perder oportunidades.",
    empresa: "Tech Solutions Brasil",
    acaoLabel: "Atualizar SICAF",
    link: "/sicaf",
    tempoEstimado: "12 min",
  },
  {
    id: "t4",
    prioridade: "atencao",
    titulo: "Certidão Estadual vence em 5 dias",
    descricao: "Antecipe a renovação para evitar impactos.",
    empresa: "Comércio Atlântico ME",
    acaoLabel: "Ver certidão",
    link: "/certidoes",
    tempoEstimado: "5 min",
  },
  {
    id: "t5",
    prioridade: "info",
    titulo: "Habilitar Nível V e VI",
    descricao: "Complete o cadastro para concorrer em mais editais.",
    empresa: "Construtora Horizonte LTDA",
    acaoLabel: "Concluir cadastro",
    link: "/sicaf",
    tempoEstimado: "8 min",
  },
];

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

export function CentralTarefas() {
  const urgentes = TAREFAS.filter((t) => t.prioridade === "urgente").length;
  const atencao = TAREFAS.filter((t) => t.prioridade === "atencao").length;

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
          {TAREFAS.length} no total
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {TAREFAS.map((t) => {
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
                  <Link to={t.link}>
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
