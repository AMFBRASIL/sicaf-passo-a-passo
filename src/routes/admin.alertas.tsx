import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, Receipt, Ticket, FileWarning, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/alertas")({
  component: AlertasPage,
});

interface Alerta { tipo: string; cli: string; det: string; em: string; tom: "rose" | "amber" | "violet"; icon: any; }

const todos: Alerta[] = [
  { tipo: "Certidão Federal vencendo", cli: "JR Construtora EIRELI", det: "Vence em 3 dias", em: "3d", tom: "amber", icon: ShieldAlert },
  { tipo: "CRC vencendo", cli: "Solar Brasil Energia", det: "Vence em 7 dias", em: "7d", tom: "amber", icon: FileWarning },
  { tipo: "Boleto vencido", cli: "Nova Filial Brasília LTDA", det: "R$ 590 — vencido há 5 dias", em: "5d", tom: "rose", icon: Receipt },
  { tipo: "Ticket sem resposta", cli: "Construtora Aurora", det: "SLA estoura em 2h", em: "2h", tom: "rose", icon: Ticket },
  { tipo: "Documento pendente", cli: "Engemax Serviços", det: "Balanço aguardando aprovação há 3d", em: "3d", tom: "amber", icon: FileWarning },
  { tipo: "Risco de cancelamento", cli: "Pavimar Obras", det: "Score 82% · sem login há 14 dias", em: "82%", tom: "violet", icon: AlertTriangle },
  { tipo: "SICAF vencido", cli: "MEI José Roberto", det: "Vencido há 22 dias — sem renovação", em: "22d", tom: "rose", icon: ShieldAlert },
  { tipo: "Cliente sem pagamento", cli: "TecnoLimp Servicos", det: "Última fatura em aberto há 8 dias", em: "8d", tom: "rose", icon: Receipt },
];

const tomCls: Record<string, string> = {
  rose: "border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300",
  amber: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  violet: "border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-300",
};

function AlertasPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Central de Alertas</h1>
          <p className="text-sm text-muted-foreground">Tudo que está prestes a virar problema, em um único lugar.</p>
        </div>
        <Button variant="outline" size="sm">Marcar todos como vistos</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {todos.map((a, i) => {
          const Icon = a.icon;
          return (
            <Card key={i} className={`flex items-start gap-3 border p-4 ${tomCls[a.tom]}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/60">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{a.tipo}</p>
                  <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                    <Clock className="h-3 w-3" /> {a.em}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-foreground/80">{a.cli}</p>
                <p className="mt-1 text-xs opacity-80">{a.det}</p>
                <div className="mt-3 flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs bg-background">Tratar</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs">Ignorar</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
