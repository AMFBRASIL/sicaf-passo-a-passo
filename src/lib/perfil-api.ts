import { apiFetch } from "@/lib/api-fetch";
import type { AuthUser } from "@/contexts/AuthContext";
import { fetchEmpresas, fetchEmpresaGerenciar, salvarEmpresaGerenciar } from "@/lib/empresas-api";

export type PerfilPreferencias = {
  notifEmail: boolean;
  notifWhats: boolean;
  notifPush: boolean;
  idioma: string;
};

export type PerfilEdicaoDados = {
  clienteId: number | null;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  cep: string;
  endereco: string;
  empresa: string;
  cnpj: string;
  preferencias: PerfilPreferencias;
};

const PREFS_KEY = "cadbrasil-preferencias";

function formatCep(raw?: string | null): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return raw?.trim() || "";
}

function formatEndereco(cliente?: {
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
}): string {
  if (cliente?.endereco?.trim()) return cliente.endereco.trim();
  const parts = [cliente?.cidade, cliente?.estado].filter(Boolean);
  return parts.join(" — ");
}

export function loadPreferenciasLocal(userId: number): PerfilPreferencias {
  try {
    const raw = localStorage.getItem(`${PREFS_KEY}-${userId}`);
    if (!raw) {
      return { notifEmail: true, notifWhats: true, notifPush: false, idioma: "pt-BR" };
    }
    return JSON.parse(raw) as PerfilPreferencias;
  } catch {
    return { notifEmail: true, notifWhats: true, notifPush: false, idioma: "pt-BR" };
  }
}

export function savePreferenciasLocal(userId: number, prefs: PerfilPreferencias) {
  try {
    localStorage.setItem(`${PREFS_KEY}-${userId}`, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export async function carregarPerfilEdicao(user: AuthUser): Promise<{
  ok: boolean;
  dados?: PerfilEdicaoDados;
  error?: string;
}> {
  const preferencias = loadPreferenciasLocal(user.id);
  let clienteId: number | null = null;
  let empresa = "";
  let cnpj = "";
  let cep = "";
  let endereco = "";
  let telefone = user.telefone || "";

  const empresasRes = await fetchEmpresas();
  if (empresasRes.ok && empresasRes.empresas.length > 0) {
    const primeira = empresasRes.empresas[0];
    clienteId = primeira.clienteId;
    empresa = primeira.nome;
    cnpj = primeira.cnpj;
    telefone = telefone || primeira.telefone || "";

    const ger = await fetchEmpresaGerenciar(clienteId);
    if (ger.ok && ger.painel?.cliente) {
      const c = ger.painel.cliente;
      empresa = c.razaoSocial || empresa;
      cnpj = c.documento || cnpj;
      cep = formatCep(c.cep);
      endereco = formatEndereco(c) || endereco;
      telefone = telefone || c.telefone || c.celular || "";
    }
  }

  return {
    ok: true,
    dados: {
      clienteId,
      nome: user.nome,
      cargo: user.departamento || "",
      email: user.email,
      telefone,
      cep,
      endereco,
      empresa,
      cnpj,
      preferencias,
    },
  };
}

export async function atualizarPerfilUsuario(payload: {
  nome?: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  senhaAtual?: string;
  novaSenha?: string;
}): Promise<{ ok: boolean; user?: AuthUser; error?: string }> {
  const res = await apiFetch("/api/auth/me", {
    method: "PUT",
    body: JSON.stringify({
      nome: payload.nome,
      departamento: payload.cargo,
      email: payload.email,
      telefone: payload.telefone,
      senhaAtual: payload.senhaAtual,
      novaSenha: payload.novaSenha,
    }),
  });
  return res.json() as Promise<{ ok: boolean; user?: AuthUser; error?: string }>;
}

export async function atualizarPerfilEmpresa(
  clienteId: number,
  payload: {
    razao_social?: string;
    email?: string;
    telefone?: string;
    cep?: string;
    endereco?: string;
    responsavel?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const res = await salvarEmpresaGerenciar(clienteId, payload);
  return { ok: res.ok, error: res.error };
}
