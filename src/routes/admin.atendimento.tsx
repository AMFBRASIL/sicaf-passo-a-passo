import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageCircle, Monitor, Mail, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/atendimento")({
  component: AtendimentoPage,
});

type Tipo = "WhatsApp" | "Telefone" | "AnyDesk" | "E-mail";

const tipos: Record<Tipo, { icon: any; cls: string }> = {
  WhatsApp: { icon: MessageCircle, cls: "bg-emerald-500/10 text-emerald-600" },
  Telefone: { icon: Phone, cls: "bg-blue-500/10 text-blue-600" },
  AnyDesk: { icon: Monitor, cls: "bg-rose-500/10 text-rose-600" },
  "E-mail": { icon: Mail, cls: "bg-violet-500/10 text-violet-600" },
};

const eventos: { cli: string; data: string; hora: string; tipo: Tipo; resp: string; assunto: string }[] = [
  { cli: "JR Construtora EIRELI", data: "Hoje", hora: "14:22", tipo: "WhatsApp", resp: "Anderson", assunto: "Renovação de SICAF vencido" },
  { cli: "Solar Brasil Energia", data: "Hoje", hora: "11:05", tipo: "AnyDesk", resp: "Maria S.", assunto: "Suporte para emissão de certidão" },
  { cli: "Engemax Serviços", data: "Hoje", hora: "09:21", tipo: "Telefone", resp: "João P.", assunto: "Dúvidas sobre Nível IV" },
  { cli: "Construtora Aurora", data: "Ontem", hora: "17:30", tipo: "E-mail", resp: "Carla R.", assunto: "Envio de procuração assinada" },
  { cli: "Pavimar Obras", data: "Ontem", hora: "10:11", tipo: "WhatsApp", resp: "Anderson", assunto: "Pagamento de mensalidade" },
  { cli: "MEI José Roberto", data: "2 dias", hora: "16:40", tipo: "Telefone", resp: "Maria S.", assunto: "Primeiro acesso ao portal" },
];

function AtendimentoPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Central de Atendimento</h1>
          <p className="text-sm text-muted-foreground">Registro de contatos por canal — histórico completo por cliente.</p>
        </div>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Registrar contato</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(Object.keys(tipos) as Tipo[]).map((t) => {
          const T = tipos[t].icon;
          return (
            <Card key={t} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t}</p>
                  <p className="mt-1 text-2xl font-bold">{eventos.filter(e => e.tipo === t).length * 7}</p>
                  <p className="text-xs text-muted-foreground">hoje</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tipos[t].cls}`}>
                  <T className="h-5 w-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 p-5">
        <h3 className="mb-3 text-sm font-semibold">Histórico de contatos</h3>
        <ol className="relative space-y-4 border-l border-border pl-5">
          {eventos.map((e, i) => {
            const T = tipos[e.tipo].icon;
            return (
              <li key={i} className="relative">
                <span className={`absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${tipos[e.tipo].cls}`}>
                  <T className="h-3 w-3" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{e.cli}</span>
                  <Badge variant="outline" className="text-[10px]">{e.tipo}</Badge>
                  <span className="text-xs text-muted-foreground">{e.data} · {e.hora}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{e.assunto}</p>
                <p className="text-xs text-muted-foreground">por {e.resp}</p>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
