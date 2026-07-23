import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Bell,
  X,
  Mail,
  MessageSquare,
  Send,
  Loader2,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  executarDisparoMassa,
  executarDisparoMassaStream,
  fetchResumoPublicoAlvo,
  MODELOS_MENSAGEM_PADRAO,
  type CobrancaDisparoEvent,
  type ModeloMensagemKey,
  type PublicoAlvoKey,
  type ResumoPublicoAlvo,
} from "@/lib/cobranca-api";

type CanalMassa = "email" | "whatsapp" | "sms";

const PUBLICO_CARDS: { key: PublicoAlvoKey; label: string; sub: string }[] = [
  { key: "todos", label: "Todos em aberto", sub: "todos os clientes pendentes" },
  { key: "critica", label: "Críticos (+30 dias)", sub: "atraso grave" },
  { key: "media", label: "Atenção (10–30 dias)", sub: "risco moderado" },
  { key: "leve", label: "Leves (até 10 dias)", sub: "atraso recente" },
];

const MODELO_PILLS: { key: ModeloMensagemKey; label: string }[] = [
  { key: "lembrete_amigavel", label: "Lembrete amigável" },
  { key: "segunda_cobranca", label: "Segunda cobrança" },
  { key: "aviso_final", label: "Aviso final" },
];

type LogLine = { id: string; ok: boolean; message: string };

type ProgressState = {
  active: boolean;
  done: boolean;
  total: number;
  index: number;
  enviados: number;
  falhas: number;
  percent: number;
  logs: LogLine[];
};

const PROGRESS_IDLE: ProgressState = {
  active: false,
  done: false,
  total: 0,
  index: 0,
  enviados: 0,
  falhas: 0,
  percent: 0,
  logs: [],
};

function applyEvent(prev: ProgressState, event: CobrancaDisparoEvent): ProgressState {
  if (event.type === "start") {
    return {
      active: true,
      done: false,
      total: event.total || 0,
      index: 0,
      enviados: 0,
      falhas: 0,
      percent: 0,
      logs: [
        {
          id: `start-${Date.now()}`,
          ok: true,
          message: `Iniciando disparo para ${event.total} cliente(s)${
            event.canais?.length ? ` · canais: ${event.canais.join(", ")}` : ""
          }…`,
        },
      ],
    };
  }
  if (event.type === "item") {
    const label = event.empresa || event.email || `Cliente #${event.clienteId || "?"}`;
    const dest = event.email ? ` · ${event.email}` : "";
    return {
      ...prev,
      active: true,
      done: false,
      total: event.total,
      index: event.index,
      enviados: event.enviados,
      falhas: event.falhas ?? event.erros ?? 0,
      percent: event.percent,
      logs: [
        ...prev.logs,
        {
          id: `${event.index}-${event.clienteId || event.email || "x"}`,
          ok: event.ok,
          message: event.ok
            ? `OK · ${label}${dest}`
            : `ERRO · ${label}${dest} — ${event.error || "falha"}`,
        },
      ].slice(-500),
    };
  }
  if (event.type === "done") {
    const enviados = event.totalEnviados ?? event.enviados ?? prev.enviados;
    const falhas = event.totalErros ?? event.falhas ?? prev.falhas;
    return {
      ...prev,
      active: false,
      done: true,
      enviados,
      falhas,
      percent: 100,
      total: event.totalDestinatarios ?? event.total ?? prev.total,
      logs: [
        ...prev.logs,
        {
          id: `done-${Date.now()}`,
          ok: event.ok !== false,
          message:
            event.message ||
            `Concluído · ${enviados} ok · ${falhas} falhas`,
        },
      ].slice(-500),
    };
  }
  if (event.type === "error") {
    return {
      ...prev,
      active: false,
      done: true,
      logs: [
        ...prev.logs,
        {
          id: `error-${Date.now()}`,
          ok: false,
          message: `ERRO · ${event.error || "Falha no disparo"}`,
        },
      ].slice(-500),
    };
  }
  return prev;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConcluido?: () => void;
}

