import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoletimCronService = {
  getStatus: () => { running: boolean };
  runSync: (
    triggerType: string,
    scheduleSlot: string | null,
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request);
    const cron = await getSicafAgentModule<BoletimCronService>(
      "services/licitacoes-boletim-cron.service",
    );

    if (cron.getStatus().running) {
      return NextResponse.json({ ok: false, error: "Boletim de licitações já em execução" }, { status: 409 });
    }

    void cron
      .runSync("manual", "manual")
      .then((r) => {
        if (!r.ok) console.error("[ProcessosAPI] Boletim licitações:", r.error);
        else console.log("[ProcessosAPI] Boletim licitações OK:", r.message);
      })
      .catch((err) => console.error("[ProcessosAPI] Erro boletim licitações:", err));

    return NextResponse.json({
      ok: true,
      message: "Boletim de licitações segmentadas iniciado em background",
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
