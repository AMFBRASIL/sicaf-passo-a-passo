import { NextResponse } from "next/server";
import { getAssistantStatus } from "@/modules/sicaf-assistant/assistant-process";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getAssistantStatus());
}
