import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bot, Zap, Mail, MessageCircle, FileCheck2, DollarSign, ArrowRight, Plus, Pencil, Bell, Calendar, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { FluxoAutomacaoModal, type FluxoAutomacao } from "@/components/admin/fluxo-automacao-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/automacoes")({
  component: AutomacoesPage,
});

const ICONS: Record<string, any> = {
  email: Mail,
  whatsapp: MessageCircle,
  ticket: FileCheck2,
  tarefa: CheckCircle2,
  cobranca: DollarSign,
  acesso: Zap,
  alerta: Bell,
  agendar: Calendar,
};

const fluxosIniciais: FluxoAutomacao[] = [
  {
    id: "1",
    nome: "Boas-vindas ao pagar",
    gatilho: "Cliente pagou primeira fatura",
    gatilhoTipo: "pagamento_recebido",
    acoes: [
      { tipo: "ticket", label: "Criar ticket", delay: "imediato" },
      { tipo: "email", label: "Enviar e-mail de boas-vindas", delay: "imediato" },
      { tipo: "acesso", label: "Liberar acesso ao SICAF", delay: "imediato" },
    ],
    ativo: true,
    rodou: 142,
  },
  {
    id: "2",
    nome: "Aviso de certidão vencendo",
    gatilho: "Certidão vence em 15 dias",
    gatilhoTipo: "certidao_vencendo",
    acoes: [
      { tipo: "whatsapp", label: "WhatsApp para responsável", delay: "imediato" },
      { tipo: "email", label: "E-mail com checklist", delay: "1 dia depois" },
      { tipo: "tarefa", label: "Criar tarefa para operador", delay: "imediato" },
    ],
    ativo: true,
    rodou: 68,
  },
  {
    id: "3",
    nome: "Cobrança automática",
    gatilho: "Boleto vence em 3 dias",
    gatilhoTipo: "boleto_vencendo",
    acoes: [
      { tipo: "whatsapp", label: "Lembrete WhatsApp", delay: "3 dias antes" },
      { tipo: "cobranca", label: "Gerar 2ª via PIX", delay: "no vencimento" },
    ],
    ativo: true,
    rodou: 231,
  },
  {
    id: "4",
    nome: "Recuperar cliente em risco",
    gatilho: "Score de cancelamento > 75%",
    gatilhoTipo: "score_risco",
    acoes: [
      { tipo: "alerta", label: "Alertar gerente da conta", delay: "imediato" },
      { tipo: "email", label: "Oferta de retenção", delay: "1 dia depois" },
    ],
    ativo: false,
    rodou: 14,
  },
];

function AutomacoesPage() {
  const [fluxos, setFluxos] = useState<FluxoAutomacao[]>(fluxosIniciais);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<FluxoAutomacao | null>(null);

  const novo = () => {
    setEditando(null);
    setModalOpen(true);
  };

  const editar = (f: FluxoAutomacao) => {
    setEditando(f);
    setModalOpen(true);
  };

  const salvar = (f: FluxoAutomacao) => {
    setFluxos((prev) => {
      const idx = prev.findIndex((x) => x.id === f.id);
      if (idx >= 0) {
        const novo = [...prev];
        novo[idx] = { ...f, rodou: prev[idx].rodou };
        return novo;
      }
      return [{ ...f, rodou: 0 }, ...prev];
    });
  };

  const toggle = (id: string, v: boolean) => {
    setFluxos((prev) => prev.map((x) => (x.id === id ? { ...x, ativo: v } : x)));
    toast.success(v ? "Fluxo ativado" : "Fluxo pausado");
  };

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
        <Button size="sm" className="gap-1.5" onClick={novo}>
          <Plus className="h-3.5 w-3.5" /> Novo fluxo
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {fluxos.map((f) => (
          <Card key={f.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{f.nome}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Gatilho: {f.gatilho}</p>
              </div>
              <Switch checked={f.ativo} onCheckedChange={(v) => toggle(f.id!, v)} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {f.acoes.map((a, i) => {
                const Icon = ICONS[a.tipo] ?? Zap;
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
              <span>Executou {(f.rodou ?? 0).toLocaleString("pt-BR")} vezes nos últimos 30 dias</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => editar(f)}>
                <Pencil className="h-3 w-3" /> Editar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <FluxoAutomacaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        fluxo={editando}
        onSalvar={salvar}
      />
    </div>
  );
}
