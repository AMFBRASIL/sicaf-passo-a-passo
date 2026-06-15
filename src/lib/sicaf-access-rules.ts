export type SicafTaxaAccessInput = {
  hasSicaf: boolean;
  /** Status exibido (Ativo, Vencido, Vencendo, Pendente, Sem SICAF…) */
  status: string;
  /** Pagamento confirmado em taxas_sicaf / financeiro */
  financialReleased: boolean;
};

type PainelTaxaAccess = {
  sicaf?: { id?: number; status?: string | null } | null;
  financeiro?: { taxaPaga?: boolean } | null;
} | null | undefined;

function normalizeSicafStatus(status?: string | null): string {
  return String(status || "").trim() || "Sem SICAF";
}

/**
 * Regra 1 — SICAF Ativo **e** pago: cliente liberado (assistente, documentos, etc.).
 */
export function sicafAcessoLiberado({
  hasSicaf,
  status,
  financialReleased,
}: SicafTaxaAccessInput): boolean {
  const s = normalizeSicafStatus(status);
  if (!hasSicaf || s !== "Ativo") return false;
  return financialReleased;
}

/**
 * Quando exigir pagamento / bloquear acesso.
 *
 * Regra 2 — Vencido (data vencida): sempre bloqueia e exige pagamento (renovação).
 * Regra 3 — Sem SICAF, Pendente, Ativo sem pagamento, Vencendo, etc.: exige pagamento.
 * Regra 1 — Ativo + pago: não exige.
 */
export function needsSicafTaxaPaymentFromInput(input: SicafTaxaAccessInput): boolean {
  const s = normalizeSicafStatus(input.status);
  if (!input.hasSicaf || s === "Sem SICAF") return true;
  if (s === "Vencido") return true;
  if (sicafAcessoLiberado(input)) return false;
  return true;
}

export function needsSicafTaxaPaymentFromPainel(painel: PainelTaxaAccess): boolean {
  if (!painel) return true;
  return needsSicafTaxaPaymentFromInput({
    hasSicaf: !!painel.sicaf?.id,
    status: painel.sicaf?.status || "Sem SICAF",
    financialReleased: !!painel.financeiro?.taxaPaga,
  });
}

/** Alias usado em /sicaf, /assistente e /documentos. */
export function sicafTaxaLiberada(painel: PainelTaxaAccess): boolean {
  if (!painel) return false;
  return sicafAcessoLiberado({
    hasSicaf: !!painel.sicaf?.id,
    status: painel.sicaf?.status || "Sem SICAF",
    financialReleased: !!painel.financeiro?.taxaPaga,
  });
}

export type SicafDisplayStatus = "ativo" | "atencao" | "vencido" | "sem_cadastro";

/**
 * Botão "Gerenciar" em /empresas.
 * Taxa pendente (Sem SICAF, vencido, sem pagamento, inativo, vencendo…) → wizard/modal de pagamento.
 * Ativo + pago → painel lateral (EmpresaDetalhesSheet).
 */
export function shouldGerenciarAbrirPagamentoFromInput(input: SicafTaxaAccessInput): boolean {
  return needsSicafTaxaPaymentFromInput(input);
}

export function shouldGerenciarAbrirPagamentoFromSicaf(sicaf: SicafDisplayStatus): boolean {
  return sicaf === "vencido" || sicaf === "sem_cadastro" || sicaf === "atencao";
}

/** Preferir no front quando `taxaPendente` vem da API. */
export function shouldGerenciarAbrirPagamentoFromEmpresa(empresa: {
  taxaPendente?: boolean;
  sicaf?: SicafDisplayStatus;
}): boolean {
  if (typeof empresa.taxaPendente === "boolean") return empresa.taxaPendente;
  return shouldGerenciarAbrirPagamentoFromSicaf(empresa.sicaf ?? "sem_cadastro");
}
