/**
 * Preços comerciais SICAF / manutenção — fonte: configuracoes_sistema (via /api/sicaf/valores).
 * Os números abaixo são apenas fallback se a API falhar ou a chave ainda não existir no banco.
 */

export const PRECO_FALLBACK = {
  valorCadastroSicaf: 985,
  valorCadastroSicafImediato: 1480,
  valorManutencaoMensal: 155,
} as const;

export type SicafPrecosComerciais = {
  valorCadastroSicaf: number;
  valorCadastroSicafImediato: number;
  valorManutencaoMensal: number;
  valorManutencaoAnual: number;
};

export function anualFromMensal(mensal: number): number {
  return Math.round(mensal * 12 * 100) / 100;
}

export function formatBrl(valor: number): string {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Formata número como 1.480,00 (sem R$). */
export function formatMoneyPtBr(valor: number): string {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte texto pt-BR/US para número.
 * Ex.: "1.480,00" → 1480 | "155,00" → 155 | "1480" → 1480
 */
export function parseMoneyPtBr(raw: string, fallback = 0): number {
  if (raw === undefined || raw === null || String(raw).trim() === "") return fallback;
  let s = String(raw).trim().replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (!s) return fallback;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

/**
 * Máscara de digitação: só dígitos → centavos → "1.480,00".
 * Digitar 148000 resulta em 1.480,00.
 */
export function maskMoneyPtBrInput(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  if (!Number.isFinite(cents)) return "";
  return formatMoneyPtBr(cents / 100);
}

export function normalizeSicafPrecos(
  raw?: Partial<{
    valorCadastroSicaf: number;
    valorCadastroSicafImediato: number;
    valorManutencaoMensal: number;
    valorManutencaoAnual: number;
  }> | null,
): SicafPrecosComerciais {
  const valorCadastroSicaf = Number(raw?.valorCadastroSicaf);
  const valorCadastroSicafImediato = Number(raw?.valorCadastroSicafImediato);
  const valorManutencaoMensal = Number(raw?.valorManutencaoMensal);
  const mensal =
    Number.isFinite(valorManutencaoMensal) && valorManutencaoMensal > 0
      ? valorManutencaoMensal
      : PRECO_FALLBACK.valorManutencaoMensal;
  const anualRaw = Number(raw?.valorManutencaoAnual);
  return {
    valorCadastroSicaf:
      Number.isFinite(valorCadastroSicaf) && valorCadastroSicaf > 0
        ? valorCadastroSicaf
        : PRECO_FALLBACK.valorCadastroSicaf,
    valorCadastroSicafImediato:
      Number.isFinite(valorCadastroSicafImediato) && valorCadastroSicafImediato > 0
        ? valorCadastroSicafImediato
        : PRECO_FALLBACK.valorCadastroSicafImediato,
    valorManutencaoMensal: mensal,
    valorManutencaoAnual:
      Number.isFinite(anualRaw) && anualRaw > 0 ? anualRaw : anualFromMensal(mensal),
  };
}

export const PRECOS_FALLBACK_NORMALIZED = normalizeSicafPrecos(null);
