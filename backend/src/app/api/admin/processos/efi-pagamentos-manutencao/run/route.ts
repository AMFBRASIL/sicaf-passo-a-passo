import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/auth/legacy-auth";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EfiCronService = {
  getStatus: () => { running: boolean };
  runSync: (
    triggerType: string,
    scheduleSlot: string | null,
    perfil?: string,
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request);
    const cron = await getSicafAgentModule<EfiCronService>("services/efi-pagamentos-cron.service");

    if (cron.getStatus().running) {
      return NextResponse.json({ ok: false, error: "Validação Efí já em execução" }, { status: 409 });
    }

    void cron
      .runSync("manual", "manual", "manutencao")
      .then((r) => {
        if (!r.ok) console.error("[ProcessosAPI] Validação manutenção Efí:", r.error);
        else console.log("[ProcessosAPI] Validação manutenção Efí OK:", r.message);
      })
      .catch((err) => console.error("[ProcessosAPI] Erro validação manutenção Efí:", err));

    return NextResponse.json({
      ok: true,
      message: "Validação de manutenção na Efí iniciada em background",
      perfil: "manutencao",
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
