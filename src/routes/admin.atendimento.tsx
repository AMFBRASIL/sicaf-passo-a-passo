import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/atendimento")({
  component: () => (
    <ModulePlaceholder
      title="Central de Atendimento"
      description="Registro de contatos via WhatsApp, telefone, AnyDesk e e-mail."
      bullets={[
        "Campos: cliente, data, hora, tipo, responsável",
        "Histórico completo por cliente",
        "Integração com discador e WhatsApp",
      ]}
    />
  ),
});
