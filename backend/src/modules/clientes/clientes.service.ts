import { notFound } from "@/lib/http/errors";
import { clientesRepository } from "@/modules/clientes/clientes.repository";

export class ClientesService {
  async list(page = 1, pageSize = 50) {
    const offset = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      clientesRepository.list(pageSize, offset),
      clientesRepository.count(),
    ]);

    return {
      items: items.map((c) => ({
        id: c.id,
        documento: c.documento,
        razaoSocial: c.razao_social,
        nomeFantasia: c.nome_fantasia,
        status: c.status,
        usuarioId: c.usuario_id,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getById(id: number) {
    const cliente = await clientesRepository.findById(id);
    if (!cliente) throw notFound("Cliente não encontrado");

    return {
      id: cliente.id,
      documento: cliente.documento,
      razaoSocial: cliente.razao_social,
      nomeFantasia: cliente.nome_fantasia,
      status: cliente.status,
      usuarioId: cliente.usuario_id,
    };
  }
}

export const clientesService = new ClientesService();
