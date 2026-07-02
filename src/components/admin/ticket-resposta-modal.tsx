import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  File as FileIcon,
  FileText,
  Headphones,
  Image as ImageIcon,
  Inbox,
  Landmark,
  Loader2,
  Paperclip,
  PlayCircle,
  Reply,
  Search,
  Send,
  Tag,
  Upload,
  User,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { StatusBadge } from "@/components/page-header";
import { CopyButton } from "@/components/copy-button";
import {
  type AdminTicketAnexo,
  type AdminTicketDetalhe,
  type AdminTicketMensagem,
  type ColunaKanban,
  TICKET_SITUACOES,
  atualizarTicketAdmin,
  buildPayloadMudancaSituacao,
  colunaDoTicketDetalhe,
  coletarTodosAnexos,
  fetchAdminTicketDetalhe,
  formatSlaUi,
  formatTamanhoArquivo,
  prioridadeParaUi,
  enviarRespostaAdminTicket,
  MAX_ANEXO_TICKET_BYTES,
} from "@/lib/admin-suporte-api";
import { useAuth } from "@/contexts/AuthContext";

export interface TicketItem {
  id: string;
  titulo: string;
  status: string;
  prio: string;
  data: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  onRespondido?: () => void;
}

type ReplyAnexo = { id: string; name: string; size: number; type: string; file: File };

const SITUACAO_CARD: Record<
  ColunaKanban,
  { border: string; active: string; icon: React.ReactNode; short: string }
