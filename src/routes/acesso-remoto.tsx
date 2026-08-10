import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  AppWindow,
  Check,
  Copy,
  Headphones,
  Loader2,
  Monitor,
  MonitorUp,
  ScreenShare,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsappFloatingButton } from "@/components/whatsapp-floating-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { RemoteLaserOverlay } from "@/components/suporte-remoto/remote-laser-overlay";
import { RemoteSupportChat, StatusPill } from "@/components/suporte-remoto/remote-support-chat";
import { useRemoteSupport } from "@/hooks/use-remote-support";
import { criarSessaoRemota, type RemoteSupportSessao } from "@/lib/suporte-remoto-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/acesso-remoto")({
  head: () => ({
    meta: [
      { title: "Suporte remoto — CADBRASIL" },
      { name: "description", content: "Compartilhe sua tela com o atendente." },
    ],
  }),
  component: AcessoRemotoPage,
});

function AcessoRemotoPage() {
  const navigate = useNavigate();
  const [boot, setBoot] = useState<RemoteSupportSessao | null>(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingNow, setSharingNow] = useState(false);

  const {
    sessao,
    mensagens,
    error,
    sharing,
    webrtcState,
    laserPoint,
    laserClicks,
    enviarMensagem,
    encerrar,
    compartilharTela,
    setSessao,
  } = useRemoteSupport({
    role: "cliente",
    sessaoId: boot?.id ?? null,
    enabled: !!boot?.id,
  });

  const current = sessao || boot;
  const ended = current?.status === "ended";
  const attendantIn = !!current?.atendenteId && current.status !== "waiting_attendant" && !ended;
  const chatLive = attendantIn || current?.atendenteOnline;

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    if (attendantIn && !sharing && !ended) setShareModalOpen(true);
    if (sharing || ended) setShareModalOpen(false);
  }, [attendantIn, sharing, ended]);

  const iniciar = async () => {
    setStarting(true);
    const res = await criarSessaoRemota();
    setStarting(false);
    if (!res.ok || !res.sessao) {
      toast.error(res.error || "Não foi possível iniciar o atendimento.");
      return;
    }
    setBoot(res.sessao);
    setSessao(res.sessao);
  };

  const copiar = async () => {
    if (!current?.codigo) return;
    try {
      await navigator.clipboard.writeText(current.codigo);
      setCopied(true);
      toast.success("Código copiado.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  };

  const sair = async () => {
    if (boot?.id && !ended) await encerrar();
    void navigate({ to: "/suporte" });
  };

  const compartilhar = async () => {
    setSharingNow(true);
    const res = await compartilharTela();
    setSharingNow(false);
    if (!res?.ok) {
      toast.error(res?.error || "Não foi possível compartilhar a tela.");
      return;
    }
    setShareModalOpen(false);
  };

  const headerStatus = ended
    ? { tone: "danger" as const, label: "Atendimento encerrado" }
    : sharing
      ? { tone: "ok" as const, label: "Compartilhando tela" }
      : attendantIn
        ? { tone: "wait" as const, label: "Aguardando compartilhamento" }
        : current
          ? { tone: "wait" as const, label: "Aguardando atendente..." }
          : { tone: "ok" as const, label: "Pronto para começar" };

  return (
    <div className="min-h-dvh bg-[#F4F6FA] text-slate-900">
      {sharing && !ended ? (
        <RemoteLaserOverlay point={laserPoint} clicks={laserClicks} mapToViewport />
      ) : null}
      <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold leading-tight">Suporte remoto</p>
            <p className="text-xs text-slate-500">Área do cliente — não feche esta aba durante o atendimento.</p>
          </div>
        </div>
        <StatusPill tone={headerStatus.tone}>{headerStatus.label}</StatusPill>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-64px)] max-w-6xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
        <section className="flex min-h-[420px] flex-col justify-center">
          {!current ? (
            <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Suporte remoto</p>
              <p className="mt-3 text-sm text-slate-500">
                Compartilhe sua tela com nosso atendente para receber ajuda.
              </p>
              <button
                type="button"
                onClick={() => void iniciar()}
                disabled={starting}
                className="mt-8 inline-flex h-12 min-w-[220px] items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60"
              >
                {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Iniciar atendimento
              </button>
              <ul className="mx-auto mt-8 max-w-md space-y-3 text-left text-sm text-slate-600">
                {[
                  "O atendente apenas visualiza o que você escolher mostrar.",
                  "Nenhum controle de mouse, teclado ou arquivos.",
                  "Você pode parar o compartilhamento a qualquer momento.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-xl space-y-4">
              <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Código do atendimento
                </p>
                <p className="mt-3 font-mono text-5xl font-bold tracking-[0.18em] text-slate-900 sm:text-6xl">
                  {current.codigoFormatado || current.codigo}
                </p>
                <button
                  type="button"
                  onClick={() => void copiar()}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar código
                </button>
              </div>

              <div className="rounded-3xl bg-white p-7 text-center shadow-sm">
                {ended ? (
                  <>
                    <p className="text-lg font-semibold">Atendimento encerrado</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Você pode voltar ao suporte ou iniciar outro acesso.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <Link
                        to="/suporte"
                        className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Voltar ao suporte
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setBoot(null);
                          setSessao(null);
                        }}
                        className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white"
                      >
                        Novo atendimento
                      </button>
                    </div>
                  </>
                ) : attendantIn ? (
                  <>
                    <p className="text-lg font-semibold">Atendente conectado</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Quando estiver pronto, autorize o compartilhamento no seu navegador.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => setShareModalOpen(true)}
                        disabled={sharing}
                        className={cn(
                          "inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm",
                          sharing ? "bg-emerald-600 text-white" : "bg-primary text-white hover:bg-primary/90",
                        )}
                      >
                        {sharing ? <MonitorUp className="h-4 w-4" /> : <ScreenShare className="h-4 w-4" />}
                        {sharing ? "Compartilhando..." : "Compartilhar minha tela"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void sair()}
                        className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:underline"
                      >
                        <X className="h-4 w-4" />
                        Encerrar atendimento
                      </button>
                    </div>
                    {sharing ? (
                      <p className="mt-4 text-xs text-slate-400">
                        WebRTC: {webrtcState} · O atendente pode apontar com um laser vermelho na sua tela
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">Aguardando atendente...</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Informe o código acima ao atendente para que ele entre no atendimento.
                    </p>
                    <button
                      type="button"
                      onClick={() => void sair()}
                      className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:underline"
                    >
                      <X className="h-4 w-4" />
                      Encerrar atendimento
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="h-[min(640px,70dvh)] lg:h-auto">
          <RemoteSupportChat
            title="Chat com o atendente"
            mensagens={mensagens}
            selfRole="cliente"
            disabled={!current || ended}
            badge={
              <StatusPill tone={chatLive ? "ok" : "idle"}>
                {ended ? "Offline" : chatLive ? "Conectado" : "Offline"}
              </StatusPill>
            }
            onSend={enviarMensagem}
          />
        </div>
      </div>

      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-h-[min(92dvh,44rem)] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto p-0 sm:max-w-3xl">
          <div className="border-b bg-red-50 px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                <Monitor className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl">Compartilhe a tela INTEIRA</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-slate-600 sm:text-base">
                  No próximo passo o navegador vai pedir o que você quer mostrar. Escolha a opção{" "}
                  <strong className="text-red-700">Tela inteira</strong> — não use janela nem aba.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6 sm:px-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4 text-center">
                <Monitor className="mx-auto h-10 w-10 text-red-600" />
                <p className="mt-3 text-sm font-semibold text-red-800">Tela inteira</p>
                <p className="mt-1 text-xs text-red-700">Escolha esta opção</p>
              </div>
              <div className="rounded-2xl border border-dashed bg-muted/40 p-4 text-center opacity-70">
                <AppWindow className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold text-muted-foreground">Janela</p>
                <p className="mt-1 text-xs text-muted-foreground">Não escolha</p>
              </div>
              <div className="rounded-2xl border border-dashed bg-muted/40 p-4 text-center opacity-70">
                <ScreenShare className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold text-muted-foreground">Aba do Chrome</p>
                <p className="mt-1 text-xs text-muted-foreground">Não escolha</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Como fazer no navegador
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-6 text-amber-900/90">
                <li>Clique em <strong>Compartilhar</strong> abaixo.</li>
                <li>Na janela do navegador, clique na aba <strong>Tela inteira</strong> (ou Entire Screen).</li>
                <li>Selecione o monitor e confirme.</li>
              </ol>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShareModalOpen(false)} disabled={sharingNow}>
                Agora não
              </Button>
              <Button
                type="button"
                onClick={() => void compartilhar()}
                disabled={sharingNow}
                className="h-12 min-w-[200px] bg-red-600 text-base text-white hover:bg-red-700"
              >
                {sharingNow ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScreenShare className="h-4 w-4" />}
                {sharingNow ? "Abrindo o navegador..." : "Compartilhar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <WhatsappFloatingButton />
    </div>
  );
}
