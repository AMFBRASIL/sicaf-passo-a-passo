import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/auditoria")({
  component: () => (
    <ModulePlaceholder
      title="Auditoria"
      description="Tudo o que acontece fica registrado — nada sem rastreabilidade."
      bullets={[
        "Usuário · Data · Hora · IP · Ação",
        "Filtros por módulo e por usuário",
        "Exportação assinada para compliance",
      ]}
    />
  ),
});
