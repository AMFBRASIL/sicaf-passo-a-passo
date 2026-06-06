import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/automacoes")({
  component: () => (
    <ModulePlaceholder
      title="Automações"
      description="Fluxos disparados por eventos do sistema."
      bullets={[
        "Quando cliente paga → criar ticket · enviar e-mail · liberar acesso",
        "Quando certidão vencer → enviar aviso · criar tarefa",
        "Editor visual de gatilhos e ações",
      ]}
    />
  ),
});
