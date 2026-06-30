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
 * Vencendo (≤30 dias) com licença paga ainda está vigente — não exige novo pagamento.
 */
export function sicafAcessoLiberado({
  hasSicaf,
  status,
  financialReleased,
}: SicafTaxaAccessInput): boolean {
  const s = normalizeSicafStatus(status);
  if (!hasSicaf || !financialReleased) return false;
  return s === "Ativo" || s === "Vencendo";
}

/**
 * Quando exigir pagamento / bloquear acesso.
 *
 * Regra 2 — Vencido (data vencida): exige pagamento (renovação).
 * Regra 3 — Sem SICAF, Pendente, Ativo/Vencendo sem pagamento: exige pagamento.
 * Regra 1 — Ativo ou Vencendo + pago: não exige.
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

/** Manutenção só pode ser ativada com SICAF pago e vigente (Ativo ou Vencendo). */
export function podeAtivarManutencaoFromPainel(painel: PainelTaxaAccess): boolean {
  return sicafTaxaLiberada(painel);
}

export function podeAtivarManutencaoFromEmpresa(empresa: {
  sicaf?: SicafDisplayStatus;
  taxaPendente?: boolean;
  sicafId?: number;
}): boolean {
  if (empresa.taxaPendente === true) return false;
  const s = empresa.sicaf ?? "sem_cadastro";
  if (s === "vencido" || s === "sem_cadastro") return false;
  if (empresa.taxaPendente === false) return s === "ativo" || s === "atencao";
  return !!empresa.sicafId && (s === "ativo" || s === "atencao");
}

export function getManutencaoBloqueioMotivo(
  painel: PainelTaxaAccess | null | undefined,
  empresa?: { sicaf?: SicafDisplayStatus; taxaPendente?: boolean; sicafId?: number },
): string | null {
  const elegivel = painel
    ? podeAtivarManutencaoFromPainel(painel)
    : empresa
      ? podeAtivarManutencaoFromEmpresa(empresa)
      : false;
  if (elegivel) return null;

  if (painel) {
    const status = normalizeSicafStatus(painel.sicaf?.status);
    if (!painel.sicaf?.id || status === "Sem SICAF") {
      return "Cadastre e pague a taxa SICAF antes de ativar a manutenção.";
    }
    if (status === "Vencido") {
      return "Seu SICAF está vencido. Renove o cadastro para poder ativar a manutenção.";
    }
    if (!painel.financeiro?.taxaPaga) {
      return "Conclua o pagamento da taxa SICAF antes de ativar a manutenção.";
    }
    return "É necessário ter o SICAF pago e vigente antes de ativar a manutenção.";
  }

  const s = empresa?.sicaf ?? "sem_cadastro";
  if (s === "vencido") {
    return "Seu SICAF está vencido. Renove o cadastro para poder ativar a manutenção.";
  }
  if (s === "sem_cadastro" || !empresa?.sicafId) {
    return "Cadastre e pague a taxa SICAF antes de ativar a manutenção.";
  }
  return "Conclua o pagamento da taxa SICAF antes de ativar a manutenção.";
}

export type SicafDisplayStatus = "ativo" | "atencao" | "vencido" | "sem_cadastro";

/**
 * Botão "Gerenciar" em /empresas.
 * Taxa pendente → wizard/modal de pagamento.
 * Licença paga e vigente (Ativo/Vencendo) → painel lateral.
 */
export function shouldGerenciarAbrirPagamentoFromInput(input: SicafTaxaAccessInput): boolean {
  return needsSicafTaxaPaymentFromInput(input);
}

/** Fallback quando `taxaPendente` não veio da API — só sem cadastro ou já vencido. */
export function shouldGerenciarAbrirPagamentoFromSicaf(sicaf: SicafDisplayStatus): boolean {
  return sicaf === "vencido" || sicaf === "sem_cadastro";
}

/** Preferir no front quando `taxaPendente` vem da API. */
export function shouldGerenciarAbrirPagamentoFromEmpresa(empresa: {
  taxaPendente?: boolean;
  sicaf?: SicafDisplayStatus;
}): boolean {
  if (typeof empresa.taxaPendente === "boolean") return empresa.taxaPendente;
  return shouldGerenciarAbrirPagamentoFromSicaf(empresa.sicaf ?? "sem_cadastro");
}
