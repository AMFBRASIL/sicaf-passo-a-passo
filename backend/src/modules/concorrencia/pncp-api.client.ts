import { AppError } from "@/lib/http/errors";

/** API de Busca (Elasticsearch) — alimenta a interface pública do PNCP. Não há swagger oficial. */
export const PNCP_SEARCH_BASE_URL = "https://pncp.gov.br/api/search";

/** API de Consulta — documentada em https://pncp.gov.br/api/consulta/swagger-ui/index.html */
export const PNCP_CONSULTA_BASE_URL = "https://pncp.gov.br/api/consulta";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGES = 40;
const MAX_CONTRACTS = 500;
const REQUEST_TIMEOUT_MS = 25_000;
const RETRY_DELAYS_MS = [1_200, 2_400, 4_800];

export type PncpSearchContratoItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  item_url?: string | null;
  numero_controle_pncp?: string | null;
  numero_sequencial?: string | null;
  ano?: string | null;
  orgao_cnpj?: string | null;
  orgao_nome?: string | null;
  unidade_nome?: string | null;
  uf?: string | null;
  municipio_nome?: string | null;
  modalidade_licitacao_nome?: string | null;
  situacao_nome?: string | null;
  tipo_nome?: string | null;
  tipo_contrato_nome?: string | null;
  valor_global?: number | null;
  data_assinatura?: string | null;
  data_publicacao_pncp?: string | null;
  data_inicio_vigencia?: string | null;
  data_fim_vigencia?: string | null;
  esfera_nome?: string | null;
  poder_nome?: string | null;
};

export type PncpSearchResponse = {
  items: PncpSearchContratoItem[];
  total: number;
};

export type PncpConsultaContrato = {
  numeroControlePNCP?: string;
  numeroContratoEmpenho?: string;
  objetoContrato?: string;
  modalidadeLicitacao?: { nome?: string };
  tipoContrato?: { nome?: string };
  categoriaProcesso?: { nome?: string };
  situacao?: string;
  valorGlobal?: number;
  valorInicial?: number;
  dataAssinatura?: string;
  dataPublicacaoPncp?: string;
  dataVigenciaInicio?: string;
  dataVigenciaFim?: string;
  niFornecedor?: string;
  nomeRazaoSocialFornecedor?: string;
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { nomeUnidade?: string };
  usuarioNome?: string;
};

type FetchJsonResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, attempt = 0): Promise<FetchJsonResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CADBRASIL-Concorrencia/1.0",
      },
    });

    const text = await response.text();

    if (response.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      return fetchJson<T>(url, attempt + 1);
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: text.slice(0, 300) || `HTTP ${response.status}`,
      };
    }

    return { ok: true, data: JSON.parse(text) as T };
  } catch (error) {
    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      return fetchJson<T>(url, attempt + 1);
    }

    const message = error instanceof Error ? error.message : "Falha na requisição ao PNCP";
    return { ok: false, status: 0, message };
  } finally {
    clearTimeout(timer);
  }
}

function buildSearchUrl(params: Record<string, string>): string {
  const query = new URLSearchParams({
    tipos_documento: "contrato",
    status: "todos",
    ordenacao: "-data",
    ...params,
  });
  return `${PNCP_SEARCH_BASE_URL}/?${query.toString()}`;
}

export async function searchContratosPorCnpj(
  cnpjDigits: string,
  cnpjMasked: string,
): Promise<PncpSearchContratoItem[]> {
  const queries = [cnpjDigits, cnpjMasked];
  const dedup = new Map<string, PncpSearchContratoItem>();

  for (const query of queries) {
    let page = 1;
    let total = Number.POSITIVE_INFINITY;

    while (page <= MAX_PAGES && dedup.size < MAX_CONTRACTS && dedup.size < total) {
      const url = buildSearchUrl({
        q: query,
        pagina: String(page),
        tam_pagina: String(DEFAULT_PAGE_SIZE),
      });

      const result = await fetchJson<PncpSearchResponse>(url);
      if (!result.ok) {
        if (result.status === 429) {
          throw new AppError(
            "O PNCP limitou temporariamente as consultas. Aguarde alguns segundos e tente novamente.",
            503,
            "INTERNAL_ERROR",
          );
        }
        if (dedup.size > 0) break;
        throw new AppError(
          `Não foi possível consultar o PNCP (${result.message}).`,
          502,
          "INTERNAL_ERROR",
        );
      }

      total = Number(result.data.total ?? 0);
      const items = result.data.items ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        const key =
          item.numero_controle_pncp ||
          item.id ||
          `${item.orgao_cnpj}-${item.ano}-${item.numero_sequencial}`;
        if (!dedup.has(key)) dedup.set(key, item);
      }

      if (items.length < DEFAULT_PAGE_SIZE) break;
      page += 1;
      await sleep(350);
    }

    if (dedup.size > 0) break;
    await sleep(300);
  }

  return [...dedup.values()].slice(0, MAX_CONTRACTS);
}

export async function fetchContratoDetalhe(
  orgaoCnpj: string,
  ano: string | number,
  sequencial: string | number,
): Promise<PncpConsultaContrato | null> {
  const seq = String(sequencial).replace(/^0+/, "") || "0";
  const url = `${PNCP_CONSULTA_BASE_URL}/v1/orgaos/${orgaoCnpj}/contratos/${ano}/${seq}`;
  const result = await fetchJson<PncpConsultaContrato>(url);
  if (!result.ok) return null;
  return result.data;
}

export async function filterContratosPorFornecedor(
  items: PncpSearchContratoItem[],
  cnpjDigits: string,
): Promise<PncpSearchContratoItem[]> {
  if (items.length === 0) return [];

  const sampleSize = Math.min(items.length, 8);
  let successes = 0;
  let matches = 0;

  for (let i = 0; i < sampleSize; i += 1) {
    const item = items[i];
    if (!item.orgao_cnpj || !item.ano || !item.numero_sequencial) continue;

    const detail = await fetchContratoDetalhe(item.orgao_cnpj, item.ano, item.numero_sequencial);
    if (!detail) continue;

    successes += 1;
    const ni = String(detail.niFornecedor ?? "").replace(/\D/g, "");
    if (ni === cnpjDigits) matches += 1;
    await sleep(450);
  }

  if (successes === 0) return items;
  if (matches === 0) return [];
  return items;
}
