import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bot, Zap, Mail, MessageCircle, FileCheck2, DollarSign, ArrowRight, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/automacoes")({
  component: AutomacoesPage,
});

interface Auto { nome: string; gatilho: string; acoes: { icon: any; label: string }[]; ativo: boolean; rodou: number; }

const fluxos: Auto[] = [
  {
    nome: "Boas-vindas ao pagar",
    gatilho: "Cliente pagou primeira fatura",
    acoes: [
      { icon: FileCheck2, label: "Criar ticket" },
      { icon: Mail, label: "Enviar e-mail de boas-vindas" },
      { icon: Zap, label: "Liberar acesso ao SICAF" },
    ],
    ativo: true,
    rodou: 142,
  },
  {
    nome: "Aviso de certidão vencendo",
    gatilho: "Certidão vence em 15 dias",
    acoes: [
      { icon: MessageCircle, label: "WhatsApp para responsável" },
      { icon: Mail, label: "E-mail com checklist" },
      { icon: FileCheck2, label: "Criar tarefa para operador" },
    ],
    ativo: true,
    rodou: 68,
  },
  {
    nome: "Cobrança automática",
    gatilho: "Boleto vence em 3 dias",
    acoes: [
      { icon: MessageCircle, label: "Lembrete WhatsApp" },
      { icon: DollarSign, label: "Gerar 2ª via PIX" },
    ],
    ativo: true,
    rodou: 231,
  },
  {
    nome: "Recuperar cliente em risco",
    gatilho: "Score de cancelamento > 75%",
    acoes: [
      { icon: MessageCircle, label: "Alertar gerente da conta" },
      { icon: Mail, label: "Oferta de retenção" },
    ],
    ativo: false,
    rodou: 14,
  },
];

function AutomacoesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            <Badge variant="outline" className="text-[10px]">Automações</Badge>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">Fluxos automáticos</h1>
          <p className="text-sm text-muted-foreground">Quando isso acontecer, faça aquilo — sem ninguém precisar lembrar.</p>
        </div>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo fluxo</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {fluxos.map((f) => (
          <Card key={f.nome} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{f.nome}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Gatilho: {f.gatilho}</p>
              </div>
              <Switch checked={f.ativo} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {f.acoes.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs">
                      <Icon className="h-3 w-3" /> {a.label}
                    </span>
                    {i < f.acoes.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span>Executou {f.rodou.toLocaleString("pt-BR")} vezes nos últimos 30 dias</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs">Editar</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
