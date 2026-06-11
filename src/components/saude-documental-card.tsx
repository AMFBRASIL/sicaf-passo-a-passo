import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export type SaudeDocumentalStats = {
  score: number;
  total: number;
  validas: number;
  vencendo: number;
  vencidas: number;
  pendentes?: number;
  ultimaVerificacao?: string | null;
  labelMonitorado?: string;
};

type SaudeDocumentalCardProps = {
  stats: SaudeDocumentalStats;
  cnpj: string;
  showPendentes?: boolean;
  /** Link secundário (padrão: impacto no SICAF) */
  secondaryLink?: {
    to: string;
    label: string;
    search?: { cnpj?: string };
  };
};

export function SaudeDocumentalCard({
  stats,
  cnpj,
  showPendentes = true,
  secondaryLink,
}: SaudeDocumentalCardProps) {
  const sec = secondaryLink ?? {
    to: "/sicaf",
    label: "Ver impacto no SICAF →",
    search: { cnpj },
  };
  const monitorLabel =
    stats.labelMonitorado ||
    `${stats.total} documento${stats.total === 1 ? "" : "s"} monitorado${stats.total === 1 ? "" : "s"}`;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-lift">
      <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-success">
              Monitor ativo
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Saúde documental: {stats.score}%
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {stats.ultimaVerificacao
                ? `Última verificação às ${stats.ultimaVerificacao} · ${monitorLabel}`
                : monitorLabel}
            </p>
          </div>
          <Progress value={stats.score} className="h-2.5" />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              {stats.validas} válida{stats.validas === 1 ? "" : "s"}
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-warning" />
              {stats.vencendo} vencendo
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-danger" />
              {stats.vencidas} vencida{stats.vencidas === 1 ? "" : "s"}
            </Badge>
            {showPendentes && (stats.pendentes ?? 0) > 0 && (
              <Badge variant="secondary" className="gap-1.5">
                <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                {stats.pendentes} pendente{(stats.pendentes ?? 0) === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <Button asChild size="lg" className="gap-2">
            <Link to="/assistente" search={{ cnpj }}>
              <Sparkles className="h-4 w-4" />
              Renovar pendentes com IA
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to={sec.to} search={sec.search}>
              {sec.label}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function calcSaudeDocumentalFromDocs(
  docs: { status: string }[],
): SaudeDocumentalStats {
  const total = docs.length;
  const validas = docs.filter((d) => d.status === "ok").length;
  const vencendo = docs.filter((d) => d.status === "vencendo").length;
  const vencidas = docs.filter((d) => d.status === "vencida").length;
  const pendentes = docs.filter((d) => d.status === "pendente").length;
  const score = total ? Math.round((validas / total) * 100) : 0;

  return {
    score,
    total,
    validas,
    vencendo,
    vencidas,
    pendentes,
  };
}
