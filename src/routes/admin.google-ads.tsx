import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/google-ads")({
  component: () => (
    <ModulePlaceholder
      title="Google Ads Intelligence"
      description="Palavras que geram dinheiro — não apenas cliques."
      bullets={[
        "Top palavras por receita, ROAS, CPA, CAC",
        "Cliques · Cadastros · Pagamentos · Faturamento",
        "Atribuição da palavra ao cliente pagante",
      ]}
    />
  ),
});
