import { createApiHandler } from "@/lib/http/api-handler";
import { requireAuth } from "@/lib/auth/with-auth";
import { authService } from "@/modules/auth/auth.service";

export const GET = createApiHandler(async ({ request }) => {
  const { user } = await requireAuth(request);
  return authService.me(Number(user.sub));
});
