import { Bot, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type AssistantAlert = {
  empresa: string;
  cnpj: string;
  problema: string;
  severidade: "danger" | "warn";
};

const defaultAlerts: AssistantAlert[] = [
  {
    empresa: "Serviços Modelo EIRELI",
    cnpj: "11.222.333/0001-44",
    problema: "Certidão Trabalhista vencida",
    severidade: "danger",
  },
  {
    empresa: "Comércio Atlântico ME",
    cnpj: "45.678.912/0001-33",
    problema: "Certidão Estadual vence em 5 dias",
    severidade: "warn",
  },
  {
    empresa: "Tech Solutions Brasil",
    cnpj: "98.765.432/0001-10",
    problema: "SICAF expira em 12 dias",
    severidade: "warn",
  },
];

export function AssistantCard({ alerts = defaultAlerts }: { alerts?: AssistantAlert[] }) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/30 shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Assistente CADBRASIL</p>
              <Sparkles className="h-3.5 w-3.5 text-warning" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Analisei suas últimas 3 empresas. Veja o que precisa de ação:
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {alerts.slice(0, 3).map((a) => (
            <li
              key={a.cnpj}
              className="rounded-xl border bg-card/60 p-3 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    a.severidade === "danger"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-warning/15 text-warning-foreground",
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.empresa}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {a.cnpj}
                  </p>
                  <p className="mt-1 text-xs text-foreground">{a.problema}</p>
                </div>
              </div>
              <Button
                asChild
                size="sm"
                variant={a.severidade === "danger" ? "default" : "outline"}
                className="mt-2 h-8 w-full gap-1 text-xs"
              >
                <Link to="/certidoes" search={{ cnpj: a.cnpj }}>
                  Executar agora
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
