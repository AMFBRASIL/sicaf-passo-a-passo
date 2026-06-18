import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Clock,
  Download,
  FileText,
  Headphones,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  User,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  TICKET_SITUACOES,
  type ModoSituacaoTicket,
  type TicketRespostaOptions,
  type TicketSituacao,
  situacaoPadraoAposEnvio,
  type AdminTicketAnexo,
  type AdminTicketDetalhe,
  type AdminTicketMensagem,
  type ColunaKanban,
  colunaDoTicketDetalhe,
  colunaParaStatusDb,
  coletarTodosAnexos,
  fetchAdminTicketDetalhe,
  formatSlaUi,
  formatTamanhoArquivo,
  prioridadeParaUi,
  responderTicketAdmin,
} from "@/lib/admin-suporte-api";

const respostasRapidas = [
  "Olá! Recebemos sua solicitação e já estamos trabalhando nela.",
  "Pode nos enviar uma cópia do último comprovante, por favor?",
  "Renovação concluída com sucesso! Já está disponível no portal.",
  "Estamos aguardando a liberação do órgão, retornamos em breve.",
];

type Props = {
  ticketId: string;
};

export function AdminTicketDetalhe({ ticketId }: Props) {
  const [ticket, setTicket] = useState<AdminTicketDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [modoSituacao, setModoSituacao] = useState<ModoSituacaoTicket>("padrao");
  const [situacaoManual, setSituacaoManual] = useState<TicketSituacao>("Em andamento");
  const [marcarResolvido, setMarcarResolvido] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminTicketDetalhe(ticketId);
    setLoading(false);
    if (!res.ok || !res.ticket) {
      toast.error(res.error || "Erro ao carregar ticket");
      setTicket(null);
      return;
    }
    setTicket(res.ticket);
    const coluna = colunaDoTicketDetalhe(res.ticket);
    setSituacaoManual(coluna);
  }, [ticketId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const colunaAtual = useMemo(() => (ticket ? colunaDoTicketDetalhe(ticket) : "Em andamento"), [ticket]);
  const sla = useMemo(
    () => (ticket ? formatSlaUi(ticket.slaMinutes, ticket.status) : { restante: "—", tom: "ok" as const }),
    [ticket],
  );
  const prio = ticket ? prioridadeParaUi(ticket.priority) : "Média";
  const todosAnexos = useMemo(() => (ticket ? coletarTodosAnexos(ticket) : []), [ticket]);

  const situacaoPrevista = useMemo((): TicketSituacao => {
    if (modoSituacao === "manual") return situacaoManual;
    return situacaoPadraoAposEnvio(colunaAtual, marcarResolvido);
  }, [modoSituacao, situacaoManual, colunaAtual, marcarResolvido]);

  const enviarResposta = async () => {
    if (!ticket || !mensagem.trim()) {
      toast.error("Escreva uma mensagem antes de enviar");
      return;
    }

    const opcoes: TicketRespostaOptions = {
      modoSituacao,
      situacaoManual: modoSituacao === "manual" ? situacaoManual : undefined,
      marcarResolvido: modoSituacao === "padrao" ? marcarResolvido : undefined,
    };

    const destino: ColunaKanban =
      opcoes.modoSituacao === "manual" && opcoes.situacaoManual
        ? (opcoes.situacaoManual as ColunaKanban)
        : (situacaoPadraoAposEnvio(colunaAtual, !!opcoes.marcarResolvido) as ColunaKanban);

    const status =
      opcoes.modoSituacao === "manual" && opcoes.situacaoManual
        ? colunaParaStatusDb(opcoes.situacaoManual)
        : opcoes.marcarResolvido
          ? "resolvido"
          : destino !== colunaAtual
            ? colunaParaStatusDb(destino)
            : undefined;

    setEnviando(true);
    const res = await responderTicketAdmin(ticket.id, {
      mensagem,
      status,
      marcarResolvido: opcoes.modoSituacao === "padrao" ? opcoes.marcarResolvido : undefined,
    });
    setEnviando(false);

    if (!res.ok) {
      toast.error(res.error || "Erro ao enviar resposta");
      return;
    }

    toast.success(
      situacaoPrevista !== colunaAtual
        ? `Resposta enviada · situação: ${situacaoPrevista}`
        : "Resposta enviada ao cliente",
    );
    setMensagem("");
    setModoSituacao("padrao");
    setMarcarResolvido(false);
    await carregar();
  };

  if (loading && !ticket) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando ticket...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link to="/admin/suporte">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Kanban
          </Link>
        </Button>
        <p className="mt-6 text-sm text-muted-foreground">Ticket não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <header className="shrink-0 border-b bg-card px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 h-8" asChild>
              <Link to="/admin/suporte">
                <ArrowLeft className="h-3.5 w-3.5" />
                Central de Suporte
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
              <Badge variant="outline">{colunaAtual}</Badge>
              <Badge variant={prio === "Alta" ? "destructive" : "secondary"}>{prio}</Badge>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium",
                  sla.tom === "bad" ? "text-rose-600" : sla.tom === "warn" ? "text-amber-600" : "text-muted-foreground",
                )}
              >
                {sla.tom === "warn" || sla.tom === "bad" ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                SLA: {sla.restante}
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{ticket.title}</h1>
            <p className="text-sm text-muted-foreground">
              {ticket.category} · Aberto em {ticket.createdAt}
              {ticket.updatedAt ? ` · Atualizado em ${ticket.updatedAt}` : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void carregar()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_340px]">
        <div className="flex min-h-0 flex-col border-r">
          <Tabs defaultValue="conversa" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b px-4 pt-3 sm:px-6">
              <TabsList>
                <TabsTrigger value="conversa" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Conversa
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {ticket.messages?.length || 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="anexos" className="gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Anexos
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {todosAnexos.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="detalhes" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Detalhes
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="conversa" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 px-4 py-5 sm:px-6">
                {(ticket.messages || []).map((m) => (
                  <MensagemThread key={m.id} mensagem={m} />
                ))}
                {(ticket.messages || []).length === 0 && (
                  <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                    Nenhuma mensagem ainda
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="anexos" className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 data-[state=inactive]:hidden">
              <AnexosPainel ticket={ticket} anexos={todosAnexos} />
            </TabsContent>

            <TabsContent value="detalhes" className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 data-[state=inactive]:hidden">
              <div className="space-y-4 max-w-2xl">
                <InfoLinha label="Cliente" value={ticket.client} />
                {ticket.clientDocumento && <InfoLinha label="Documento" value={ticket.clientDocumento} />}
                <InfoLinha label="Responsável" value={ticket.assignee || "Não atribuído"} />
                <InfoLinha label="Categoria" value={ticket.category} />
                <InfoLinha label="Situação" value={colunaAtual} />
                <InfoLinha label="Prioridade" value={prio} />
                <InfoLinha label="Prazo SLA" value={ticket.slaDeadline || "—"} />
                <Separator />
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">Descrição inicial</div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.description || "—"}</p>
                </div>
                {(ticket.anexos || []).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">Anexos da abertura</div>
                      <ListaAnexos anexos={ticket.anexos || []} />
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="flex min-h-0 flex-col bg-card">
          <div className="shrink-0 border-b px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium truncate">{ticket.client}</div>
                {ticket.clientDocumento && (
                  <div className="text-xs text-muted-foreground truncate">{ticket.clientDocumento}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Headphones className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Atribuído:</span>
              <span className="font-medium">{ticket.assignee || "Não atribuído"}</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resposta ao cliente
              </Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {respostasRapidas.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMensagem(r)}
                    className="text-[11px] rounded-full border bg-muted/40 px-2.5 py-1 hover:bg-accent"
                  >
                    {r.slice(0, 36)}…
                  </button>
                ))}
              </div>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Escreva sua resposta..."
                rows={7}
                className="mt-2 resize-none text-sm"
              />
            </div>

            <Card className="p-3 space-y-3 bg-muted/20">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Situação após envio
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Atual: <span className="font-medium text-foreground">{colunaAtual}</span>
                  {situacaoPrevista !== colunaAtual && (
                    <>
                      {" "}
                      → <span className="font-medium text-primary">{situacaoPrevista}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={modoSituacao === "padrao" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setModoSituacao("padrao")}
                >
                  Padrão
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={modoSituacao === "manual" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setModoSituacao("manual")}
                >
                  Manual
                </Button>
              </div>
              {modoSituacao === "padrao" ? (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marcarResolvido}
                    onChange={(e) => setMarcarResolvido(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Marcar como resolvido após envio
                </label>
              ) : (
                <Select value={situacaoManual} onValueChange={(v) => setSituacaoManual(v as TicketSituacao)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_SITUACOES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Card>
          </div>

          <div className="shrink-0 border-t p-4">
            <Button className="w-full gap-2" onClick={() => void enviarResposta()} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {enviando ? "Enviando..." : "Enviar resposta"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MensagemThread({ mensagem }: { mensagem: AdminTicketMensagem }) {
  const agente = mensagem.sender === "support";
  const html = /<[a-z][\s\S]*>/i.test(mensagem.message);

  return (
    <div className={cn("flex gap-3", agente && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          agente ? "bg-primary text-primary-foreground" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        )}
      >
        {agente ? <Headphones className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[85%] min-w-0", agente && "items-end")}>
        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", agente && "justify-end")}>
          <span className="font-semibold text-foreground">{mensagem.senderName}</span>
          <span>•</span>
          <span>{mensagem.date}</span>
          <Badge variant="outline" className="h-4 px-1 text-[9px]">
            {agente ? "Suporte" : "Cliente"}
          </Badge>
        </div>
        <div
          className={cn(
            "mt-1 rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
            agente
              ? "rounded-tr-sm border-primary/20 bg-primary/10"
              : "rounded-tl-sm border-border bg-card",
          )}
        >
          {html ? (
            <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: mensagem.message }} />
          ) : (
            <p className="whitespace-pre-wrap">{mensagem.message}</p>
          )}
          {(mensagem.anexos || []).length > 0 && <ListaAnexos anexos={mensagem.anexos || []} compact />}
        </div>
      </div>
    </div>
  );
}

function AnexosPainel({ ticket, anexos }: { ticket: AdminTicketDetalhe; anexos: AdminTicketAnexo[] }) {
  if (anexos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        Nenhum anexo neste ticket
      </div>
    );
  }

  const porMensagem = new Map<number, AdminTicketAnexo[]>();
  for (const m of ticket.messages || []) {
    if (m.anexos?.length) porMensagem.set(m.id, m.anexos);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {(ticket.anexos || []).length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Anexos da abertura</h3>
          <ListaAnexos anexos={ticket.anexos || []} grid />
        </section>
      )}
      {(ticket.messages || []).map((m) =>
        m.anexos?.length ? (
          <section key={m.id}>
            <h3 className="text-sm font-semibold mb-1">
              {m.senderName} · {m.date}
            </h3>
            <p className="text-xs text-muted-foreground mb-3 truncate">{m.message.slice(0, 80)}</p>
            <ListaAnexos anexos={m.anexos} grid />
          </section>
        ) : null,
      )}
    </div>
  );
}

function ListaAnexos({
  anexos,
  compact = false,
  grid = false,
}: {
  anexos: AdminTicketAnexo[];
  compact?: boolean;
  grid?: boolean;
}) {
  if (!anexos.length) return null;

  return (
    <div className={cn("mt-2", grid ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2", compact && "mt-3")}>
      {anexos.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-2 rounded-md border bg-muted/40 transition hover:bg-accent hover:border-primary/30",
            compact ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
            grid && "min-w-0",
          )}
        >
          <Paperclip className={cn("shrink-0 text-muted-foreground", compact ? "h-3 w-3" : "h-4 w-4")} />
          <span className="min-w-0 flex-1 truncate font-medium">{a.nomeOriginal}</span>
          <span className="shrink-0 text-muted-foreground text-[11px]">{formatTamanhoArquivo(a.tamanho)}</span>
          <Download className={cn("shrink-0 text-muted-foreground", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
        </a>
      ))}
    </div>
  );
}

function InfoLinha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
