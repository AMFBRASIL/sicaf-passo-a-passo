import { NextResponse } from "next/server";
import { runCronJob } from "@/crons/runner";
import { listCronJobs } from "@/crons/registry";
import { getEnv } from "@/lib/config/env";
import { unauthorized } from "@/lib/http/errors";
import type { NextRequest } from "next/server";

function verifyCronSecret(request: NextRequest): void {
  const env = getEnv();
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (!token || token !== env.CRON_SECRET) {
    throw unauthorized("CRON_SECRET inválido");
  }
}

export async function GET() {
  try {
    const { jsonSuccess } = await import("@/lib/http/response");
    return jsonSuccess({ jobs: listCronJobs() });
  } catch (error) {
    const { handleRouteError } = await import("@/lib/http/response");
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobName: string }> },
) {
  try {
    verifyCronSecret(request);
    const { jobName } = await context.params;
    const result = await runCronJob(jobName);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const { handleRouteError } = await import("@/lib/http/response");
    return handleRouteError(error);
  }
}
