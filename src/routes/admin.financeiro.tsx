import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/financeiro")({
  component: () => (
    <ModulePlaceholder
      title="Financeiro"
      description="Recebimentos, inadimplência, renovações e cancelamentos."
      bullets={[
        "Resumo: recebimentos hoje/mês, inadimplentes, renovações, cancelamentos",
        "Por cliente: PIX, Cartão, Boleto, Estornos, MED",
        "Conciliação automática e fila de cobrança",
      ]}
    />
  ),
});
