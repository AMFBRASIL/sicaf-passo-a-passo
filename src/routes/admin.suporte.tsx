import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Clock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/suporte")({
  component: SuportePage,
});

type Coluna = "Novo" | "Triagem" | "Em andamento" | "Aguardando Cliente" | "Aguardando Governo" | "Resolvido" | "Fechado";

interface Ticket {
  id: string;
  titulo: string;
  cli: string;
  resp: string;
  sla: { restante: string; tom: "ok" | "warn" | "bad" };
  prio: "Alta" | "Média" | "Baixa";
}

const colunas: Coluna[] = ["Novo", "Triagem", "Em andamento", "Aguardando Cliente", "Aguardando Governo", "Resolvido", "Fechado"];

const initial: Record<Coluna, Ticket[]> = {
  "Novo": [
    { id: "T-1042", titulo: "Não consigo enviar Nível IV", cli: "Engemax Serviços", resp: "—", sla: { restante: "4h", tom: "ok" }, prio: "Média" },
    { id: "T-1043", titulo: "Solicitar segunda via de boleto", cli: "MEI José Roberto", resp: "—", sla: { restante: "6h", tom: "ok" }, prio: "Baixa" },
  ],
  "Triagem": [
    { id: "T-1039", titulo: "Erro ao atualizar CRC", cli: "JR Construtora EIRELI", resp: "Anderson", sla: { restante: "1h30", tom: "warn" }, prio: "Alta" },
  ],
  "Em andamento": [
    { id: "T-1031", titulo: "Procuração rejeitada — revisar", cli: "Construtora Aurora", resp: "Maria S.", sla: { restante: "2h", tom: "warn" }, prio: "Alta" },
    { id: "T-1028", titulo: "Migração CNAE secundário", cli: "Solar Brasil Energia", resp: "João P.", sla: { restante: "12h", tom: "ok" }, prio: "Média" },
  ],
  "Aguardando Cliente": [
    { id: "T-1019", titulo: "Falta certidão municipal", cli: "Pavimar Obras", resp: "Carla R.", sla: { restante: "Sem prazo", tom: "ok" }, prio: "Média" },
  ],
  "Aguardando Governo": [
    { id: "T-1014", titulo: "Resposta da Receita pendente", cli: "TecnoLimp Servicos", resp: "Anderson", sla: { restante: "—", tom: "ok" }, prio: "Baixa" },
  ],
  "Resolvido": [
    { id: "T-1010", titulo: "SICAF Nível III ativado", cli: "Nova Filial Brasília", resp: "Maria S.", sla: { restante: "Ok", tom: "ok" }, prio: "Média" },
    { id: "T-1009", titulo: "Reset de senha realizado", cli: "Solar Brasil Energia", resp: "João P.", sla: { restante: "Ok", tom: "ok" }, prio: "Baixa" },
  ],
  "Fechado": [
    { id: "T-1001", titulo: "Cadastro inicial concluído", cli: "Construtora Aurora", resp: "Anderson", sla: { restante: "Ok", tom: "ok" }, prio: "Baixa" },
  ],
};

const colCls: Record<Coluna, string> = {
  "Novo": "border-t-4 border-t-blue-500",
  "Triagem": "border-t-4 border-t-violet-500",
  "Em andamento": "border-t-4 border-t-amber-500",
  "Aguardando Cliente": "border-t-4 border-t-sky-500",
  "Aguardando Governo": "border-t-4 border-t-orange-500",
  "Resolvido": "border-t-4 border-t-emerald-500",
  "Fechado": "border-t-4 border-t-slate-400",
};

const prioCls: Record<string, string> = {
  Alta: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  Média: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Baixa: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

function SuportePage() {
  const [board] = useState(initial);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Central de Suporte</h1>
          <p className="text-sm text-muted-foreground">Kanban com SLA, responsável e histórico.</p>
        </div>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo ticket</Button>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {colunas.map((col) => (
            <div key={col} className={`w-72 shrink-0 rounded-lg bg-muted/30 ${colCls[col]}`}>
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{col}</span>
                  <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">{board[col].length}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="space-y-2 px-2 pb-3">
                {board[col].map((t) => (
                  <Card key={t.id} className="cursor-grab p-3 transition hover:shadow-md active:cursor-grabbing">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">{t.id}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${prioCls[t.prio]}`}>{t.prio}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium leading-snug">{t.titulo}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{t.cli}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5 border border-border">
                          <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                            {t.resp === "—" ? "?" : t.resp.split(" ").map(x => x[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] text-muted-foreground">{t.resp}</span>
                      </div>
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${
                        t.sla.tom === "bad" ? "text-rose-600" : t.sla.tom === "warn" ? "text-amber-600" : "text-muted-foreground"
                      }`}>
                        {t.sla.tom === "warn" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {t.sla.restante}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
