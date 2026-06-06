import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/clientes")({
  component: () => (
    <ModulePlaceholder
      title="Gestão de Clientes"
      description="Base unificada de clientes com filtros avançados e ações rápidas."
      bullets={[
        "Filtros: SICAF OK/Pendente, Pagou/Não pagou, Manutenção, Cliente novo/antigo",
        "Ações rápidas: abrir cliente, suporte, financeiro, documentos, SICAF",
        "Busca por CNPJ, razão social, responsável, telefone",
      ]}
    />
  ),
});
