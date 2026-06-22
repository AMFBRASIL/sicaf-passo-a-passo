const CNPJ_DIGITS = /^\d{14}$/;

export function normalizeCnpjDigits(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function isValidCnpjDigits(cnpj: string): boolean {
  if (!CNPJ_DIGITS.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj.slice(0, 12) + String(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(String(d1) + String(d2));
}

export function formatCnpjMasked(cnpjDigits: string): string {
  if (cnpjDigits.length !== 14) return cnpjDigits;
  return cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function buildPncpContratoUrl(
  numeroControle: string | null | undefined,
  dadosOriginais?: unknown,
): string | null {
  let payload: Record<string, unknown> | null = null;
  if (dadosOriginais) {
    try {
      payload =
        typeof dadosOriginais === "string"
          ? (JSON.parse(dadosOriginais) as Record<string, unknown>)
          : (dadosOriginais as Record<string, unknown>);
    } catch {
      payload = null;
    }
  }

  const controle =
    numeroControle ||
    (payload?.numeroControlePNCP as string | undefined) ||
    (payload?.numeroControlePncp as string | undefined);
  if (!controle) return null;

  const match = String(controle).match(/^(\d{14})-2-(\d+)\/(\d{4})$/);
  if (!match) return null;
  const [, cnpjOrgao, sequencial, ano] = match;
  return `https://pncp.gov.br/app/contratos/${cnpjOrgao}/${ano}/${sequencial}`;
}

export function buildPortalTransparenciaUrl(cnpjDigits: string): string {
  return `https://portaldatransparencia.gov.br/busca/pessoa-juridica/${cnpjDigits}`;
}

export function buildPortalTransparenciaContratosUrl(cnpjDigits: string): string {
  const params = new URLSearchParams({
    paginacaoSimples: "true",
    tamanhoPagina: "15",
    offset: "0",
    ordenarPor: "dataFimVigencia",
    direcao: "desc",
    cpfCnpjFornecedor: cnpjDigits,
  });
  return `https://portaldatransparencia.gov.br/contratos/consulta?${params.toString()}`;
}

export function parseBrDateToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return toIsoDate(trimmed);
}

export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function withPercentuais<T extends { quantidade: number; valor: number }>(
  items: T[],
  totalBase: number,
): Array<T & { percentual: number }> {
  const base = totalBase > 0 ? totalBase : items.reduce((s, i) => s + i.quantidade, 0);
  return items.map((item) => ({
    ...item,
    percentual: base > 0 ? Math.round((item.quantidade / base) * 100) : 0,
  }));
}
