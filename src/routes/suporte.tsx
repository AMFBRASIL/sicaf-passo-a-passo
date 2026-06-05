import { createFileRoute } from "@tanstack/react-router";
import { Headphones, MessageCircle, PhoneCall, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/page-header";

export const Route = createFileRoute("/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte — CADBRASIL" },
      { name: "description", content: "Fale com nossos especialistas." },
    ],
  }),
  component: SupportPage,
});

const chamados = [
  { titulo: "Dúvida sobre Nível IV", data: "02/12/2025", status: "warn" as const, label: "Em atendimento" },
  { titulo: "Renovação de certidão estadual", data: "20/11/2025", status: "ok" as const, label: "Resolvido" },
];

function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<Headphones className="h-5 w-5" />}
        title="Suporte"
        subtitle="Estamos aqui para te ajudar — sem termos técnicos."
        action={
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Abrir chamado
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/20">
          <CardContent className="flex items-start gap-3 p-5">
            <MessageCircle className="mt-0.5 h-6 w-6 text-success" />
            <div>
              <p className="font-semibold">WhatsApp</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Resposta em até 5 minutos no horário comercial.</p>
              <Button variant="link" className="mt-1 h-auto p-0">Iniciar conversa →</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <PhoneCall className="mt-0.5 h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">Telefone</p>
              <p className="mt-0.5 text-sm text-muted-foreground">0800 123 4567 — seg a sex, 8h às 18h.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Seus chamados</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {chamados.map((c) => (
              <li key={c.titulo} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">{c.titulo}</p>
                  <p className="text-xs text-muted-foreground">Aberto em {c.data}</p>
                </div>
                <StatusBadge status={c.status}>{c.label}</StatusBadge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
