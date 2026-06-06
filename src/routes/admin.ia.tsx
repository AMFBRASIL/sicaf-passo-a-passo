import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Brain, BarChart3, AlertTriangle, FileText } from "lucide-react";

export const Route = createFileRoute("/admin/ia")({
  component: IAPage,
});

const sugestoes = [
  "Quais clientes têm maior risco de cancelamento?",
  "Quais clientes pagaram e ainda não enviaram documentos?",
  "Quais campanhas geraram mais receita este mês?",
  "Quantos SICAF vencem nos próximos 30 dias?",
  "Mostre os 50 maiores clientes por MRR.",
  "Qual funcionário tem o melhor SLA?",
];

interface Msg { role: "user" | "ia"; text: string; chips?: string[]; }

const conversaInicial: Msg[] = [
  { role: "user", text: "Quais clientes têm maior risco de cancelamento?" },
  {
    role: "ia",
    text: "Identifiquei 7 clientes em alto risco (score ≥ 75%). Os 3 principais são:",
    chips: [
      "Pavimar Obras — score 82% (sem login 14d)",
      "MEI José Roberto — score 79% (SICAF vencido 22d)",
      "Nova Filial Brasília — score 76% (não pagou 1ª fatura)",
    ],
  },
];

function IAPage() {
  const [msgs, setMsgs] = useState<Msg[]>(conversaInicial);
  const [input, setInput] = useState("");

  function enviar(text: string) {
    if (!text.trim()) return;
    setMsgs((m) => [
      ...m,
      { role: "user", text },
      { role: "ia", text: "Analisando dados em tempo real... (mock) — conecte o Lovable Cloud para respostas reais." },
    ]);
    setInput("");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            <Badge variant="outline" className="text-[10px]">IA Gerencial</Badge>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">Pergunte aos seus dados</h1>
          <p className="text-sm text-muted-foreground">Linguagem natural — a IA responde com dados reais do sistema.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="flex h-[560px] flex-col p-0">
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}>
                  <p>{m.text}</p>
                  {m.chips && (
                    <div className="mt-2 space-y-1">
                      {m.chips.map((c, j) => (
                        <div key={j} className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs">
                          {c}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); enviar(input); }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre clientes, receita, SICAF, equipe..."
                className="flex-1"
              />
              <Button type="submit" size="sm" className="gap-1.5">
                <Send className="h-3.5 w-3.5" /> Enviar
              </Button>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Sugestões
            </p>
            <div className="space-y-1.5">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="block w-full rounded-md border border-border/60 bg-background px-2.5 py-2 text-left text-xs transition hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

          <Card className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capacidades</p>
            <Cap icon={BarChart3} label="Análises financeiras" />
            <Cap icon={AlertTriangle} label="Detecção de risco" />
            <Cap icon={FileText} label="Resumos executivos" />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Cap({ icon: Icon, label }: any) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 text-violet-500" /> {label}
    </div>
  );
}
