import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  title: string;
  description: string;
  bullets?: string[];
}

export function ModulePlaceholder({ title, description, bullets = [] }: Props) {
  return (
    <div className="p-6 lg:p-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Construction className="h-3 w-3" /> Em construção
        </Badge>
      </div>

      <Card className="border-dashed bg-muted/30 p-10">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Construction className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">Módulo planejado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Este módulo faz parte do roadmap da Central de Comando CADBRASIL. Será
            construído nas próximas fases junto com você.
          </p>
          {bullets.length > 0 && (
            <ul className="mt-6 grid w-full gap-2 text-left text-sm text-muted-foreground">
              {bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
