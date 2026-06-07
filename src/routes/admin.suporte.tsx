import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Plus, Clock, AlertTriangle, Search, Filter } from "lucide-react";
import { TicketRespostaModal, type TicketItem } from "@/components/admin/ticket-resposta-modal";
import { NovoTicketModal, type NovoTicketData } from "@/components/admin/novo-ticket-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/suporte")({
  component: SuportePage,
});

type Coluna =
  | "Novo"
  | "Triagem"
  | "Em andamento"
  | "Aguardando Cliente"
  | "Aguardando Governo"
  | "Resolvido"
  | "Fechado";

interface Ticket {
  id: string;
  titulo: string;
  cli: string;
  resp: string;
  sla: { restante: string; tom: "ok" | "warn" | "bad" };
  prio: "Alta" | "Média" | "Baixa";
  data: string;
}

const colunas: Coluna[] = [
  "Novo",
  "Triagem",
  "Em andamento",
  "Aguardando Cliente",
  "Aguardando Governo",
  "Resolvido",
  "Fechado",
];

const initial: Record<Coluna, Ticket[]> = {
  Novo: [
    { id: "T-1042", titulo: "Não consigo enviar Nível IV", cli: "Engemax Serviços", resp: "—", sla: { restante: "4h", tom: "ok" }, prio: "Média", data: "Hoje 09:14" },
    { id: "T-1043", titulo: "Solicitar segunda via de boleto", cli: "MEI José Roberto", resp: "—", sla: { restante: "6h", tom: "ok" }, prio: "Baixa", data: "Hoje 08:02" },
  ],
  Triagem: [
    { id: "T-1039", titulo: "Erro ao atualizar CRC", cli: "JR Construtora EIRELI", resp: "Anderson", sla: { restante: "1h30", tom: "warn" }, prio: "Alta", data: "Ontem 17:40" },
  ],
  "Em andamento": [
    { id: "T-1031", titulo: "Procuração rejeitada — revisar", cli: "Construtora Aurora", resp: "Maria S.", sla: { restante: "2h", tom: "warn" }, prio: "Alta", data: "Ontem 14:10" },
    { id: "T-1028", titulo: "Migração CNAE secundário", cli: "Solar Brasil Energia", resp: "João P.", sla: { restante: "12h", tom: "ok" }, prio: "Média", data: "Ontem 11:22" },
  ],
  "Aguardando Cliente": [
    { id: "T-1019", titulo: "Falta certidão municipal", cli: "Pavimar Obras", resp: "Carla R.", sla: { restante: "Sem prazo", tom: "ok" }, prio: "Média", data: "2 dias atrás" },
  ],
  "Aguardando Governo": [
    { id: "T-1014", titulo: "Resposta da Receita pendente", cli: "TecnoLimp Servicos", resp: "Anderson", sla: { restante: "—", tom: "ok" }, prio: "Baixa", data: "3 dias atrás" },
  ],
  Resolvido: [
    { id: "T-1010", titulo: "SICAF Nível III ativado", cli: "Nova Filial Brasília", resp: "Maria S.", sla: { restante: "Ok", tom: "ok" }, prio: "Média", data: "5 dias atrás" },
    { id: "T-1009", titulo: "Reset de senha realizado", cli: "Solar Brasil Energia", resp: "João P.", sla: { restante: "Ok", tom: "ok" }, prio: "Baixa", data: "5 dias atrás" },
  ],
  Fechado: [
    { id: "T-1001", titulo: "Cadastro inicial concluído", cli: "Construtora Aurora", resp: "Anderson", sla: { restante: "Ok", tom: "ok" }, prio: "Baixa", data: "1 semana atrás" },
  ],
};

const colCls: Record<Coluna, string> = {
  Novo: "border-t-4 border-t-blue-500",
  Triagem: "border-t-4 border-t-violet-500",
  "Em andamento": "border-t-4 border-t-amber-500",
  "Aguardando Cliente": "border-t-4 border-t-sky-500",
  "Aguardando Governo": "border-t-4 border-t-orange-500",
  Resolvido: "border-t-4 border-t-emerald-500",
  Fechado: "border-t-4 border-t-slate-400",
};

