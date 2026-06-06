import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/funil")({
  component: () => (
    <ModulePlaceholder
      title="Funil Comercial"
      description="A tela mais valiosa da CADBRASIL — onde o dinheiro vaza."
      bullets={[
        "Visitou site → Cadastrou → Pagou → Enviou docs → SICAF → Manutenção → Renovou",
        "Taxa de conversão por etapa e tempo médio",
        "Filtros por origem (Google Ads, indicação, orgânico)",
      ]}
    />
  ),
});
