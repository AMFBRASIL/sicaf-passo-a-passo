import { createApiHandler, parseJsonBody } from "@/lib/http/api-handler";
import { loginSchema, normalizeLoginInput } from "@/modules/auth/auth.schemas";
import { authService } from "@/modules/auth/auth.service";

export const POST = createApiHandler(async ({ request }) => {
  const raw = await parseJsonBody(request, loginSchema);
  const body = normalizeLoginInput(raw);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");

  const session = await authService.login(body, { ip, userAgent });
  return {
    token: session.token,
    usuario: session.user,
  };
});