> = {
  Novo: {
    border: "border-blue-500/40 hover:border-blue-500",
    active: "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30",
    icon: <Inbox className="h-4 w-4 text-blue-600" />,
    short: "Novo",
  },
  Triagem: {
    border: "border-violet-500/40 hover:border-violet-500",
    active: "border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/30",
    icon: <Search className="h-4 w-4 text-violet-600" />,
    short: "Triagem",
  },
  "Em andamento": {
    border: "border-amber-500/40 hover:border-amber-500",
    active: "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30",
    icon: <PlayCircle className="h-4 w-4 text-amber-600" />,
    short: "Andamento",
  },
  "Aguardando Cliente": {
    border: "border-sky-500/40 hover:border-sky-500",
    active: "border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/30",
    icon: <UserRound className="h-4 w-4 text-sky-600" />,
    short: "Cliente",
  },
  "Aguardando Governo": {
    border: "border-orange-500/40 hover:border-orange-500",
    active: "border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30",
    icon: <Landmark className="h-4 w-4 text-orange-600" />,
    short: "Governo",
  },
  Resolvido: {
    border: "border-emerald-500/40 hover:border-emerald-500",
    active: "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    short: "Resolvido",
  },
  Fechado: {
    border: "border-slate-400/40 hover:border-slate-500",
    active: "border-slate-500 bg-slate-500/10 ring-2 ring-slate-500/30",
    icon: <X className="h-4 w-4 text-slate-600" />,
    short: "Fechado",
  },
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCnpj(doc: string | null | undefined): string {
  const digits = String(doc || "").replace(/\D/g, "");
  if (digits.length !== 14) return String(doc || "").trim();
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function cnpjCopyValue(doc: string | null | undefined): string {
  const digits = String(doc || "").replace(/\D/g, "");
  return digits.length === 14 ? digits : String(doc || "").trim();
}

export function TicketRespostaModal({ open, onOpenChange, ticketId, onRespondido }: Props) {
  const { user } = useAuth();
  const [responderOpen, setResponderOpen] = useState(false);
  const [ticket, setTicket] = useState<AdminTicketDetalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [mudandoSituacao, setMudandoSituacao] = useState<ColunaKanban | null>(null);

  const carregar = useCallback(async () => {
    if (!ticketId) {
      setTicket(null);
      return;
    }
    setLoading(true);
    const res = await fetchAdminTicketDetalhe(ticketId);
    setLoading(false);
    if (!res.ok || !res.ticket) {
      toast.error(res.error || "Erro ao carregar ticket");
      setTicket(null);
      return;
    }
    setTicket(res.ticket);
  }, [ticketId]);

  useEffect(() => {
    if (open && ticketId) {
      void carregar();
    }
    if (!open) {
      setTicket(null);
      setResponderOpen(false);
    }
  }, [open, ticketId, carregar]);

  if (!ticketId) return null;

  const coluna = ticket ? colunaDoTicketDetalhe(ticket) : "Novo";
  const prio = ticket ? prioridadeParaUi(ticket.priority) : "Média";
  const prioCor =
    prio === "Alta"
      ? "bg-destructive/15 text-destructive"
      : prio === "Média"
        ? "bg-warning/15 text-warning-foreground"
        : "bg-success/15 text-success";

  const statusTom: "ok" | "warn" | "danger" =
    coluna === "Resolvido" || coluna === "Fechado"
      ? "ok"
      : coluna === "Novo" || coluna === "Triagem"
        ? "warn"
        : "warn";

  const sla = ticket ? formatSlaUi(ticket.slaMinutes, ticket.status) : { restante: "—", tom: "ok" as const };
  const mensagens: AdminTicketMensagem[] = ticket?.messages || [];
  const anexos: AdminTicketAnexo[] = ticket ? coletarTodosAnexos(ticket) : [];
  const ultimaMsg = mensagens[mensagens.length - 1];
  const assignee = ticket?.assignee && ticket.assignee !== "Não atribuído" ? ticket.assignee : "Você";

  const mudarSituacao = async (nova: ColunaKanban) => {
    if (!ticket || nova === coluna || mudandoSituacao) return;
    setMudandoSituacao(nova);
    const payload = buildPayloadMudancaSituacao(nova, user?.id);
    const res = await atualizarTicketAdmin(ticket.id, payload);
    setMudandoSituacao(null);
    if (!res.ok) {
      toast.error(res.error || "Erro ao atualizar situação");
      return;
    }
    toast.success(`Situação alterada para ${nova}`);
    await carregar();
    onRespondido?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-[1100px] lg:max-w-[1200px]">
          <DialogTitle className="sr-only">Ticket {ticketId}</DialogTitle>
          {loading && !ticket ? (
            <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Carregando ticket...
            </div>
          ) : !ticket ? (
            <div className="flex h-[40vh] items-center justify-center text-sm text-muted-foreground">
              Ticket não encontrado.
            </div>
          ) : (
            <div className="grid h-[90vh] max-h-[820px] grid-cols-1 lg:grid-cols-[1fr_360px]">
              <div className="flex h-full min-h-0 flex-col border-r">
                <header className="border-b bg-gradient-to-br from-primary/10 via-card to-card px-7 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 font-mono text-[11px] font-bold text-primary-foreground">
                      #{ticket.id}
                    </span>
                    <StatusBadge status={statusTom}>{coluna}</StatusBadge>
                    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold", prioCor)}>
                      <Zap className="h-3 w-3" />
                      Prioridade {prio}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight">{ticket.title}</h3>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Aberto <strong className="text-foreground">{ticket.createdAt}</strong>
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        sla.tom === "bad" && "text-destructive",
                        sla.tom === "warn" && "text-warning-foreground",
                        sla.tom === "ok" && "text-success",
                      )}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      SLA {sla.restante}
                    </span>
                  </div>
                </header>

                <SituacaoCards
                  colunaAtual={coluna}
                  mudando={mudandoSituacao}
                  onSelecionar={(s) => void mudarSituacao(s)}
                />

                <div className="flex-1 space-y-5 overflow-y-auto bg-muted/20 px-7 py-6">
                  {mensagens.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Nenhuma mensagem ainda. A descrição inicial do ticket está nos detalhes.
                    </p>
                  )}
                  {mensagens.map((m) => {
                    const agente = m.sender === "support";
                    return (
                      <div key={m.id} className={cn("flex gap-3", agente && "flex-row-reverse")}>
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-background",
                            agente ? "bg-primary text-primary-foreground" : "bg-success text-success-foreground",
                          )}
                        >
                          {agente ? <Headphones className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>
                        <div className={cn("max-w-[82%] min-w-0", agente && "items-end")}>
                          <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", agente && "justify-end")}>
                            <span className="font-semibold text-foreground">{m.senderName}</span>
                            <span>•</span>
                            <span>{m.date}</span>
                          </div>
                          <div
                            className={cn(
                              "mt-1 rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm whitespace-pre-wrap",
                              agente
                                ? "rounded-tr-sm border-primary/20 bg-primary/10"
                                : "rounded-tl-sm border-border bg-card",
                            )}
                          >
                            {m.message}
                          </div>
                          {(m.anexos || []).length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {(m.anexos || []).map((a) => (
                                <li key={a.id}>
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    {a.nomeOriginal}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <footer className="flex items-center justify-between gap-3 border-t bg-card px-7 py-4">
                  <p className="text-xs text-muted-foreground">
                    {ultimaMsg ? (
                      <>
                        Última mensagem por <strong className="text-foreground">{ultimaMsg.senderName}</strong> em{" "}
                        {ultimaMsg.date}
                      </>
                    ) : (
                      "Aguardando primeira resposta"
                    )}
                  </p>
                  <Button size="lg" onClick={() => setResponderOpen(true)} className="gap-2">
                    <Reply className="h-4 w-4" />
                    Responder
                  </Button>
                </footer>
              </div>

              <aside className="hidden h-full min-h-0 flex-col bg-muted/30 lg:flex">
                <div className="flex-1 overflow-y-auto p-6">
                  <SectionTitle>Envolvidos</SectionTitle>
                  <div className="mt-3 space-y-3">
                    <PersonRow
                      color="primary"
                      icon={<User className="h-4 w-4" />}
                      role="Cliente"
                      name={ticket.client || "—"}
                      documento={ticket.clientDocumento}
                    />
                    <PersonRow
                      color="success"
                      icon={<Headphones className="h-4 w-4" />}
                      role="Atendente"
                      name={assignee}
                      meta="Equipe Suporte CADBRASIL"
                    />
                  </div>

                  <SectionTitle className="mt-7">Detalhes</SectionTitle>
                  <dl className="mt-3 space-y-2.5 rounded-xl border bg-card p-4 text-xs">
                    <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Cliente" value={ticket.client || "—"} />
                    {ticket.clientDocumento ? (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          CNPJ
                        </dt>
                        <dd className="flex min-w-0 items-center gap-1">
                          <span
                            className="truncate font-mono text-[11px] font-semibold text-foreground"
                            title={formatCnpj(ticket.clientDocumento)}
                          >
                            {formatCnpj(ticket.clientDocumento)}
                          </span>
                          <CopyButton
                            value={cnpjCopyValue(ticket.clientDocumento)}
                            label="CNPJ"
                            className="h-6 w-6 shrink-0"
                          />
                        </dd>
                      </div>
                    ) : null}
                    <DetailRow icon={<Tag className="h-3.5 w-3.5" />} label="Categoria" value={ticket.category || "—"} />
                    <DetailRow icon={<Tag className="h-3.5 w-3.5" />} label="Status" value={coluna} />
                    <DetailRow icon={<Zap className="h-3.5 w-3.5" />} label="Prioridade" value={prio} />
                    <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Abertura" value={ticket.createdAt} />
                  </dl>

                  <SectionTitle className="mt-7">
                    Anexos
                    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                      {anexos.length}
                    </span>
                  </SectionTitle>
                  <ul className="mt-3 space-y-2">
                    {anexos.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">Nenhum anexo.</p>
                    )}
                    {anexos.map((a) => {
                      const isImg = (a.mimetype || "").startsWith("image/");
                      const isPdf =
                        a.mimetype === "application/pdf" || a.nomeOriginal.toLowerCase().endsWith(".pdf");
                      return (
                        <li
                          key={a.id}
                          className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm"
                        >
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                              isPdf && "bg-destructive/10 text-destructive",
                              isImg && "bg-primary/10 text-primary",
                              !isPdf && !isImg && "bg-muted text-muted-foreground",
                            )}
                          >
                            {isImg ? <ImageIcon className="h-5 w-5" /> : isPdf ? <FileText className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">{a.nomeOriginal}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{formatTamanhoArquivo(a.tamanho)}</p>
                          </div>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                            aria-label="Baixar"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {ticket && (
        <ResponderModal
          open={responderOpen}
          onOpenChange={setResponderOpen}
          ticket={ticket}
          onEnviar={async (msg, fechar, arquivos) => {
            const res = await enviarRespostaAdminTicket(ticket.id, {
              mensagem: msg,
              marcarResolvido: fechar,
              arquivos,
            });
            if (!res.ok) {
              toast.error(res.error || "Erro ao enviar resposta");
              return;
            }
            if (res.avisoAnexos) toast.warning(res.avisoAnexos);
            toast.success(
              fechar
                ? "Resposta enviada e ticket marcado como resolvido"
                : arquivos.length > 0
                  ? `Resposta e ${arquivos.length} anexo(s) enviados`
                  : "Resposta enviada ao cliente",
            );
            setResponderOpen(false);
            await carregar();
            onRespondido?.();
            if (fechar) onOpenChange(false);
          }}
        />
      )}
    </>
  );
}

function SituacaoCards({
  colunaAtual,
  mudando,
  onSelecionar,
}: {
  colunaAtual: ColunaKanban;
  mudando: ColunaKanban | null;
  onSelecionar: (s: ColunaKanban) => void;
}) {
  return (
    <div className="border-b bg-card px-7 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Situação</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Clique para mover o ticket — sem precisar responder</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {TICKET_SITUACOES.map((situacao) => {
          const cfg = SITUACAO_CARD[situacao];
          const ativa = colunaAtual === situacao;
          const loading = mudando === situacao;
          return (
            <button
              key={situacao}
              type="button"
              disabled={ativa || !!mudando}
              onClick={() => onSelecionar(situacao)}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-left transition",
                "disabled:cursor-default",
                !ativa && !mudando && "hover:shadow-sm active:scale-[0.98]",
                ativa ? cfg.active : cfg.border,
                mudando && !loading && "opacity-50",
              )}
            >
              <span className="shrink-0">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : cfg.icon}</span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold leading-tight">{cfg.short}</span>
                <span className="hidden truncate text-[10px] text-muted-foreground sm:block">{situacao}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h4 className={cn("flex items-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </h4>
  );
}

function PersonRow({
  color,
  icon,
  role,
  name,
  meta,
  documento,
}: {
  color: "primary" | "success";
  icon: React.ReactNode;
  role: string;
  name: string;
  meta?: string;
  documento?: string | null;
}) {
  const cnpjFmt = documento ? formatCnpj(documento) : "";
  const temCnpj = Boolean(cnpjFmt && cnpjFmt.replace(/\D/g, "").length >= 11);

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          color === "primary" && "bg-primary/15 text-primary",
          color === "success" && "bg-success/15 text-success",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{role}</p>
        <p className="truncate text-sm font-semibold">{name}</p>
        {temCnpj ? (
          <div className="mt-1 flex items-center gap-1">
            <span className="truncate font-mono text-[11px] text-muted-foreground">{cnpjFmt}</span>
            <CopyButton value={cnpjCopyValue(documento)} label="CNPJ" className="h-6 w-6 shrink-0" />
          </div>
        ) : meta ? (
          <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
        ) : (
          <p className="truncate text-[11px] text-muted-foreground">CNPJ não informado</p>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 max-w-[60%] truncate text-right font-semibold text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

const respostasRapidas = [
  "Olá! Recebemos sua solicitação e já estamos trabalhando nela.",
  "Pode nos enviar uma cópia do último comprovante, por favor?",
  "Renovação concluída com sucesso! Já está disponível no portal.",
  "Estamos aguardando a liberação do órgão, retornamos em breve.",
];

function ResponderModal({
  open,
  onOpenChange,
  ticket,
  onEnviar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: AdminTicketDetalhe;
  onEnviar: (mensagem: string, fechar: boolean, arquivos: File[]) => Promise<void>;
}) {
  const [resposta, setResposta] = useState("");
  const [anexos, setAnexos] = useState<ReplyAnexo[]>([]);
  const [fechar, setFechar] = useState(false);
  const [drag, setDrag] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const novos: ReplyAnexo[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_ANEXO_TICKET_BYTES) {
        toast.error(`${f.name} excede o limite de 20 MB`);
        continue;
      }
      novos.push({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        type: f.type,
        file: f,
      });
    }
    if (novos.length) setAnexos((prev) => [...prev, ...novos]);
  };

  const enviar = async () => {
    if (resposta.trim().length < 2) {
      toast.error("Escreva uma mensagem antes de enviar");
      return;
    }
    setEnviando(true);
    try {
      await onEnviar(
        resposta.trim(),
        fechar,
        anexos.map((a) => a.file),
      );
      setResposta("");
      setAnexos([]);
      setFechar(false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setResposta("");
          setAnexos([]);
          setFechar(false);
        }
      }}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-[820px]">
        <DialogTitle className="sr-only">Responder ticket {ticket.id}</DialogTitle>
        <div className="flex h-[88vh] max-h-[760px] flex-col">
          <header className="border-b bg-gradient-to-br from-primary/10 via-card to-card px-7 py-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Reply className="h-4 w-4" />
              Responder ao cliente
            </div>
            <h3 className="mt-2 text-xl font-bold tracking-tight">{ticket.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono font-semibold text-primary">#{ticket.id}</span>
              <span>•</span>
              <span>
                Para: <strong className="text-foreground">{ticket.client || "Cliente"}</strong>
              </span>
              {ticket.clientDocumento ? (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    CNPJ{" "}
                    <strong className="font-mono text-foreground">{formatCnpj(ticket.clientDocumento)}</strong>
                    <CopyButton
                      value={cnpjCopyValue(ticket.clientDocumento)}
                      label="CNPJ"
                      className="h-6 w-6 shrink-0"
                    />
                  </span>
                </>
              ) : null}
            </p>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-7 py-6">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Respostas rápidas
              </Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {respostasRapidas.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResposta(r)}
                    className="rounded-full border bg-card px-3 py-1 text-[11px] transition hover:border-primary hover:bg-primary/5"
                  >
                    {r.slice(0, 48)}...
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resposta-admin" className="text-sm font-semibold">
                Sua mensagem <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="resposta-admin"
                placeholder="Escreva sua resposta..."
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                className="min-h-[200px] resize-none text-base leading-relaxed"
                autoFocus
              />
              <p className="text-right text-xs text-muted-foreground">{resposta.length} caracteres</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Anexar arquivos</Label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                  drag
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold">
                  Arraste ou <span className="text-primary underline-offset-4 hover:underline">clique para selecionar</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">PDF, PNG, JPG, DOCX — até 20 MB cada</p>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </div>
              {anexos.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {anexos.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatBytes(a.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAnexos((p) => p.filter((x) => x.id !== a.id))}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={fechar}
                onChange={(e) => setFechar(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <CheckCircle2 className="h-4 w-4 text-success" />
              Marcar ticket como <strong>resolvido</strong> após envio
            </label>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t bg-muted/30 px-7 py-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              size="lg"
              onClick={() => void enviar()}
              disabled={resposta.trim().length < 2 || enviando}
              className="gap-2"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {fechar ? "Enviar e resolver" : "Enviar resposta"}
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
