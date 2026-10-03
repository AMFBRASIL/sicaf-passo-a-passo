import { useEffect } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { FrenteCadastroId } from "@/lib/frentes-cadastro";

export type ServicoNovidade = "caufesp" | "bll" | "licitacoes_e" | "pncp";

export type NovidadeServico = {
  clienteId: number;
  empresa: string;
  cnpj: string;
  /** `acao`: depende do cliente; `novidade`: a equipe atualizou o serviço. */
  tipo: "acao" | "novidade";
  titulo: string;
  detalhe: string | null;
  /** Mudança feita pela equipe que o usuário ainda não viu. */
  novo: boolean;
};

export type NovidadesServicos = Record<ServicoNovidade, NovidadeServico[]>;

export const SERVICO_POR_FRENTE: Partial<Record<FrenteCadastroId, ServicoNovidade>> = {
  "bec-caufesp": "caufesp",
  bll: "bll",
  "licitacoes-e": "licitacoes_e",
  pncp: "pncp",
};

export async function fetchNovidadesServicos() {
  const res = await apiFetch("/api/servicos/novidades");
  const data = await res.json().catch(() => ({ ok: false }));
  if (!data.ok) return { ok: false as const, error: (data.error as string) || "Erro ao carregar novidades" };
  return { ok: true as const, servicos: data.servicos as NovidadesServicos };
}

export function marcarServicoVisto(servico: ServicoNovidade, clienteId: number) {
  return apiFetch("/api/servicos/novidades", {
    method: "POST",
    body: JSON.stringify({ servico, clienteId }),
  }).catch(() => undefined);
}

/** Abrir a página do serviço apaga os alertas de "novidade" dele na página Início. */
export function useMarcarServicoVisto(servico: ServicoNovidade, clienteId: number | null | undefined) {
  useEffect(() => {
    if (clienteId) void marcarServicoVisto(servico, clienteId);
  }, [servico, clienteId]);
}
