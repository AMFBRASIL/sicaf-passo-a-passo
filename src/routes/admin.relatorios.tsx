import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/relatorios")({
  component: () => (
    <ModulePlaceholder
      title="Relatórios"
      description="Exportação em Excel, PDF e CSV."
      bullets={[
        "Clientes · Financeiro · SICAF · Suporte · Google Ads",
        "Filtros por período, status e responsável",
        "Agendamento de envio por e-mail",
      ]}
    />
  ),
});
