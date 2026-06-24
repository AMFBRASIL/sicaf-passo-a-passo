import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bell,
  X,
  Mail,
  MessageSquare,
  Send,
  Loader2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  executarDisparoMassa,
  fetchResumoPublicoAlvo,
  MODELOS_MENSAGEM_PADRAO,
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

  useEffect(() => {
    if (!open) return;
    setLoadingResumo(true);
    void fetchResumoPublicoAlvo().then((res) => {
      setLoadingResumo(false);
      if (res.ok && res.publico) setPublico(res.publico);
    });
  }, [open]);

  useEffect(() => {
    setMensagem(MODELOS_MENSAGEM_PADRAO[modelo]);
  }, [modelo]);

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
    const res = await executarDisparoMassa({
      publicoAlvo,
      canais,
      modelo,
      mensagem: mensagem.trim(),
      agendar,
    });
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.error || "Falha no disparo");
      return;
    }
    toast.success(res.message || "Disparo realizado com sucesso");
    onOpenChange(false);
    onConcluido?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl [&>button:last-child]:hidden">
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Disparo em massa</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Envie cobranças simultaneamente para um grupo de clientes inadimplentes.
              </DialogDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
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
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Destinatários: <strong className="text-foreground">{destinatarios} clientes</strong>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              className="gap-2 bg-rose-600 hover:bg-rose-700"
              disabled={enviando || destinatarios === 0}
              onClick={() => void handleDisparar()}
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {agendar ? "Agendar disparo" : "Disparar agora"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
