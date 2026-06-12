import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleAdsCronService = {
  getStatus: () => { running: boolean };
  runSync: (triggerType: string, scheduleSlot: string | null) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request);
    const cron = await getSicafAgentModule<GoogleAdsCronService>(
      "services/google-ads-conversoes-cron.service",
    );

    if (cron.getStatus().running) {
      return NextResponse.json({ ok: false, error: "Sync já em execução" }, { status: 409 });
    }

    void cron
      .runSync("manual", "manual")
      .then((r) => {
        if (!r.ok) console.error("[ProcessosAPI] Sync Google Ads:", r.error);
        else console.log("[ProcessosAPI] Sync Google Ads OK:", r.message);
      })
      .catch((err) => console.error("[ProcessosAPI] Erro sync Google Ads:", err));

    return NextResponse.json({
      ok: true,
      message: "Sincronização Google Ads iniciada em background",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao iniciar processo";
    const status =
      message.includes("Token") || message.includes("Sessão")
        ? 401
        : message.includes("restrito")
          ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
