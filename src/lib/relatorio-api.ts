import { apiFetch } from "@/lib/api-fetch";

export type RelatorioLicenca = {
  codigo: string;
  status: string;
  dataValidade: string | null;
  diasRestantes: number | null;
  credenciamentoAnual: boolean;
};

export type RelatorioAcessoIp = {
  ip: string;
  em: string | null;
  dispositivo: string | null;
  navegador: string | null;
};

export type RelatorioMiraItem = {
  id: number;
  titulo: string;
  orgao: string | null;
  uf: string | null;
  pipelineStatus: string;
  dataEncerramento: string | null;
  valorEstimado: number | null;
  atualizadoEm: string | null;
};

export type ClienteRelatorio = {
  ok: boolean;
  error?: string;
  geradoEm?: string;
  empresa?: {
    id: number;
    razaoSocial: string;
    nomeFantasia: string;
    documento: string;
    cidade: string | null;
    estado: string | null;
  };
  licenca?: RelatorioLicenca;
  manutencao?: {
    ativa: boolean;
    status: string | null;
    diaVencimento: number | null;
  };
  atualizacoesSicaf?: {
    usadas: number;
    limite: number;
    restantes: number;
    manutencaoAtiva: boolean;
    bloqueado: boolean;
    resetEm?: string | null;
  };
  acessos?: {
    loginsTotal: number;
    loginsSucesso: number;
    ultimoAcesso: {
      ip: string | null;
      dispositivo: string | null;
      navegador: string | null;
      plataforma: string | null;
      em: string | null;
    } | null;
    ipsRecentes: RelatorioAcessoIp[];
  };
  licitacoes?: {
    naMira: number;
    vaiParticipar: number;
    itensMira: RelatorioMiraItem[];
    acessosTela: number;
    acessosTela30d: number;
    detalhesAbertos: number;
  };
  usoPortal?: {
    sicaf: number;
    assistente: number;
    relatorio: number;
    documentos: number;
    ticketsAbertos: number;
  };
};

export async function fetchClienteRelatorio() {
  const res = await apiFetch("/api/relatorio");
  return res.json() as Promise<ClienteRelatorio>;
}

export async function registrarUsoPortal(evento: string, opts?: {
  path?: string;
  entidade?: string;
  entidadeId?: number;
}) {
  try {
    await apiFetch("/api/relatorio/evento", {
      method: "POST",
      body: JSON.stringify({
        evento,
        path: opts?.path,
        entidade: opts?.entidade,
        entidadeId: opts?.entidadeId,
      }),
    });
  } catch {
    /* telemetria best-effort */
  }
}
