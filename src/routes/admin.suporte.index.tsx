import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Plus, Clock, AlertTriangle, Search, Filter, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { TicketRespostaModal } from "@/components/admin/ticket-resposta-modal";
import { NovoTicketModal, type NovoTicketData } from "@/components/admin/novo-ticket-modal";
import { toast } from "sonner";
import {
  type ColunaKanban,
  type TicketKanban,
  criarTicketAdmin,
  fetchAdminTickets,
  prioridadeParaApi,
  ticketsParaBoard,
} from "@/lib/admin-suporte-api";

export const Route = createFileRoute("/admin/suporte/")({
  component: SuporteKanbanPage,
});

const colunas: ColunaKanban[] = [
  "Novo",
  "Triagem",
  "Em andamento",
  "Aguardando Cliente",
  "Aguardando Governo",
  "Resolvido",
  "Fechado",
];

const colCls: Record<ColunaKanban, string> = {
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

const boardVazio = () => ticketsParaBoard([]);

function SuporteKanbanPage() {
  const [board, setBoard] = useState<Record<ColunaKanban, TicketKanban[]>>(boardVazio);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [respOpen, setRespOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [totalApi, setTotalApi] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchAdminTickets(buscaDebounced);
      if (!res.ok) {
        const msg = res.error || "Erro ao carregar tickets";
        setErro(msg);
        toast.error(msg);
        return;
      }
      const lista = res.tickets || [];
      setTotalApi(lista.length);
      setBoard(ticketsParaBoard(lista));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar tickets";
      setErro(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [buscaDebounced]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const totalAbertos = useMemo(
    () =>
      colunas
        .filter((c) => c !== "Fechado" && c !== "Resolvido")
        .reduce((acc, c) => acc + board[c].length, 0),
    [board],
  );

  const abrirTicket = (t: TicketKanban) => {
    setSelectedTicketId(t.id);
    setRespOpen(true);
  };

  const criarTicket = async (d: NovoTicketData) => {
    const res = await criarTicketAdmin({
      titulo: d.titulo,
      descricao: d.descricao || d.titulo,
      categoria: d.categoria,
      prioridade: prioridadeParaApi(d.prioridade),
      clienteId: d.clienteId,
    });

    if (!res.ok) {
      toast.error(res.error || "Erro ao criar ticket");
      throw new Error(res.error || "Erro ao criar ticket");
    }

    toast.success(res.message || `Ticket ${res.codigo || ""} criado`);
    await carregar();
    if (res.codigo) {
      setSelectedTicketId(res.codigo);
      setRespOpen(true);
    }
  };

  const filtra = (tickets: TicketKanban[]) =>
    busca.trim()
      ? tickets.filter(
          (t) =>
            t.titulo.toLowerCase().includes(busca.toLowerCase()) ||
            t.cli.toLowerCase().includes(busca.toLowerCase()) ||
            t.id.toLowerCase().includes(busca.toLowerCase()),
        )
      : tickets;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Central de Suporte</h1>
          <p className="text-sm text-muted-foreground">
            Kanban com SLA, responsável e histórico ·{" "}
            <span className="font-medium text-foreground">{totalAbertos}</span> tickets em aberto
            {totalApi > 0 && (
              <>
                {" "}
                · <span className="font-medium text-foreground">{totalApi}</span> no banco
              </>
            )}
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void carregar()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Filtros avançados em breve")}>
            <Filter className="h-3.5 w-3.5" /> Filtros
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setNovoOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo ticket
          </Button>
        </div>
      </div>

      {erro && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Não foi possível carregar os tickets</p>
            <p className="mt-1 text-rose-700/90 dark:text-rose-300/90">{erro}</p>
          </div>
        </div>
      )}

      {loading && Object.values(board).every((col) => col.length === 0) ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando tickets...
        </div>
      ) : (
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
                        onClick={() => abrirTicket(t)}
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
                            {t.sla.tom === "warn" || t.sla.tom === "bad" ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
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
      )}

      <TicketRespostaModal
        open={respOpen}
        onOpenChange={(open) => {
          setRespOpen(open);
          if (!open) setSelectedTicketId(null);
        }}
        ticketId={selectedTicketId}
        onRespondido={() => void carregar()}
      />

      <NovoTicketModal open={novoOpen} onOpenChange={setNovoOpen} onCriar={criarTicket} />
    </div>
  );
}
