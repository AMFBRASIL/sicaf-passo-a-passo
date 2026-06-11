import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle, Search, PlayCircle, Bot, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageContainer } from "@/components/page-header";
import { useState } from "react";
import { perguntarAjuda } from "@/lib/ajuda-api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  "Não tenho certificado digital",
  "Onde envio documentos",
  "Como emitir certidão estadual",
  "O que é Nível IV",
];

const videos = [
  { titulo: "Como acessar o SICAF", duracao: "2 min" },
  { titulo: "Como atualizar certidões", duracao: "3 min" },
  { titulo: "Como enviar documentos", duracao: "2 min" },
  { titulo: "Como contratar a manutenção mensal", duracao: "1 min" },
];

function HelpPage() {
  const [q, setQ] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
            <Button type="submit" size="lg">Perguntar</Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
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
        <CardHeader>
          <CardTitle className="text-base font-semibold">Vídeos explicativos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {videos.map((v) => (
              <li
                key={v.titulo}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-soft"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{v.titulo}</p>
                  <p className="text-xs text-muted-foreground">{v.duracao}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
