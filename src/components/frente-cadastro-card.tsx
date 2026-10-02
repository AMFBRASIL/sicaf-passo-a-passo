import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FrenteCadastro } from "@/lib/frentes-cadastro";

export function FrenteCadastroCard({
  frente,
  compact = false,
}: {
  frente: FrenteCadastro;
  compact?: boolean;
}) {
  const Icon = frente.icon;

  const card = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden border-2 border-border/70 bg-gradient-to-br shadow-soft transition-all",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        frente.accent,
      )}
    >
      <CardContent className={cn("flex h-full flex-col gap-3", compact ? "p-4" : "p-5")}>
        {frente.destaque && !compact && (
          <Badge className="absolute right-3 top-3 h-5 rounded-full bg-emerald-600 px-2 text-[10px] font-semibold text-white hover:bg-emerald-600">
            {frente.destaque}
          </Badge>
        )}
        <div
          className={cn(
            "flex items-center justify-center rounded-xl text-white shadow-sm",
            frente.cor,
            compact ? "h-10 w-10" : "h-12 w-12",
          )}
        >
          <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={cn("font-bold tracking-tight", compact ? "text-base" : "text-lg")}>
            {frente.sigla}
          </h3>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {frente.abrangencia}
          </p>
          {!compact && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{frente.resumo}</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Acessar{" "}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </CardContent>
    </Card>
  );

  if (frente.rotaPropria) {
    return (
      <Link to={frente.rotaPropria} className="block h-full">
        {card}
      </Link>
    );
  }

  return (
    <Link to="/cadastros/$frente" params={{ frente: frente.id }} className="block h-full">
      {card}
    </Link>
  );
}
