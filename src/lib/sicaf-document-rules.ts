/** Regras de upload por tipo de documento SICAF (espelha backend certidoes.service.js). */

export interface DocUploadRules {
  pdf: boolean;
  codigo: boolean;
  validade: boolean;
  uploadManual: boolean;
}

export function getDocUploadRules(codigo: string, nivel: string | null): DocUploadRules {
  if (nivel === "III") {
    return { pdf: false, codigo: false, validade: false, uploadManual: false };
  }
  if (["inscricao_municipal", "inscricao_estadual"].includes(codigo)) {
    return { pdf: true, codigo: true, validade: false, uploadManual: true };
  }
  if (["cnd_municipal", "cnd_estadual"].includes(codigo)) {
    return { pdf: true, codigo: true, validade: true, uploadManual: true };
  }
  return { pdf: true, codigo: false, validade: false, uploadManual: true };
}

export function getDocRequirementLabels(rules: DocUploadRules): string[] {
  const labels: string[] = [];
  if (!rules.uploadManual) {
    labels.push("Assistente SICAF");
    return labels;
  }
  labels.push("PDF");
  if (rules.codigo) labels.push("Código");
  if (rules.validade) labels.push("Validade");
  return labels;
}

export const SICAF_DOC_HINTS: Record<string, string> = {
  inscricao_municipal: "Informe o número de inscrição municipal (ISS).",
  inscricao_estadual: "Informe o número de inscrição estadual (ICMS).",
  cnd_municipal: "Código de autenticação da certidão negativa municipal.",
  cnd_estadual: "Código de autenticação da certidão negativa estadual.",
};
