import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, RefreshCw, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/page-header";

export const Route = createFileRoute("/certidoes")({
  head: () => ({
    meta: [
      { title: "Situação das Certidões — CADBRASIL" },
      { name: "description", content: "Veja a situação de cada certidão da sua empresa." },
    ],
  }),
  component: CertPage,
});

const certs = [
  { nome: "Certidão Federal (Receita + PGFN)", status: "ok" as const, validade: "12/08/2026" },
  { nome: "Certidão Estadual", status: "warn" as const, validade: "30/12/2025" },
  { nome: "Certidão Municipal", status: "ok" as const, validade: "05/04/2026" },
  { nome: "FGTS — CRF", status: "ok" as const, validade: "18/02/2026" },
  { nome: "Trabalhista — CNDT", status: "danger" as const, validade: "Vencida em 02/11/2025" },
];

function CertPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<ClipboardCheck className="h-5 w-5" />}
        title="Situação das Certidões"
        subtitle="Acompanhamos automaticamente todas as suas certidões."
        action={
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar agora
          </Button>
        }
      />

      <div className="mt-6 grid gap-3">
        {certs.map((c) => (
          <Card
            key={c.nome}
            className={
              c.status === "danger"
                ? "border-danger/30"
                : c.status === "warn"
                ? "border-warning/40"
                : ""
            }
          >
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{c.nome}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Validade: {c.validade}</p>
                <div className="mt-2">
                  <StatusBadge status={c.status}>
                    {c.status === "ok" ? "Válida" : c.status === "warn" ? "Vence em breve" : "Vencida — ação necessária"}
                  </StatusBadge>
                </div>
              </div>
              <div className="flex gap-2">
                {c.status === "ok" ? (
                  <Button variant="outline" size="sm">
                    <Download className="mr-1.5 h-4 w-4" />
                    Baixar
                  </Button>
                ) : (
                  <Button size="sm">Resolver agora</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Como funciona?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Monitoramos suas certidões todos os dias. Avisamos por e-mail, WhatsApp e aqui no portal
          antes que qualquer documento vença — assim sua empresa nunca fica fora de uma licitação.
        </CardContent>
      </Card>
    </div>
  );
}
