import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, Mail, MessageCircle, Smartphone, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — CADBRASIL" },
      { name: "description", content: "Configure como e quando você quer ser avisado." },
    ],
  }),
  component: NotificacoesPage,
});

type Canal = "email" | "whatsapp" | "push";
type Evento =
  | "certidao_vencendo"
  | "certidao_vencida"
  | "sicaf_expira"
  | "taxa_pendente"
  | "atualizacao_concluida"
  | "nova_oportunidade";

const EVENTOS: { id: Evento; titulo: string; descricao: string; padrao: Canal[] }[] = [
  { id: "certidao_vencendo", titulo: "Certidão vencendo", descricao: "Avisos em 30, 15 e 5 dias antes do vencimento.", padrao: ["email", "whatsapp"] },
  { id: "certidao_vencida", titulo: "Certidão vencida", descricao: "Alerta imediato quando uma certidão expira.", padrao: ["email", "whatsapp", "push"] },
  { id: "sicaf_expira", titulo: "SICAF próximo do vencimento", descricao: "Lembrete 30 dias antes de renovar.", padrao: ["email", "whatsapp"] },
  { id: "taxa_pendente", titulo: "Taxa pendente", descricao: "Pagamentos em aberto que bloqueiam o SICAF.", padrao: ["email"] },
  { id: "atualizacao_concluida", titulo: "Atualização concluída", descricao: "Quando o SICAF é atualizado com sucesso.", padrao: ["email"] },
  { id: "nova_oportunidade", titulo: "Nova oportunidade no PNCP", descricao: "Editais compatíveis com seu perfil.", padrao: ["email"] },
];

const STORAGE_KEY = "cadbrasil-notif-prefs";

type Prefs = Record<Evento, Canal[]>;

function defaultPrefs(): Prefs {
  return Object.fromEntries(EVENTOS.map((e) => [e.id, e.padrao])) as Prefs;
}

function NotificacoesPage() {
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...defaultPrefs(), ...JSON.parse(raw) });
    } catch {}
  }, []);

  const toggle = (ev: Evento, canal: Canal) => {
    setPrefs((p) => {
      const atual = new Set(p[ev]);
      atual.has(canal) ? atual.delete(canal) : atual.add(canal);
      return { ...p, [ev]: [...atual] };
    });
  };

  const salvar = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      toast.success("Preferências salvas");
    } catch {
      toast.error("Não foi possível salvar");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Bell className="h-3 w-3" />
            Centro de notificações
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Como você quer ser avisado?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Receba alertas proativos por e-mail, WhatsApp ou push — direto no canal certo, na hora certa.
          </p>
        </div>
        <Button onClick={salvar} className="gap-2">
          <Save className="h-4 w-4" />
          Salvar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos e canais</CardTitle>
          <CardDescription>Marque os canais que devem receber cada tipo de aviso.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[1fr_repeat(3,auto)] items-center gap-x-6 gap-y-3 px-6 py-3 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Evento</span>
            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-mail</span>
            <span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</span>
            <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Push</span>
          </div>
          <ul>
            {EVENTOS.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[1fr_repeat(3,auto)] items-center gap-x-6 gap-y-1 border-b border-border px-6 py-4 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{e.titulo}</p>
                  <p className="text-xs text-muted-foreground">{e.descricao}</p>
                </div>
                {(["email", "whatsapp", "push"] as Canal[]).map((c) => (
                  <Switch
                    key={c}
                    checked={prefs[e.id].includes(c)}
                    onCheckedChange={() => toggle(e.id, c)}
                    aria-label={`${e.titulo} via ${c}`}
                  />
                ))}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Suas preferências ficam salvas neste dispositivo. Em breve estarão sincronizadas com sua conta.
      </p>
    </div>
  );
}
