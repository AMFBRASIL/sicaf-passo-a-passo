import { NextResponse } from "next/server";
import { launchAssistant } from "@/modules/sicaf-assistant/assistant-process";

export const runtime = "nodejs";

export async function POST() {
  const result = launchAssistant();
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
