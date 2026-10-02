import { apiFetch } from "@/lib/api-fetch";

export type ModuloPago = "licitacoes_e" | "pncp";

export type ModuloPagamento = {
  id: number;
  tipo: "boleto" | "pix";
  status: "aguardando" | "gerado" | "pago" | "expirado";
  valor: number;
  descricao: string | null;
  vencimento: string | null;
  dataPagamento: string | null;
  protocolo: string;
  barcode: string;
  link: string;
  pdf: string;
  txid: string;
  qrcodeText: string;
  qrcodeImage: string;
  criadoEm?: string | null;
};

export type ModuloAssinatura = {
  modulo: ModuloPago;
  nome: string;
  valor: number;
  ativo: boolean;
  validoAte: string | null;
  diasRestantes: number | null;
  podeRenovar: boolean;
  pagamentoAberto: ModuloPagamento | null;
  historico: ModuloPagamento[];
  acessoEquipe?: boolean;
};

type Resp<T> = ({ ok: true } & T) | { ok: false; error: string };

async function parse<T>(res: Response): Promise<Resp<T>> {
  const data = await res
    .json()
    .catch(() => ({ ok: false, error: "Resposta inválida do servidor" }));
  if (!data.ok) return { ok: false, error: data.error || "Erro ao consultar o módulo" };
  return data as Resp<T>;
}

export async function fetchModuloAssinatura(modulo: ModuloPago, clienteId: number) {
  return parse<ModuloAssinatura>(await apiFetch(`/api/modulos/${modulo}/${clienteId}`));
}

export async function fetchModulosAssinatura(clienteId: number) {
  return parse<{ modulos: ModuloAssinatura[]; acessoEquipe?: boolean }>(
    await apiFetch(`/api/modulos/todos/${clienteId}`),
  );
}

export async function gerarMensalidadeModulo(
  modulo: ModuloPago,
  clienteId: number,
  formaPagamento: "boleto" | "pix",
) {
  return parse<{ pagamento: ModuloPagamento; reutilizado?: boolean }>(
    await apiFetch(`/api/modulos/${modulo}/${clienteId}`, {
      method: "POST",
      body: JSON.stringify({ formaPagamento }),
    }),
  );
}

export async function verificarPagamentoModulo(pagamentoId: number) {
  const res = await apiFetch("/api/pagamentos/check-status", {
    method: "POST",
    body: JSON.stringify({ pagamentoId }),
  });
  const data = await res.json().catch(() => ({}));
  return Boolean(data?.ok && data.status === "pago");
}

export const MODULOS_INFO: Record<
  ModuloPago,
  { nome: string; rota: "/licitacoes-e" | "/pncp"; resumo: string; beneficios: string[] }
> = {
  licitacoes_e: {
    nome: "Assistente Licitações-e CADBRASIL",
    rota: "/licitacoes-e",
    resumo:
      "Entendimento e treinamento do Licitações-e (Banco do Brasil) e organização dos documentos para disputar.",
    beneficios: [
      "Orientação de acesso e cadastro no Licitações-e",
      "Localizar licitações e acompanhar cada etapa do portal",
      "Conferência de aptidão e checklist de documentos do edital",
      "Orientação de proposta, envio, disputa e habilitação",
      "Acompanhamento do resultado e apoio da equipe CADBRASIL",
    ],
  },
  pncp: {
    nome: "PNCP Inteligente CADBRASIL",
    rota: "/pncp",
    resumo:
      "Treinamento e acompanhamento no PNCP, documentos e leitura de edital com inteligência artificial.",
    beneficios: [
      "Pesquisa de oportunidades com filtros e acompanhamento",
      "Treinamento completo do PNCP (8 módulos)",
      "Inteligência de mercado: órgãos, valores e concorrentes",
      "Leitura de edital com IA incluída na mensalidade",
      "Antecipação de oportunidades pelo Plano de Contratações Anual",
    ],
  },
};

export function valorModuloFmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataModuloFmt(v?: string | null) {
  if (!v) return "—";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
}
