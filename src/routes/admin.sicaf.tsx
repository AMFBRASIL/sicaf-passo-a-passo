import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/sicaf")({
  component: () => (
    <ModulePlaceholder
      title="Gestão SICAF"
      description="Controle dos Níveis I a VI com indicadores visuais."
      bullets={[
        "Visões por Nível (I, II, III, IV, V, VI)",
        "Filtros: Completo, Incompleto, Vencido, Vencendo",
        "Indicador semáforo: 🟢 OK · 🟡 atenção · 🔴 crítico",
      ]}
    />
  ),
});
