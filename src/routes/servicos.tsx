import { createFileRoute } from "@tanstack/react-router";
import { FileSignature, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/page-header";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Meus Serviços — CADBRASIL" },
      { name: "description", content: "Veja os serviços ativos da sua empresa." },
    ],
  }),
  component: ServPage,
});

const servicos = [
  {
    nome: "Cadastro SICAF Completo",
    descricao: "Cadastro e atualização nos níveis I a VI.",
    status: "ok" as const,
    label: "Ativo",
  },
  {
    nome: "Monitoramento de Certidões",
    descricao: "Acompanhamento diário de validade.",
    status: "ok" as const,
    label: "Ativo",
  },
  {
    nome: "Assistente IA para Licitações",
    descricao: "Recomendações personalizadas todos os dias.",
    status: "ok" as const,
    label: "Ativo",
  },
  {
    nome: "Manutenção Mensal",
    descricao: "Renovação automática de documentos.",
    status: "idle" as const,
    label: "Não contratado",
  },
];

function ServPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<FileSignature className="h-5 w-5" />}
        title="Meus Serviços"
        subtitle="Tudo que a CADBRASIL faz pela sua empresa."
      />

      <div className="mt-6 grid gap-3">
        {servicos.map((s) => (
          <Card key={s.nome}>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{s.nome}</p>
                  <p className="text-sm text-muted-foreground">{s.descricao}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={s.status}>{s.label}</StatusBadge>
                {s.status === "idle" && <Button size="sm">Contratar</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Contrato vigente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">CADBRASIL Licença Anual 2025/2026</span> — assinado em
            15/03/2025. Próxima renovação automática em 15/03/2026.
          </p>
          <Button variant="link" className="mt-2 h-auto p-0">Baixar contrato em PDF →</Button>
        </CardContent>
      </Card>
    </div>
  );
}
