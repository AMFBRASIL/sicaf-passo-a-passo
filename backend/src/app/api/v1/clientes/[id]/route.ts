import { createApiHandler } from "@/lib/http/api-handler";
import { requireAdmin } from "@/lib/auth/with-auth";
import { clientesService } from "@/modules/clientes/clientes.service";
import { badRequest } from "@/lib/http/errors";

export const GET = createApiHandler(async ({ request, params }) => {
  await requireAdmin(request);

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw badRequest("ID de cliente inválido");
  }

  return clientesService.getById(id);
});