const prioCls: Record<string, string> = {
  Alta: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  Média: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Baixa: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

function SuportePage() {
  const [board, setBoard] = useState(initial);
  const [busca, setBusca] = useState("");
  const [respOpen, setRespOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [selected, setSelected] = useState<{ ticket: Ticket; coluna: Coluna } | null>(null);

  const totalAbertos = useMemo(
    () =>
      colunas
        .filter((c) => c !== "Fechado" && c !== "Resolvido")
        .reduce((acc, c) => acc + board[c].length, 0),
    [board]
  );

  const abrirTicket = (t: Ticket, coluna: Coluna) => {
    setSelected({ ticket: t, coluna });
    setRespOpen(true);
  };

  const responderTicket = (ticketId: string, _msg: string, fechar: boolean) => {
    if (!fechar || !selected) return;
    setBoard((prev) => {
      const next: Record<Coluna, Ticket[]> = { ...prev };
      next[selected.coluna] = prev[selected.coluna].filter((t) => t.id !== ticketId);
      const ticket = prev[selected.coluna].find((t) => t.id === ticketId);
      if (ticket) next.Resolvido = [{ ...ticket, sla: { restante: "Ok", tom: "ok" } }, ...prev.Resolvido];
      return next;
    });
  };

  const criarTicket = (d: NovoTicketData) => {
    const novo: Ticket = {
      id: `T-${Math.floor(1000 + Math.random() * 9000)}`,
      titulo: d.titulo,
      cli: d.cliente,
      resp: d.responsavel || "—",
      sla: { restante: "8h", tom: "ok" },
      prio: d.prioridade,
      data: "Agora",
    };
    setBoard((prev) => ({ ...prev, Novo: [novo, ...prev.Novo] }));
  };

  const filtra = (tickets: Ticket[]) =>
    busca.trim()
      ? tickets.filter(
          (t) =>
            t.titulo.toLowerCase().includes(busca.toLowerCase()) ||
            t.cli.toLowerCase().includes(busca.toLowerCase()) ||
            t.id.toLowerCase().includes(busca.toLowerCase())
        )
      : tickets;

  const ticketSelecionado: TicketItem | null = selected
    ? { id: selected.ticket.id, titulo: selected.ticket.titulo, status: selected.coluna, prio: selected.ticket.prio.toLowerCase(), data: selected.ticket.data }
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Central de Suporte</h1>
          <p className="text-sm text-muted-foreground">
            Kanban com SLA, responsável e histórico · <span className="font-medium text-foreground">{totalAbertos}</span> tickets em aberto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar ticket, cliente, ID..."
              className="h-9 w-64 pl-8 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Filtros avançados em breve")}>
            <Filter className="h-3.5 w-3.5" /> Filtros
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setNovoOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo ticket
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {colunas.map((col) => {
            const tickets = filtra(board[col]);
            return (
              <div key={col} className={`w-72 shrink-0 rounded-lg bg-muted/30 ${colCls[col]}`}>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{col}</span>
                    <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                      {tickets.length}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNovoOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-2 px-2 pb-3">
                  {tickets.length === 0 && (
                    <div className="rounded-md border border-dashed bg-background/50 py-6 text-center text-[11px] text-muted-foreground">
                      Nenhum ticket
                    </div>
                  )}
                  {tickets.map((t) => (
                    <Card
                      key={t.id}
                      onClick={() => abrirTicket(t, col)}
                      className="cursor-pointer p-3 transition hover:shadow-md hover:border-primary/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground">{t.id}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${prioCls[t.prio]}`}>
                          {t.prio}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium leading-snug">{t.titulo}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{t.cli}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5 border border-border">
                            <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                              {t.resp === "—" ? "?" : t.resp.split(" ").map((x) => x[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] text-muted-foreground">{t.resp}</span>
                        </div>
                        <span
                          className={`flex items-center gap-1 text-[10px] font-medium ${
                            t.sla.tom === "bad"
                              ? "text-rose-600"
                              : t.sla.tom === "warn"
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {t.sla.tom === "warn" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {t.sla.restante}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TicketRespostaModal
        open={respOpen}
        onOpenChange={setRespOpen}
        ticket={ticketSelecionado}
        cliente={selected ? { razao: selected.ticket.cli, responsavel: selected.ticket.resp } : undefined}
        onEnviar={responderTicket}
      />

      <NovoTicketModal open={novoOpen} onOpenChange={setNovoOpen} onCriar={criarTicket} />
    </div>
  );
}
