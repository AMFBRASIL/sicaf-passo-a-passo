import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  MessageCircle,
  Bot,
  DollarSign,
  FileCheck2,
  Shield,
  Users,
  TrendingUp,
  Cloud,
  Plug,
} from "lucide-react";

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfiguracoesPage,
});

const cards = [
  { icon: Mail, titulo: "E-mails", desc: "Templates, remetente, SMTP", chip: "12 templates", tom: "blue" },
  { icon: MessageCircle, titulo: "WhatsApp", desc: "API oficial, webhooks, atendentes", chip: "Conectado", tom: "emerald" },
  { icon: Bot, titulo: "IA", desc: "Modelo, prompts, limites de uso", chip: "Lovable AI", tom: "violet" },
  { icon: DollarSign, titulo: "Financeiro", desc: "Gateway PIX, cartão, boleto, juros e multa", chip: "PIX + Asaas", tom: "emerald" },
  { icon: FileCheck2, titulo: "SICAF", desc: "Níveis obrigatórios, automações de vencimento", chip: "Níveis I–VI", tom: "amber" },
  { icon: Shield, titulo: "Segurança", desc: "2FA, sessões, política de senhas, IP allow-list", chip: "2FA opcional", tom: "rose" },
  { icon: Users, titulo: "Usuários e Papéis", desc: "Admin, Operador, Consulta — RBAC granular", chip: "8 ativos", tom: "blue" },
  { icon: TrendingUp, titulo: "Google Ads", desc: "Conta MCC, tag de conversão, atribuição", chip: "Conectado", tom: "emerald" },
  { icon: Cloud, titulo: "Armazenamento", desc: "Bucket de documentos, retenção, versionamento", chip: "120 GB usados", tom: "slate" },
  { icon: Plug, titulo: "Integrações", desc: "API pública, webhooks de saída, Zapier, n8n", chip: "5 conexões", tom: "violet" },
];

const tomCls: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  violet: "bg-violet-500/10 text-violet-600",
  amber: "bg-amber-500/10 text-amber-600",
  rose: "bg-rose-500/10 text-rose-600",
  slate: "bg-slate-500/10 text-slate-600",
};

function ConfiguracoesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Configurações Avançadas</h1>
          <p className="text-sm text-muted-foreground">Tudo o que controla o comportamento do sistema.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.titulo} className="group cursor-pointer p-5 transition hover:border-primary/40 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tomCls[c.tom]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className="text-[10px]">{c.chip}</Badge>
              </div>
              <h3 className="mt-3 text-sm font-semibold">{c.titulo}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
              <Button variant="ghost" size="sm" className="mt-3 h-7 px-0 text-xs text-primary hover:bg-transparent">
                Configurar →
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
