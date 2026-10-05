import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, CheckCircle2, Clock, Loader2, Pause, Play, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  alterarCampanha,
  fetchLogCampanha,
  type Campanha,
  type LogEnvio,
} from "@/lib/admin-servicos-captacao-api";
import { STATUS_CAMPANHA, dataHora, numero } from "./servicos-visual";

type Log = {
  campanha: Campanha;
  porMinuto: number;
  filaNesteServidor: boolean;
  itens: LogEnvio[];
};
type Acao = "pausar" | "retomar" | "cancelar" | "reenviar_falhas";

function hora(v: string | null) {
  if (!v) return "--:--:--";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "--:--:--" : d.toLocaleTimeString("pt-BR");
}

function previsao(pendentes: number, porMinuto: number) {
  if (!pendentes || !porMinuto) return null;
  const min = Math.ceil(pendentes / porMinuto);
  if (min < 2) return "menos de 2 minutos";
  if (min < 60) return `cerca de ${min} minutos`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return `cerca de ${h}h${resto ? ` ${resto}min` : ""}`;
}

/** Acompanha um disparo em tempo real. Fechar não interrompe o envio, que segue na fila do servidor. */
export function EnvioLogModal({
  campanhaId,
  onClose,
  onAtualizar,
}: {
  campanhaId: number | null;
  onClose: () => void;
  onAtualizar?: () => void;
}) {
  const [log, setLog] = useState<Log | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<Acao | null>(null);
  const requisicao = useRef(0);
  const statusAnterior = useRef<string | null>(null);
  const atualizarRef = useRef(onAtualizar);
  atualizarRef.current = onAtualizar;

  const carregar = useCallback(async () => {
    if (!campanhaId) return;
    const seq = ++requisicao.current;
    const res = await fetchLogCampanha(campanhaId);
    if (seq !== requisicao.current) return;
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setErro(null);
    setLog({
      campanha: res.campanha,
      porMinuto: res.porMinuto,
      filaNesteServidor: res.filaNesteServidor,
      itens: res.itens,
    });
    if (statusAnterior.current && statusAnterior.current !== res.campanha.status) {
      atualizarRef.current?.();
    }
    statusAnterior.current = res.campanha.status;
  }, [campanhaId]);

  useEffect(() => {
    setLog(null);
    setErro(null);
    statusAnterior.current = null;
    void carregar();
  }, [carregar]);

  const status = log?.campanha.status;
  useEffect(() => {
    if (!campanhaId || (status !== "enviando" && status !== "agendada")) return;
    const t = window.setInterval(() => void carregar(), status === "enviando" ? 2000 : 10000);
    return () => window.clearInterval(t);
  }, [campanhaId, status, carregar]);

  const executar = async (a: Acao) => {
    if (!campanhaId) return;
    if (
      a === "cancelar" &&
      !window.confirm(
        "Cancelar esta campanha? Os e-mails que ainda estão na fila não serão enviados.",
      )
    ) {
      return;
    }
    setAcao(a);
    const res = await alterarCampanha(campanhaId, a);
    setAcao(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (a === "reenviar_falhas") {
      toast.success(`${numero(res.reenfileirados || 0)} e-mails voltaram para a fila`);
    }
    await carregar();
    atualizarRef.current?.();
  };

  const c = log?.campanha;
  const processados = c ? c.enviados + c.falhas + c.cancelados : 0;
  const progresso = c?.total ? Math.round((processados / c.total) * 100) : 0;
  const st = c ? STATUS_CAMPANHA[c.status] : null;
  const eta = c?.status === "enviando" ? previsao(c.pendentes, log?.porMinuto || 0) : null;

  return (
    <Dialog open={!!campanhaId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl grid-cols-1 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            Disparo da campanha #{campanhaId}
            {st && (
              <Badge variant="outline" className={st.classe}>
                {c?.status === "enviando" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {st.label}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="truncate">
            {c
              ? `${c.servicoNome} · ${c.segmentoNome}${c.uf ? ` · ${c.uf}` : ""} — “${c.assunto}”`
              : " "}
          </DialogDescription>
        </DialogHeader>

        {!c ? (
          <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
            {erro || <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-end justify-between gap-3">
                <span className="text-3xl font-bold tracking-tight">{progresso}%</span>
                <span className="text-right text-xs text-muted-foreground">
                  {numero(processados)} de {numero(c.total)} processados
                </span>
              </div>
              <Progress value={progresso} className="h-2.5" />
              <p className="text-xs text-muted-foreground">
                {c.status === "agendada" && `Começa em ${dataHora(c.agendadaPara)}.`}
                {c.status === "enviando" &&
                  (log.porMinuto
                    ? `Ritmo: ${numero(log.porMinuto)} e-mails/min${eta ? ` · termina em ${eta}` : ""}.`
                    : processados
                      ? "Aguardando o próximo lote da fila…"
                      : "Enviando o primeiro lote…")}
                {c.status === "pausada" && "Pausada — nada sai até você retomar."}
                {c.status === "concluida" && `Concluída em ${dataHora(c.concluidaEm)}.`}
                {c.status === "cancelada" && `Cancelada em ${dataHora(c.concluidaEm)}.`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Contador label="Enviados" valor={c.enviados} classe="text-emerald-600" />
              <Contador label="Falhas" valor={c.falhas} classe="text-rose-600" />
              <Contador
                label="Na fila"
                valor={c.status === "cancelada" ? 0 : c.pendentes}
                classe="text-slate-700"
              />
              <Contador label="Cancelados" valor={c.cancelados} classe="text-slate-500" />
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <span>Log de envio (mais recentes primeiro)</span>
                {c.status === "enviando" && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    ao vivo
                  </span>
                )}
              </div>
              <div className="h-64 overflow-y-auto overflow-x-hidden bg-slate-950 px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-200">
                {!log.itens.length ? (
                  <p className="flex items-center gap-2 text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    {c.status === "agendada"
                      ? "Aguardando o horário agendado."
                      : "Aguardando o primeiro lote da fila…"}
                  </p>
                ) : (
                  log.itens.map((i) => <LinhaLog key={i.id} item={i} />)
                )}
              </div>
            </div>
            {c.ultimoErro && (c.falhas > 0 || c.status === "pausada") && (
              <p className="break-words rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {c.status === "pausada" ? c.ultimoErro : `Último erro: ${c.ultimoErro}`}
              </p>
            )}
            {!log.filaNesteServidor && (c.status === "enviando" || c.status === "agendada") && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Este servidor não dispara e-mails (ambiente de desenvolvimento). Os envios saem pelo
                servidor de produção; o log acompanha o andamento normalmente.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {!!c?.falhas && status !== "cancelada" && status !== "enviando" && (
              <Button
                variant="outline"
                size="sm"
                disabled={!!acao}
                onClick={() => void executar("reenviar_falhas")}
              >
                {acao === "reenviar_falhas" ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                )}
                Reenviar {numero(c.falhas)} falhas
              </Button>
            )}
            {(status === "enviando" || status === "agendada") && (
              <Button
                variant="outline"
                size="sm"
                disabled={!!acao}
                onClick={() => void executar("pausar")}
              >
                {acao === "pausar" ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pause className="mr-1 h-3.5 w-3.5" />
                )}
                Pausar
              </Button>
            )}
            {status === "pausada" && (
              <Button
                variant="outline"
                size="sm"
                disabled={!!acao}
                onClick={() => void executar("retomar")}
              >
                <Play className="mr-1 h-3.5 w-3.5" />
                Retomar
              </Button>
            )}
            {status && !["concluida", "cancelada"].includes(status) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:text-rose-700"
                disabled={!!acao}
                onClick={() => void executar("cancelar")}
              >
                <Ban className="mr-1 h-3.5 w-3.5" />
                Cancelar
              </Button>
            )}
          </div>
          <Button size="sm" onClick={onClose}>
            {status === "enviando" || status === "agendada"
              ? "Fechar (continua em segundo plano)"
              : "Fechar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Contador({ label, valor, classe }: { label: string; valor: number; classe: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${classe}`}>{numero(valor)}</p>
    </div>
  );
}

function LinhaLog({ item }: { item: LogEnvio }) {
  const icone =
    item.status === "enviado" ? (
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
    ) : item.status === "falha" ? (
      <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
    ) : item.status === "processando" ? (
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-400" />
    ) : (
      <Ban className="h-3.5 w-3.5 shrink-0 text-slate-500" />
    );
  const rotulo =
    item.status === "enviado"
      ? "enviado"
      : item.status === "falha"
        ? "falhou"
        : item.status === "processando"
          ? "enviando"
          : "cancelado";
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="shrink-0 text-slate-500">{hora(item.enviadoEm)}</span>
      {icone}
      <span className="min-w-0 flex-1 break-all">
        <span className="text-slate-100">{item.email}</span>
        <span className="text-slate-500"> · {item.empresa}</span>
        <span
          className={
            item.status === "falha"
              ? " text-rose-400"
              : item.status === "enviado"
                ? " text-emerald-400"
                : " text-slate-400"
          }
        >
          {" "}
          — {rotulo}
          {item.erro ? `: ${item.erro}` : ""}
        </span>
      </span>
    </div>
  );
}
