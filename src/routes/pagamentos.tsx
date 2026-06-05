import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, ShieldCheck, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/page-header";

export const Route = createFileRoute("/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos — CADBRASIL" },
      { name: "description", content: "Sua empresa está protegida com a CADBRASIL." },
    ],
  }),
  component: PayPage,
});

const beneficios = [
  "Monitoramento contínuo do SICAF",
  "Alertas automáticos de vencimentos",
  "Assistente IA 24h",
  "Gestão documental completa",
  "Suporte especializado em licitações",
  "Renovação automática de certidões",
];

function PayPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        icon={<CreditCard className="h-5 w-5" />}
        title="Pagamentos"
        subtitle="Tudo em dia. Sua empresa está protegida."
      />

      <Card className="mt-6 border-success/30 bg-gradient-to-br from-success/10 via-card to-card shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success text-success-foreground">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">Sua empresa está protegida</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Plano atual: <span className="font-semibold text-foreground">CADBRASIL Licença Anual</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StatusBadge status="ok">Ativo</StatusBadge>
                <span className="text-sm text-muted-foreground">
                  Próxima renovação: <span className="font-medium text-foreground">15/03/2026</span>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Benefícios inclusos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {beneficios.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Manutenção mensal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Garanta que sua empresa nunca fique fora de uma licitação por documento vencido.
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-primary">R$ 149</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>
            <Button className="w-full" size="lg">Contratar manutenção</Button>
            <p className="text-center text-xs text-muted-foreground">Cancelamento a qualquer momento.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            <li className="flex items-center justify-between py-3 first:pt-0">
              <span>Licença Anual — 2025/2026</span>
              <StatusBadge status="ok">Pago</StatusBadge>
            </li>
            <li className="flex items-center justify-between py-3 last:pb-0">
              <span>Licença Anual — 2024/2025</span>
              <StatusBadge status="ok">Pago</StatusBadge>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
