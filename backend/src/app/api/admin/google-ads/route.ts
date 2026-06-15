import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminGoogleAdsService = {
  getAdminGoogleAds: (opts: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
};

export async function GET(request: Request) {
  try {
    await requireStaffAccess(request);
    const url = new URL(request.url);
    const svc = await getSicafAgentModule<AdminGoogleAdsService>("services/admin-google-ads.service");
    const result = await svc.getAdminGoogleAds({
      days: parseInt(url.searchParams.get("days") || "30", 10),
      palavra: url.searchParams.get("palavra") || "",
      pagos: url.searchParams.get("pagos") || "",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar Google Ads";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
