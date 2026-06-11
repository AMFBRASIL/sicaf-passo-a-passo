import { NextResponse } from "next/server";
import { stopAssistant } from "@/modules/sicaf-assistant/assistant-process";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(stopAssistant());
}
