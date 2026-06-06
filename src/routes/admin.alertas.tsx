import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/alertas")({
  component: () => (
    <ModulePlaceholder
      title="Central de Alertas"
      description="Tudo o que está prestes a virar problema em uma tela."
      bullets={[
        "Certidões vencendo · CRC vencendo",
        "Clientes sem pagamento · Tickets atrasados",
        "Documentos pendentes de aprovação",
      ]}
    />
  ),
});
