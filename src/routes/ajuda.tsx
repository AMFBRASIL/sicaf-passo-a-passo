import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle, Search, PlayCircle, Bot, Sparkles, Loader2, FileText, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, PageContainer } from "@/components/page-header";
import { AjudaTutorialGovModal } from "@/components/ajuda-tutorial-gov-modal";
import { TOPICOS_CADASTRO_SICAF, type TutorialGovTopico } from "@/lib/ajuda-tutoriais-sicaf";
import { useRef, useState } from "react";
import { perguntarAjuda } from "@/lib/ajuda-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda — CADBRASIL" },
      { name: "description", content: "Pergunte qualquer coisa — nosso assistente responde na hora." },
    ],
  }),
  component: HelpPage,
});

const sugestoes = [
  "Como atualizar SICAF",
  "Como colocar situação Fornecedor",
  "Não tenho certificado digital",
  "Onde envio documentos",
  "Como emitir certidão estadual",
  "O que é Nível IV",
];

type VideoAjuda = {
  id: string;
  titulo: string;
  duracao: string;
  src?: string;
  youtubeId?: string;
  emBreve?: boolean;
};

const videos: VideoAjuda[] = [
  {
    id: "01",
    titulo: "Como usar o Assistente e atualizar SICAF",
    duracao: "Etapa 01 · Inicial",
    youtubeId: "ZG3csRrz1rQ",
  },
  {
    id: "02",
    titulo: "Como atualizar certidões",
    duracao: "Etapa 01 · Vídeo 02",
    youtubeId: "HzfZo8MkLd0",
  },
  {
    id: "03",
    titulo: "Como enviar documentos",
    duracao: "Etapa 01 · Vídeo 03",
    youtubeId: "W8sf1hRdI2g",
  },
  {
    id: "04",
    titulo: "Como contratar manutenção",
    duracao: "Etapa 01 · Vídeo 04",
    youtubeId: "EERC88Y_aMo",
  },
  {
    id: "05",
    titulo: "Como colocar situação Fornecedor",
    duracao: "Etapa 01 · Vídeo 05",
    youtubeId: "saruhhQWlPM",
  },
];

function HelpPage() {
  const [q, setQ] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoAtivo, setVideoAtivo] = useState<VideoAjuda | null>(null);
  const [tutorialGovOpen, setTutorialGovOpen] = useState(false);
  const [tutorialGovAtivo, setTutorialGovAtivo] = useState<TutorialGovTopico | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  function abrirTutorialGov(topico: TutorialGovTopico) {
    setTutorialGovAtivo(topico);
    setTutorialGovOpen(true);
  }

  function abrirVideo(v: VideoAjuda) {
    if (!v.src && !v.youtubeId) return;
    setVideoAtivo(v);
    setVideoModalOpen(true);
  }

  function onVideoModalChange(open: boolean) {
    if (!open) {
      videoRef.current?.pause();
      setVideoModalOpen(false);
    }
  }

  async function ask(text: string) {
    setQ(text);
    setResposta(null);
    setLoading(true);
    const res = await perguntarAjuda(text, (partial) => setResposta(partial));
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível consultar o assistente");
      setResposta("Não consegui responder agora. Tente novamente em instantes ou abra um chamado em Suporte.");
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<HelpCircle className="h-5 w-5" />}
        title="Central de Ajuda Inteligente"
        subtitle="Pergunte do seu jeito. Respondemos na hora."
      />

      <Card className="mt-6 border-primary/30 shadow-soft">
        <CardContent className="p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) ask(q.trim());
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="O que você precisa fazer?"
                className="h-12 pl-9 text-base"
              />
            </div>
            <Button type="submit" size="lg">
              Perguntar
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <button
                key={s}
                onClick={() => {
                  if (s === "Como colocar situação Fornecedor") {
                    const video = videos.find((v) => v.id === "05");
                    if (video) abrirVideo(video);
                    return;
                  }
                  ask(s);
                }}
                className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition hover:border-primary/40 hover:bg-primary/5"
              >
                {s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {(loading || resposta) && (
        <Card className="mt-4 border-primary/30 bg-gradient-to-br from-primary/5 to-card">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                Assistente CADBRASIL <Sparkles className="h-3.5 w-3.5 text-warning" />
              </div>
              <p className="mt-1 text-sm leading-relaxed">
                {loading && !resposta
                  ? "Consultando a base de conhecimento CADBRASIL..."
                  : resposta}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Guias e vídeos explicativos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Etapa 01 — tutoriais CADBRASIL · Etapa 02 — cadastramento oficial no Compras.gov.br
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                01
              </span>
              <div>
                <p className="text-sm font-semibold">Etapa 01 — Portal CADBRASIL</p>
                <p className="text-xs text-muted-foreground">
                  Assistente, certidões, documentos, manutenção e situação do fornecedor
                </p>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {videos.map((v) => {
                const clicavel = Boolean(v.src || v.youtubeId);
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      disabled={!clicavel}
                      onClick={() => abrirVideo(v)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition",
                        clicavel
                          ? "border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-soft cursor-pointer"
                          : "border-border opacity-60 cursor-not-allowed",
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                        <span className="text-xs font-bold">{v.id}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{v.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {clicavel ? "Clique para assistir no YouTube" : v.duracao}
                        </p>
                      </div>
                      {clicavel && (
                        <PlayCircle className="h-5 w-5 shrink-0 text-primary opacity-70 transition group-hover:opacity-100" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                02
              </span>
              <div>
                <p className="text-sm font-semibold">Etapa 02 — Cadastramento SICAF</p>
                <p className="text-xs text-muted-foreground">
                  Tutoriais oficiais do Compras.gov.br — clique para abrir no portal
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/5 to-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Cadastramento SICAF</p>
                  <p className="text-xs text-muted-foreground">
                    Cadastro, linha de fornecimento, CRC e situação no governo
                  </p>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {TOPICOS_CADASTRO_SICAF.map((topico) => (
                  <li key={topico.id}>
                    <button
                      type="button"
                      onClick={() => abrirTutorialGov(topico)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition",
                        "hover:border-primary/40 hover:bg-primary/5 hover:shadow-soft cursor-pointer",
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{topico.titulo}</p>
                        <p className="text-xs text-muted-foreground">{topico.subtitulo}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </CardContent>
      </Card>

      <AjudaTutorialGovModal
        open={tutorialGovOpen}
        onOpenChange={setTutorialGovOpen}
        topico={tutorialGovAtivo}
      />

      <Dialog open={videoModalOpen} onOpenChange={onVideoModalChange}>
        <DialogContent className="flex h-[80vh] w-[80vw] max-h-[80vh] max-w-[80vw] flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="shrink-0 border-b px-5 py-4 text-left">
            <DialogTitle className="pr-8 text-base leading-snug sm:text-lg">
              {videoAtivo?.titulo}
            </DialogTitle>
            {videoAtivo?.duracao && (
              <p className="text-xs text-muted-foreground">{videoAtivo.duracao}</p>
            )}
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
            {videoAtivo?.youtubeId ? (
              <iframe
                key={videoAtivo.youtubeId}
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${videoAtivo.youtubeId}?autoplay=1&rel=0`}
                title={videoAtivo.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : videoAtivo?.src ? (
              <video
                ref={videoRef}
                key={videoAtivo.src}
                className="h-full w-full object-contain"
                controls
                playsInline
                autoPlay
                preload="metadata"
                src={videoAtivo.src}
              >
                Seu navegador não suporta reprodução de vídeo.
              </video>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
