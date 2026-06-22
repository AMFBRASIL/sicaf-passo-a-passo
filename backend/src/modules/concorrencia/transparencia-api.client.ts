import { AppError } from "@/lib/http/errors";

/** Documentação: https://api.portaldatransparencia.gov.br/swagger-ui/index.html */
export const TRANSPARENCIA_API_BASE_URL =
  "https://api.portaldatransparencia.gov.br/api-de-dados";

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGES = 50;
const MAX_CONTRACTS = 500;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [800, 1_600, 3_200];

export type TransparenciaOrgaoRef = {
  codigo?: string | number;
  codigoSIAFI?: string;
  sigla?: string;
  nome?: string;
};

export type TransparenciaUnidadeGestora = {
  codigo?: string;
  nome?: string;
  orgaoVinculado?: TransparenciaOrgaoRef;
  orgaoMaximo?: TransparenciaOrgaoRef;
};

export type TransparenciaFornecedor = {
  nome?: string;
  razaoSocialReceita?: string;
  nomeFantasiaReceita?: string;
  cnpjFormatado?: string;
};

export type TransparenciaContrato = {
  id?: number;
  numero?: string;
  numeroContrato?: string;
  numeroProcesso?: string;
  objeto?: string;
  situacaoContrato?: string;
  modalidadeCompra?: string;
  dataAssinatura?: string;
  dataPublicacaoDOU?: string;
  dataInicioVigencia?: string;
  dataFimVigencia?: string;
  valorInicialCompra?: number;
  valorFinalCompra?: number;
  valorContratado?: number | string;
  unidadeGestora?: TransparenciaUnidadeGestora;
  unidadeGestoraCompras?: TransparenciaUnidadeGestora;
  fornecedor?: TransparenciaFornecedor;
  compra?: { objeto?: string; numeroProcesso?: string };
  [key: string]: unknown;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string | null {
  const key = process.env.PORTAL_TRANSPARENCIA_API_KEY?.trim();
  return key || null;
}

export function isTransparenciaApiConfigured(): boolean {
  return Boolean(getApiKey());
}

async function fetchJson<T>(
  url: string,
  apiKey: string,
  attempt = 0,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "chave-api-dados": apiKey,
        "User-Agent": "CADBRASIL-Concorrencia/1.0",
      },
    });

    const text = await response.text();

    if ((response.status === 429 || response.status >= 500) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      return fetchJson<T>(url, apiKey, attempt + 1);
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: text.slice(0, 400) || `HTTP ${response.status}`,
      };
    }

    if (!text.trim()) {
      return { ok: true, data: [] as T };
    }

    return { ok: true, data: JSON.parse(text) as T };
  } catch (error) {
    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      return fetchJson<T>(url, apiKey, attempt + 1);
    }

    const message = error instanceof Error ? error.message : "Falha na requisição";
    return { ok: false, status: 0, message };
  } finally {
    clearTimeout(timer);
  }
}

function buildContratosUrl(cpfCnpj: string, pagina: number): string {
  const params = new URLSearchParams({
    cpfCnpj,
    pagina: String(pagina),
  });
  return `${TRANSPARENCIA_API_BASE_URL}/contratos/cpf-cnpj?${params.toString()}`;
}

/** Contratos do Poder Executivo Federal pelo CPF/CNPJ do fornecedor. */
export async function searchContratosPorFornecedor(
  cnpjDigits: string,
): Promise<TransparenciaContrato[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AppError(
      "API do Portal da Transparência não configurada. Defina PORTAL_TRANSPARENCIA_API_KEY no servidor.",
      503,
      "INTERNAL_ERROR",
    );
  }

  const contratos: TransparenciaContrato[] = [];
  let pagina = 1;

  while (pagina <= MAX_PAGES && contratos.length < MAX_CONTRACTS) {
    const result = await fetchJson<TransparenciaContrato[]>(
      buildContratosUrl(cnpjDigits, pagina),
      apiKey,
    );

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        throw new AppError(
          "Chave da API do Portal da Transparência inválida ou expirada. Cadastre uma nova em portaldatransparencia.gov.br/api-de-dados/cadastrar-email.",
          503,
          "INTERNAL_ERROR",
        );
      }
      if (contratos.length > 0) break;
      throw new AppError(
        `Não foi possível consultar o Portal da Transparência (${result.message}).`,
        502,
        "INTERNAL_ERROR",
      );
    }

    const pageItems = Array.isArray(result.data) ? result.data : [];
    if (pageItems.length === 0) break;

    contratos.push(...pageItems);

    if (pageItems.length < DEFAULT_PAGE_SIZE) break;
    pagina += 1;
    await sleep(250);
  }

  return contratos.slice(0, MAX_CONTRACTS);
}
