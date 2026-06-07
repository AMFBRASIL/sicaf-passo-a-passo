import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Plus, ChevronRight } from "lucide-react";
import { MembroEquipeModal, type MembroEdit } from "@/components/admin/membro-equipe-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/equipe")({
  component: EquipePage,
});

const equipeInicial: MembroEdit[] = [
  { nome: "Anderson Lima",  cargo: "Especialista SICAF",     perfil: "Administrador",     tickets: 47, media: "12min", sla: 98, clientes: 84, avaliacao: 4.9, ativo: true },
  { nome: "Maria Souza",    cargo: "Operadora Sênior",        perfil: "Operador SICAF",    tickets: 39, media: "18min", sla: 95, clientes: 71, avaliacao: 4.8, ativo: true },
  { nome: "João Pereira",   cargo: "Suporte Técnico",          perfil: "Suporte N1",        tickets: 31, media: "22min", sla: 92, clientes: 58, avaliacao: 4.6, ativo: true },
  { nome: "Carla Ribeiro",  cargo: "Documentação",             perfil: "Documentação",      tickets: 24, media: "28min", sla: 89, clientes: 42, avaliacao: 4.5, ativo: true },
  { nome: "Pedro Henrique", cargo: "Atendimento",              perfil: "Suporte N1",        tickets: 18, media: "31min", sla: 84, clientes: 36, avaliacao: 4.3, ativo: true },
  { nome: "Larissa Mendes", cargo: "Customer Success",         perfil: "Customer Success",  tickets: 12, media: "45min", sla: 78, clientes: 22, avaliacao: 4.1, ativo: false },
];

const perfilCores: Record<string, string> = {
  "Administrador": "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "Operador SICAF": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "Financeiro": "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "Suporte N1": "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "Documentação": "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  "Customer Success": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
};

function EquipePage() {
  const [equipe, setEquipe] = useState<MembroEdit[]>(equipeInicial);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MembroEdit | null>(null);

  const abrir = (m: MembroEdit) => {
    setSelected(m);
    setOpen(true);
  };

  const salvar = (atualizado: MembroEdit) => {
    setEquipe((prev) => prev.map((m) => (m.nome === selected?.nome ? atualizado : m)));
  };

  const novoColaborador = () => {
    const novo: MembroEdit = {
      nome: "Novo Colaborador",
      cargo: "Defina o cargo",
      perfil: "Suporte N1",
      tickets: 0,
      media: "—",
      sla: 100,
      clientes: 0,
      avaliacao: 5,
      ativo: true,
    };
    setEquipe([novo, ...equipe]);
    setSelected(novo);
    setOpen(true);
    toast.success("Colaborador criado — preencha os dados");
  };

  const ranked = [...equipe].sort((a, b) => b.tickets - a.tickets);
  const ativos = equipe.filter((m) => m.ativo !== false).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Gestão de Equipe</h1>
          <p className="text-sm text-muted-foreground">
            {ativos} de {equipe.length} colaboradores ativos · Clique no card para editar perfil e dados.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={novoColaborador}>
          <Plus className="h-3.5 w-3.5" /> Adicionar colaborador
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {ranked.map((m, i) => (
          <Card
            key={m.nome}
            onClick={() => abrir(m)}
            className={`group p-5 cursor-pointer transition hover:shadow-lg hover:border-primary/50 ${
              m.ativo === false ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {m.nome.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold">{m.nome}</p>
                  {i === 0 && (
                    <Badge className="gap-0.5 bg-amber-500 text-[10px] text-white">
                      <Star className="h-2.5 w-2.5" /> Top
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{m.cargo}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${perfilCores[m.perfil] || "border-muted"}`}
                  >
                    {m.perfil}
                  </Badge>
                  <div className="flex items-center gap-0.5 text-xs">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="font-medium">{m.avaliacao}</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Cell label="Tickets" value={m.tickets.toString()} />
              <Cell label="Tempo médio" value={m.media} />
              <Cell
                label="SLA"
                value={`${m.sla}%`}
                tone={m.sla >= 95 ? "emerald" : m.sla >= 85 ? "amber" : "rose"}
              />
            </div>
            <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Clientes atendidos: <span className="font-semibold text-foreground">{m.clientes}</span>
            </div>
          </Card>
        ))}
      </div>

      <MembroEquipeModal open={open} onOpenChange={setOpen} membro={selected} onSave={salvar} />
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
