import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/suporte")({
  component: () => (
    <ModulePlaceholder
      title="Central de Suporte (Kanban)"
      description="Tickets em colunas com SLA, responsável e histórico."
      bullets={[
        "Colunas: Novo · Triagem · Em andamento · Aguardando Cliente · Aguardando Governo · Resolvido · Fechado",
        "Ticket: histórico, arquivos, tempo SLA, cliente, responsável",
        "Drag & drop entre colunas",
      ]}
    />
  ),
});
