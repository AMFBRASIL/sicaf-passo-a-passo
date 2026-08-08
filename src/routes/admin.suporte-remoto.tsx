import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Headphones, LogOut, MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { RemoteSupportChat, StatusPill } from "@/components/suporte-remoto/remote-support-chat";
import { useRemoteSupport } from "@/hooks/use-remote-support";
import {
  entrarSessaoRemota,
  formatElapsed,
  onlyDigits,
  webrtcLabel,
  type RemoteSupportSessao,
} from "@/lib/suporte-remoto-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/suporte-remoto")({
  head: () => ({
    meta: [{ title: "Suporte Remoto — Admin" }],
  }),
  component: AdminSuporteRemotoPage,
});

const QUICK_REPLIES = [
  "Role a página para baixo.",
  "Clique no menu à esquerda.",
  "Clique no botão azul.",
  "Volte para a tela anterior.",
  "Conseguiu encontrar?",
];

function AdminSuporteRemotoPage() {
  const [codigo, setCodigo] = useState("");
  const [joining, setJoining] = useState(false);
  const [boot, setBoot] = useState<RemoteSupportSessao | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    sessao,
    mensagens,
    error,
    remoteStream,
    webrtcState,
    resolucao,
    enviarMensagem,
    encerrar,
    setSessao,
  } = useRemoteSupport({
    role: "atendente",
    sessaoId: boot?.id ?? null,
    enabled: !!boot?.id,
  });

  const current = sessao || boot;
  const ended = current?.status === "ended";
  const sharing = !!remoteStream;

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = remoteStream;
    if (remoteStream) void video.play().catch(() => undefined);
  }, [remoteStream]);

  const elapsed = useMemo(
    () => formatElapsed(current?.connectedAt || current?.createdAt),
    [current?.connectedAt, current?.createdAt, now],
  );

  const conectar = async () => {
    const digits = onlyDigits(codigo);
    if (digits.length !== 6) {
      toast.error("Informe o código de 6 dígitos.");
      return;
    }
    setJoining(true);
    const res = await entrarSessaoRemota(digits);
    setJoining(false);
    if (!res.ok || !res.sessao) {
      toast.error(res.error || "Código inválido.");
      return;
    }
    setBoot(res.sessao);
    setSessao(res.sessao);
  };

  const sair = async () => {
    if (boot?.id && !ended) await encerrar();
    setBoot(null);
    setSessao(null);
    setCodigo("");
  };

  if (!current) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-[#F4F6FA] px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-slate-600">
          <Headphones className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Remote Support</span>
        </div>
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Entrar em um atendimento</h1>
          <p className="mt-2 text-sm text-slate-500">Peça ao cliente o código exibido na tela dele.</p>
          <label className="mt-6 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Código do atendimento
          </label>
          <input
            value={codigo}
            onChange={(e) => setCodigo(onlyDigits(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void conectar();
            }}
            inputMode="numeric"
            maxLength={6}
            placeholder="4 8 2 9 1 3"
            className="mt-2 h-14 w-full rounded-xl border border-slate-200 bg-white text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-primary/50"
          />
          <button
            type="button"
            onClick={() => void conectar()}
            disabled={joining || onlyDigits(codigo).length !== 6}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            Conectar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-5 max-w-md text-center text-xs text-slate-500">
          Você só verá a tela que o cliente escolher compartilhar. Nenhum controle remoto é possível.
        </p>
      </div>
    );
  }

  const status = ended
    ? { tone: "danger" as const, label: "Encerrado" }
    : sharing
      ? { tone: "ok" as const, label: "Tela compartilhada" }
      : { tone: "wait" as const, label: "Aguardando compartilhamento" };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#F4F6FA]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Remote Support</p>
            <p className="text-xs text-slate-500">
              Atendimento #{current.codigoFormatado || current.codigo} · {elapsed}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          <button
            type="button"
            onClick={() => void sair()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sair
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-5">
        <section className="flex min-h-0 flex-col">
          <div
            className={cn(
              "relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden rounded-2xl",
              sharing ? "bg-slate-950" : "bg-[#0B1B33]",
            )}
          >
            <video
              ref={videoRef}
              className={cn("h-full w-full object-contain", sharing ? "block" : "hidden")}
              autoPlay
              playsInline
              muted
            />
            {!sharing && (
              <div className="max-w-md px-6 text-center text-white">
                <MonitorPlay className="mx-auto mb-4 h-12 w-12 text-white/70" />
                <p className="text-sm font-semibold uppercase tracking-[0.16em]">
                  Aguardando cliente compartilhar a tela
                </p>
                <p className="mt-2 text-sm text-white/70">
                  O cliente precisa autorizar o compartilhamento no próprio navegador. Nada é iniciado automaticamente.
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <InfoBox label="Resolução" value={resolucao || "—"} />
            <InfoBox label="WebRTC" value={webrtcLabel(webrtcState || current.webrtcState)} />
            <InfoBox label="Tempo conectado" value={elapsed} />
          </div>
        </section>

        <div className="h-[min(640px,70dvh)] lg:h-auto">
          <RemoteSupportChat
            title="Chat"
            placeholder="Digite sua orientação..."
            quickReplies={QUICK_REPLIES}
            mensagens={mensagens}
            selfRole="atendente"
            disabled={ended}
            badge={
              <StatusPill tone={current.clienteOnline || !ended ? "ok" : "idle"}>
                {ended ? "Offline" : "Cliente conectado"}
              </StatusPill>
            }
            onSend={enviarMensagem}
          />
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
