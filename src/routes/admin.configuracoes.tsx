import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const Route = createFileRoute("/admin/configuracoes")({
  component: () => (
    <ModulePlaceholder
      title="Configurações Avançadas"
      description="Tudo o que controla o comportamento do sistema."
      bullets={[
        "📧 Emails · 📱 WhatsApp · 🤖 IA · 💰 Financeiro",
        "📄 SICAF · 🔒 Segurança · 👥 Usuários",
        "🌐 Google Ads · ☁️ Armazenamento · 📥 Integrações",
      ]}
    />
  ),
});
