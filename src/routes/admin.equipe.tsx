import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/equipe")({
  component: EquipePage,
});

interface Membro { nome: string; cargo: string; tickets: number; media: string; sla: number; clientes: number; avaliacao: number; tom: string; }

const equipe: Membro[] = [
  { nome: "Anderson Lima",  cargo: "Especialista SICAF",     tickets: 47, media: "12min", sla: 98, clientes: 84, avaliacao: 4.9, tom: "emerald" },
  { nome: "Maria Souza",    cargo: "Operadora Sênior",       tickets: 39, media: "18min", sla: 95, clientes: 71, avaliacao: 4.8, tom: "emerald" },
  { nome: "João Pereira",   cargo: "Suporte Técnico",         tickets: 31, media: "22min", sla: 92, clientes: 58, avaliacao: 4.6, tom: "blue" },
  { nome: "Carla Ribeiro",  cargo: "Documentação",            tickets: 24, media: "28min", sla: 89, clientes: 42, avaliacao: 4.5, tom: "blue" },
  { nome: "Pedro Henrique", cargo: "Atendimento",             tickets: 18, media: "31min", sla: 84, clientes: 36, avaliacao: 4.3, tom: "amber" },
  { nome: "Larissa Mendes", cargo: "Customer Success",        tickets: 12, media: "45min", sla: 78, clientes: 22, avaliacao: 4.1, tom: "amber" },
];

const ranked = [...equipe].sort((a, b) => b.tickets - a.tickets);

function EquipePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão de Equipe</h1>
          <p className="text-sm text-muted-foreground">Quem produz mais — e onde melhorar.</p>
        </div>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Adicionar colaborador</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {ranked.map((m, i) => (
          <Card key={m.nome} className="p-5">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {m.nome.split(" ").map(s => s[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold">{m.nome}</p>
                  {i === 0 && <Badge className="gap-0.5 bg-amber-500 text-[10px] text-white"><Star className="h-2.5 w-2.5" /> Top</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{m.cargo}</p>
                <div className="mt-1 flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{m.avaliacao}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Cell label="Tickets" value={m.tickets.toString()} />
              <Cell label="Tempo médio" value={m.media} />
              <Cell label="SLA" value={`${m.sla}%`} tone={m.sla >= 95 ? "emerald" : m.sla >= 85 ? "amber" : "rose"} />
            </div>
            <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Clientes atendidos: <span className="font-semibold text-foreground">{m.clientes}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Cell({ label, value, tone = "default" }: any) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  };
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}
