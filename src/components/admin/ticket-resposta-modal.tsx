import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import {
  Ticket,
  MessageSquare,
  Paperclip,
  Send,
  CheckCircle2,
  Clock,
  User,
  Sparkles,
  FileText,
  ChevronRight,
  Loader2,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";
import { toast } from "sonner";

export interface TicketItem {
  id: string;
  titulo: string;
  status: string;
  prio: string;
  data: string;
}

/** Situações do kanban em /admin/suporte */
export const TICKET_SITUACOES = [
  "Novo",
  "Triagem",
  "Em andamento",
  "Aguardando Cliente",
  "Aguardando Governo",
  "Resolvido",
  "Fechado",
] as const;

export type TicketSituacao = (typeof TICKET_SITUACOES)[number];
export type ModoSituacaoTicket = "padrao" | "manual";

export type TicketRespostaOptions = {
  modoSituacao: ModoSituacaoTicket;
  /** Definida apenas quando modoSituacao === "manual" */
  situacaoManual?: TicketSituacao;
  /** Apenas no modo padrão: mover para Resolvido após envio */
  marcarResolvido?: boolean;
};

type MensagemHistorico = {
  autor: string;
  tipo: "cliente" | "agente";
  data: string;
  texto: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketItem | null;
  cliente?: { razao: string; responsavel: string };
  descricao?: string;
  mensagensHistorico?: MensagemHistorico[];
  slaLabel?: string;
  carregandoDetalhe?: boolean;
  enviando?: boolean;
  onEnviar?: (
    ticketId: string,
    mensagem: string,
    opcoes: TicketRespostaOptions,
  ) => void | Promise<void>;
}

type StepKey = "contexto" | "mensagens" | "resposta" | "finalizar";

const steps: { key: StepKey; label: string; desc: string; icon: any }[] = [
  { key: "contexto", label: "Contexto", desc: "Detalhes do ticket", icon: FileText },
  { key: "mensagens", label: "Conversa", desc: "Histórico de mensagens", icon: MessageSquare },
  { key: "resposta", label: "Resposta", desc: "Escreva sua resposta", icon: Send },
  { key: "finalizar", label: "Finalizar", desc: "Revisar e enviar", icon: CheckCircle2 },
];

const respostasRapidas = [
  "Olá! Recebemos sua solicitação e já estamos trabalhando nela.",
  "Pode nos enviar uma cópia do último comprovante, por favor?",
  "Renovação concluída com sucesso! Já está disponível no portal.",
  "Estamos aguardando a liberação do órgão, retornamos em breve.",
];

export function situacaoPadraoAposEnvio(statusAtual: string, marcarResolvido: boolean): TicketSituacao {
  if (marcarResolvido) return "Resolvido";
  if (statusAtual === "Novo") return "Em andamento";
  return (TICKET_SITUACOES.includes(statusAtual as TicketSituacao)
    ? statusAtual
    : "Em andamento") as TicketSituacao;
}

function descricaoSituacaoPadrao(statusAtual: string, marcarResolvido: boolean): string {
  if (marcarResolvido) return "O ticket será movido para Resolvido.";
  if (statusAtual === "Novo") return "Primeira resposta: o ticket irá para Em andamento.";
  return `A situação permanece em «${statusAtual}».`;
}

export function TicketRespostaModal({
  open,
  onOpenChange,
  ticket,
  cliente,
  descricao,
  mensagensHistorico,
  slaLabel,
  carregandoDetalhe,
  enviando,
  onEnviar,
}: Props) {
  const [step, setStep] = useState<StepKey>("contexto");
  const [mensagem, setMensagem] = useState("");
  const [modoSituacao, setModoSituacao] = useState<ModoSituacaoTicket>("padrao");
  const [situacaoManual, setSituacaoManual] = useState<TicketSituacao>("Em andamento");
  const [marcarResolvido, setMarcarResolvido] = useState(false);

  useEffect(() => {
    if (!open || !ticket) return;
    setStep("contexto");
    setMensagem("");
    setModoSituacao("padrao");
    setMarcarResolvido(false);
    const atual = TICKET_SITUACOES.includes(ticket.status as TicketSituacao)
      ? (ticket.status as TicketSituacao)
      : "Em andamento";
    setSituacaoManual(atual);
  }, [open, ticket?.id, ticket?.status]);

  const situacaoPrevista = useMemo((): TicketSituacao => {
    if (!ticket) return "Em andamento";
    if (modoSituacao === "manual") return situacaoManual;
    return situacaoPadraoAposEnvio(ticket.status, marcarResolvido);
  }, [ticket, modoSituacao, situacaoManual, marcarResolvido]);

  if (!ticket) return null;

  const enviar = async () => {
    if (!mensagem.trim()) {
      toast.error("Escreva uma mensagem antes de enviar");
      return;
    }
    const opcoes: TicketRespostaOptions = {
      modoSituacao,
      situacaoManual: modoSituacao === "manual" ? situacaoManual : undefined,
      marcarResolvido: modoSituacao === "padrao" ? marcarResolvido : undefined,
    };
    try {
      await onEnviar?.(ticket.id, mensagem, opcoes);
      const msgSucesso =
        situacaoPrevista === "Fechado"
          ? "Resposta enviada e ticket fechado"
          : situacaoPrevista !== ticket.status
            ? `Resposta enviada · situação: ${situacaoPrevista}`
            : "Resposta enviada ao cliente";
      toast.success(msgSucesso);
      setMensagem("");
      setModoSituacao("padrao");
      setMarcarResolvido(false);
      setStep("contexto");
      onOpenChange(false);
    } catch {
      // Erro tratado pelo chamador
    }
  };

  const mensagens: MensagemHistorico[] =
    mensagensHistorico && mensagensHistorico.length > 0
      ? mensagensHistorico
      : carregandoDetalhe
        ? []
        : [
            {
              autor: cliente?.responsavel || "Cliente",
              tipo: "cliente",
              data: ticket.data,
              texto: descricao || `Solicitação: ${ticket.titulo}`,
            },
          ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Responder ticket {ticket.id}</DialogTitle>
        <div className="grid grid-cols-[280px_1fr] min-h-[600px]">
          {/* Sidebar com imagem de fundo */}
          <div
            className="relative p-6 text-white flex flex-col"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.95)), url(${wizardBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
                <Ticket className="h-4 w-4" />
              </div>
              <span className="text-xs font-mono opacity-80">{ticket.id}</span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">{ticket.titulo}</h2>
            <p className="mt-1 text-xs text-white/70">{cliente?.razao}</p>

            <div className="mt-6 space-y-1">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const active = s.key === step;
                const idxAtual = steps.findIndex((x) => x.key === step);
                const done = i < idxAtual;
                return (
                  <button
                    key={s.key}
                    onClick={() => setStep(s.key)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-3 transition ${
                      active ? "bg-white/15 backdrop-blur" : "hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        active ? "bg-white text-slate-900" : done ? "bg-emerald-500/80 text-white" : "bg-white/10"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-[11px] text-white/60 truncate">{s.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-6 text-[11px] text-white/60">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> SLA: {slaLabel || "—"}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <User className="h-3 w-3" /> Atribuído a você
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex flex-col bg-background">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <div className="text-xs text-muted-foreground">Etapa</div>
                <div className="text-base font-semibold">{steps.find((s) => s.key === step)?.label}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={ticket.prio === "alta" ? "destructive" : "secondary"} className="text-[10px]">
                  prioridade {ticket.prio}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {ticket.status}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[460px]">
              <div className="px-6 py-5">
                {step === "contexto" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Cliente" value={cliente?.razao || "—"} />
                      <InfoCard label="Responsável" value={cliente?.responsavel || "—"} />
                      <InfoCard label="Abertura" value={ticket.data} />
                      <InfoCard label="Status" value={ticket.status} />
                    </div>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1.5">Descrição</div>
                      {carregandoDetalhe ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Carregando...
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {descricao || ticket.titulo}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {step === "mensagens" && (
                  <div className="space-y-3">
                    {carregandoDetalhe && (
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Carregando mensagens...
                      </div>
                    )}
                    {!carregandoDetalhe && mensagens.length === 0 && (
                      <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                        Nenhuma mensagem ainda
                      </div>
                    )}
                    {mensagens.map((m, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3 ${
                          m.tipo === "agente" ? "bg-primary/5 border-primary/20" : "bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold">{m.autor}</span>
                          <span className="text-[11px] text-muted-foreground">{m.data}</span>
                        </div>
                        <p className="text-sm">{m.texto}</p>
                      </div>
                    ))}
                  </div>
                )}

                {step === "resposta" && (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" /> Respostas rápidas
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {respostasRapidas.map((r) => (
                          <button
                            key={r}
                            onClick={() => setMensagem(r)}
                            className="text-[11px] rounded-full border bg-card px-2.5 py-1 hover:bg-accent"
                          >
                            {r.slice(0, 40)}...
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Escreva sua resposta para o cliente..."
                      rows={8}
                    />
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" /> Anexar
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Situação do ticket
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Atual: <span className="font-medium text-foreground">{ticket.status}</span>
                          {situacaoPrevista !== ticket.status && (
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
                          Padrão (automático)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={modoSituacao === "manual" ? "default" : "outline"}
                          className="h-8 text-xs"
                          onClick={() => setModoSituacao("manual")}
                        >
                          Definir manualmente
                        </Button>
                      </div>

                      {modoSituacao === "padrao" ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {descricaoSituacaoPadrao(ticket.status, marcarResolvido)}
                          </p>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={marcarResolvido}
                              onChange={(e) => setMarcarResolvido(e.target.checked)}
                              className="h-3.5 w-3.5"
                            />
                            Marcar como resolvido após envio
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label htmlFor="situacao-manual" className="text-xs">
                            Nova situação
                          </Label>
                          <Select
                            value={situacaoManual}
                            onValueChange={(v) => setSituacaoManual(v as TicketSituacao)}
                          >
                            <SelectTrigger id="situacao-manual" className="h-9 text-sm">
                              <SelectValue placeholder="Selecione a situação" />
                            </SelectTrigger>
                            <SelectContent>
                              {TICKET_SITUACOES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                  {s === ticket.status ? " (atual)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Use para reabrir, aguardar cliente/governo ou fechar o chamado.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === "finalizar" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-card p-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Sua resposta</div>
                      <p className="text-sm whitespace-pre-wrap">
                        {mensagem || <span className="text-muted-foreground italic">Nenhuma mensagem escrita ainda.</span>}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Destinatário" value={cliente?.responsavel || "Cliente"} />
                      <InfoCard
                        label="Situação após envio"
                        value={
                          situacaoPrevista === ticket.status
                            ? `Manter em ${ticket.status}`
                            : `${ticket.status} → ${situacaoPrevista}`
                        }
                      />
                      <InfoCard
                        label="Modo"
                        value={modoSituacao === "padrao" ? "Padrão (automático)" : "Manual"}
                      />
                      <InfoCard label="Ação" value="Enviar resposta ao cliente" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t px-6 py-3 flex items-center justify-between bg-card/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const idx = steps.findIndex((s) => s.key === step);
                  if (idx > 0) setStep(steps[idx - 1].key);
                  else onOpenChange(false);
                }}
              >
                {step === "contexto" ? "Cancelar" : "Voltar"}
              </Button>
              {step !== "finalizar" ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const idx = steps.findIndex((s) => s.key === step);
                    setStep(steps[idx + 1].key);
                  }}
                >
                  Continuar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5" onClick={() => void enviar()} disabled={enviando}>
                  {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {enviando ? "Enviando..." : "Enviar resposta"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
