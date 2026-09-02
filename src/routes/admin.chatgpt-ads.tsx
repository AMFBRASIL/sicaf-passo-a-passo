import { createFileRoute } from "@tanstack/react-router";
import { AdsIntelligencePage } from "@/components/admin/ads-intelligence-page";

export const Route = createFileRoute("/admin/chatgpt-ads")({
  component: ChatGptAdsPage,
});

function ChatGptAdsPage() {
  return <AdsIntelligencePage canal="chatgpt" />;
}