export function DisparoMassaModal({ open, onOpenChange, onConcluido }: Props) {
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [publico, setPublico] = useState<ResumoPublicoAlvo | null>(null);
  const [publicoAlvo, setPublicoAlvo] = useState<PublicoAlvoKey>("leve");
  const [canais, setCanais] = useState<CanalMassa[]>(["email"]);
  const [modelo, setModelo] = useState<ModeloMensagemKey>("segunda_cobranca");
  const [mensagem, setMensagem] = useState(MODELOS_MENSAGEM_PADRAO.segunda_cobranca);
  const [agendar, setAgendar] = useState(false);
  const [progress, setProgress] = useState<ProgressState>(PROGRESS_IDLE);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setProgress(PROGRESS_IDLE);
    setEnviando(false);
    setLoadingResumo(true);
    void fetchResumoPublicoAlvo().then((res) => {
      setLoadingResumo(false);
      if (res.ok && res.publico) setPublico(res.publico);
    });
  }, [open]);

  useEffect(() => {
    setMensagem(MODELOS_MENSAGEM_PADRAO[modelo]);
  }, [modelo]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [progress.logs.length]);

  const destinatarios = useMemo(() => {
    if (!publico) return 0;
    return publico[publicoAlvo] ?? 0;
  }, [publico, publicoAlvo]);

  const toggleCanal = (canal: CanalMassa) => {
    setCanais((prev) => {
      if (prev.includes(canal)) {
        const next = prev.filter((c) => c !== canal);
        return next.length ? next : prev;
      }
      return [...prev, canal];
    });
  };

  const handleDisparar = async () => {
    if (!canais.length) {
      toast.error("Selecione ao menos um canal");
      return;
    }
    if (!mensagem.trim()) {
      toast.error("Informe a mensagem");
      return;
    }
    setEnviando(true);

    if (agendar) {
      const res = await executarDisparoMassa({
        publicoAlvo,
        canais,
        modelo,
        mensagem: mensagem.trim(),
        agendar: true,
      });
      setEnviando(false);
      if (!res.ok) {
        toast.error(res.error || "Falha no agendamento");
        return;
      }
      toast.success(res.message || "Disparo agendado");
      onOpenChange(false);
      onConcluido?.();
      return;
    }

    setProgress({
      ...PROGRESS_IDLE,
      active: true,
      logs: [
        {
          id: `prep-${Date.now()}`,
          ok: true,
          message: "Preparando destinatários e iniciando envios…",
        },
      ],
    });

    const result = await executarDisparoMassaStream(
      {
        publicoAlvo,
        canais,
        modelo,
        mensagem: mensagem.trim(),
      },
      (event) => setProgress((prev) => applyEvent(prev, event)),
    );

    setEnviando(false);
    onConcluido?.();

    if (!result.ok) {
      toast.error(result.error || "Falha no disparo");
      return;
    }
    toast.success(
      result.message ||
        `Disparo concluído · ${result.totalEnviados ?? 0} ok · ${result.totalErros ?? 0} falhas`,
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (progress.active) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl [&>button:last-child]:hidden">
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Disparo em massa</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Envie cobranças simultaneamente e acompanhe o progresso em tempo real.
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={progress.active}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          {!progress.active && !progress.done && (
            <>
              <section>
                <p className="mb-3 text-sm font-semibold">Público alvo</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PUBLICO_CARDS.map((card) => {
                    const count = publico?.[card.key] ?? 0;
                    const selected = publicoAlvo === card.key;
                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() => setPublicoAlvo(card.key)}
                        className={`rounded-xl border p-3 text-left transition ${
                          selected
                            ? "border-rose-500 bg-rose-50 ring-1 ring-rose-500"
                            : "border-border hover:border-rose-200 hover:bg-muted/40"
                        }`}
                      >
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="mt-1 text-xl font-bold text-rose-600">
                          {loadingResumo ? "…" : count}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <p className="mb-3 text-sm font-semibold">Canais</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "whatsapp" as const, label: "WhatsApp", icon: MessageSquare },
                      { key: "email" as const, label: "E-mail", icon: Mail },
                      { key: "sms" as const, label: "SMS", icon: Send },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => {
                    const on = canais.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCanal(key)}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                          on
                            ? "border-rose-500 bg-rose-600 text-white"
                            : "border-border bg-background hover:bg-muted/50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                        {on && <span className="text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <p className="mb-3 text-sm font-semibold">Modelo da mensagem</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {MODELO_PILLS.map((pill) => (
                    <button
                      key={pill.key}
                      type="button"
                      onClick={() => setModelo(pill.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        modelo === pill.key
                          ? "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={4}
                  className="resize-none text-sm"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Variáveis: {"{nome}"}, {"{servico}"}, {"{valor}"}, {"{dias}"}, {"{link}"}
                </p>
              </section>

              <section className="space-y-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3">
                  <Checkbox checked={agendar} onCheckedChange={(v) => setAgendar(v === true)} />
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Agendar disparo para horário comercial (próximo dia útil às 09:00)
                  </div>
                </label>
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Este disparo será registrado no histórico de cada cliente e contará como tentativa de
                    contato.
                  </span>
                </div>
              </section>
            </>
          )}

          {(progress.active || progress.done) && (
            <section className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-rose-900">
                  {progress.active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : progress.falhas > 0 && progress.enviados === 0 ? (
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  {progress.active ? "Enviando cobranças…" : "Disparo finalizado"}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {progress.index}/{progress.total || "—"} · {progress.percent}%
                </p>
              </div>
              <Progress value={progress.percent} className="h-2" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-white px-2 py-1.5">
                  <p className="text-[10px] uppercase text-muted-foreground">Enviados</p>
                  <p className="text-sm font-bold text-emerald-700">{progress.enviados}</p>
                </div>
                <div className="rounded-lg border bg-white px-2 py-1.5">
                  <p className="text-[10px] uppercase text-muted-foreground">Falhas</p>
                  <p className="text-sm font-bold text-rose-700">{progress.falhas}</p>
                </div>
                <div className="rounded-lg border bg-white px-2 py-1.5">
                  <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                  <p className="text-sm font-bold text-slate-800">{progress.total}</p>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Log em tempo real
                </p>
                <div
                  ref={logRef}
                  className="h-56 space-y-0.5 overflow-y-auto rounded-lg border bg-slate-950 p-2.5 font-mono text-[11px] leading-relaxed"
                >
                  {progress.logs.map((l) => (
                    <div key={l.id} className={l.ok ? "text-emerald-300" : "text-rose-300"}>
                      {l.message}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Destinatários: <strong className="text-foreground">{destinatarios} clientes</strong>
          </p>
          <div className="flex gap-2">
            {progress.done ? (
              <Button
                onClick={() => {
                  setProgress(PROGRESS_IDLE);
                  onOpenChange(false);
                }}
              >
                Fechar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={enviando || progress.active}
                >
                  Cancelar
                </Button>
                <Button
                  className="gap-2 bg-rose-600 hover:bg-rose-700"
                  disabled={enviando || progress.active || destinatarios === 0}
                  onClick={() => void handleDisparar()}
                >
                  {enviando || progress.active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {agendar ? "Agendar disparo" : progress.active ? "Enviando…" : "Disparar agora"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
