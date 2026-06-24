import { apiFetch } from "@/lib/api-fetch";

export type PerfilEquipeOpcao = {
  id: number;
  nome: string;
  descricao: string;
  tipo: string;
  cor?: string;
};

export type MembroEquipe = {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  perfilId: number;
  perfil: string;
  perfilTipo: string;
  ativo: boolean;
  status: string;
  avatarIniciais: string;
  tickets: number;
  media: string;
  sla: number;
  clientes: number;
  avaliacao: number;
};

export async function fetchEquipe(): Promise<{
  ok: boolean;
  error?: string;
  membros?: MembroEquipe[];
  perfis?: PerfilEquipeOpcao[];
  total?: number;
  ativos?: number;
}> {
  const res = await apiFetch("/api/admin/equipe");
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    membros?: MembroEquipe[];
    perfis?: PerfilEquipeOpcao[];
    total?: number;
    ativos?: number;
  };
}

export async function createMembroEquipe(payload: {
  nome: string;
  email: string;
  telefone?: string;
  cargo?: string;
  perfilId: number;
  senha?: string;
  ativo?: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  id?: number;
  senhaTemporaria?: string;
}> {
  const res = await apiFetch("/api/admin/equipe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    message?: string;
    id?: number;
    senhaTemporaria?: string;
  };
}

export async function updateMembroEquipe(
  id: number,
  payload: {
    nome?: string;
    email?: string;
    telefone?: string;
    cargo?: string;
    perfilId?: number;
    ativo?: boolean;
    senha?: string;
  },
): Promise<{ ok: boolean; error?: string; message?: string; membro?: MembroEquipe }> {
  const res = await apiFetch(`/api/admin/equipe/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    message?: string;
    membro?: MembroEquipe;
  };
}
