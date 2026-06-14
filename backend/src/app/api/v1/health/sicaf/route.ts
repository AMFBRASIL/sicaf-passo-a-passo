import { NextResponse } from "next/server";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbConnection = {
  isDbReady: () => boolean;
  getInitError: () => string | null;
  pingDatabase: () => Promise<{ ok: boolean; error?: string }>;
};

export async function GET() {
  try {
    const conn = await getSicafAgentModule<DbConnection>("database/connection");
    const ping = await conn.pingDatabase();
    return NextResponse.json({
      ok: ping.ok,
      ready: conn.isDbReady(),
      vercel: Boolean(process.env.VERCEL),
      host: process.env.DB_WRITE_HOST || process.env.DB_HOST || null,
      database: process.env.DB_WRITE_NAME || process.env.DB_NAME || null,
      error: ping.ok ? null : ping.error || conn.getInitError(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao verificar banco sicaf-agent";
    return NextResponse.json(
      {
        ok: false,
        ready: false,
        vercel: Boolean(process.env.VERCEL),
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
