import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/ia")({
  component: () => (
    <ModulePlaceholder
      title="IA Gerencial"
      description="Pergunte em linguagem natural — a IA responde com dados reais."
      bullets={[
        "“Quais clientes têm maior risco de cancelamento?”",
        "“Quais pagaram e ainda não enviaram documentos?”",
        "“Quantos SICAF vencem nos próximos 30 dias?”",
      ]}
    />
  ),
});
