import { createApiHandler } from "@/lib/http/api-handler";
import { requireAdmin } from "@/lib/auth/with-auth";
import { clientesService } from "@/modules/clientes/clientes.service";

export const GET = createApiHandler(async ({ request }) => {
  await requireAdmin(request);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "50")));

  return clientesService.list(page, pageSize);
});
