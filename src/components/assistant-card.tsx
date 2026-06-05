import { Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";

export function AssistantCard() {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/30 shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Assistente CADBRASIL</p>
              <Sparkles className="h-3.5 w-3.5 text-warning" />
            </div>
            <p className="text-sm text-muted-foreground">
              Analisei seu cadastro. Hoje recomendo:
            </p>
            <p className="text-sm font-medium text-foreground">
              ✅ Atualizar sua Certidão Federal — ela vence em 12 dias.
            </p>
            <Button asChild size="sm" className="mt-2 w-full">
              <Link to="/certidoes">Executar Agora</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
