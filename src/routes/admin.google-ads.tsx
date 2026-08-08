import { createFileRoute } from "@tanstack/react-router";
import { AdsIntelligencePage } from "@/components/admin/ads-intelligence-page";

export const Route = createFileRoute("/admin/google-ads")({
  component: GoogleAdsPage,
});

function GoogleAdsPage() {
  return <AdsIntelligencePage canal="google" />;
}
