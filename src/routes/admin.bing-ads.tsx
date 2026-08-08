import { createFileRoute } from "@tanstack/react-router";
import { AdsIntelligencePage } from "@/components/admin/ads-intelligence-page";

export const Route = createFileRoute("/admin/bing-ads")({
  component: BingAdsPage,
});

function BingAdsPage() {
  return <AdsIntelligencePage canal="bing" />;
}
