import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/documentos")({
  component: () => (
    <ModulePlaceholder
      title="Gestão de Documentos"
      description="Aprovação, rejeição e solicitação de documentos enviados pelos clientes."
      bullets={[
        "Filtros por tipo: Contrato Social, Certidões, Balanço, Procuração",
        "Visualizar · Aprovar · Rejeitar · Solicitar novamente",
        "Auditoria por documento com histórico de versões",
      ]}
    />
  ),
});
