import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, BellRing } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FrenteCadastro } from "@/lib/frentes-cadastro";
import type { NovidadeServico } from "@/lib/servicos-novidades-api";

export function FrenteCadastroCard({
  frente,
  compact = false,
  novidades = [],
}: {
  frente: FrenteCadastro;
  compact?: boolean;
  /** Alertas do serviço (ações do cliente e atualizações da equipe) das empresas do usuário. */
  novidades?: NovidadeServico[];
}) {
  const Icon = frente.icon;
  const acoes = novidades.filter((n) => n.tipo === "acao");
  const principal = acoes[0] ?? novidades[0];
  const urgente = acoes.length > 0;
  const variasEmpresas = new Set(novidades.map((n) => n.clienteId)).size > 1;

  const card = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden border-2 border-border/70 bg-gradient-to-br shadow-soft transition-all",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        frente.accent,
        principal &&
          (urgente
            ? "border-amber-400 ring-2 ring-amber-400/30 hover:border-amber-500"
            : "border-sky-400 ring-2 ring-sky-400/30 hover:border-sky-500"),
      )}
    >
      <CardContent className={cn("flex h-full flex-col gap-3", compact ? "p-4" : "p-5")}>
        {principal ? (
          <span
            className={cn(
              "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm",
              urgente ? "bg-amber-500" : "bg-sky-600",
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            {urgente
              ? acoes.length > 1
                ? `${acoes.length} pendências`
                : "Ação necessária"
              : novidades.length > 1
                ? `${novidades.length} novidades`
                : "Novidade"}
          </span>
        ) : (
          frente.destaque &&
          !compact && (
            <Badge className="absolute right-3 top-3 h-5 rounded-full bg-emerald-600 px-2 text-[10px] font-semibold text-white hover:bg-emerald-600">
              {frente.destaque}
            </Badge>
          )
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
          {!compact && !principal && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{frente.resumo}</p>
          )}
          {principal && (
            <div
              className={cn(
                "mt-2.5 rounded-lg border px-2.5 py-2 text-xs",
                urgente
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                  : "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
              )}
            >
              <p className="flex items-start gap-1.5 font-semibold leading-snug">
                {urgente ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  {principal.titulo}
                  {principal.novo && principal.tipo === "acao" && (
                    <span className="ml-1.5 rounded-full bg-sky-600 px-1.5 align-middle text-[9px] font-semibold uppercase text-white">
                      Novo
                    </span>
                  )}
                </span>
              </p>
              {principal.detalhe && (
                <p
                  className="mt-1 line-clamp-2 pl-5 leading-snug opacity-80"
                  title={principal.detalhe}
                >
                  {principal.detalhe}
                </p>
              )}
              {variasEmpresas && (
                <p className="mt-0.5 truncate pl-5 opacity-80">{principal.empresa}</p>
              )}
              {novidades.length > 1 && (
                <p className="mt-0.5 pl-5 opacity-80">
                  + {novidades.length - 1}{" "}
                  {novidades.length - 1 === 1 ? "outro aviso" : "outros avisos"}
                </p>
              )}
            </div>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          {principal ? (urgente ? "Resolver agora" : "Ver novidade") : "Acessar"}{" "}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </CardContent>
    </Card>
  );

  if (frente.rotaPropria) {
    return (
      <Link
        to={frente.rotaPropria}
        search={(principal?.cnpj ? { cnpj: principal.cnpj } : {}) as never}
        className="block h-full"
      >
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
