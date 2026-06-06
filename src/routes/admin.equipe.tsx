import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/equipe")({
  component: () => (
    <ModulePlaceholder
      title="Gestão de Equipe"
      description="Descubra rapidamente quem mais produz."
      bullets={[
        "Tickets resolvidos · Tempo médio · Avaliação · SLA",
        "Clientes atendidos por funcionário",
        "Ranking semanal e mensal",
      ]}
    />
  ),
});
