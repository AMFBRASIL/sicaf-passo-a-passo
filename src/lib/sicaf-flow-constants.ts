export const SICAF_TOTAL_ETAPAS = 2;

export const SICAF_PASSOS = [
  {
    n: 1,
    titulo: "Pagamento da taxa CADBRASIL",
    descricao: "Confirme o pagamento para liberar o Assistente e a atualização do SICAF.",
    tempoMin: 2,
  },
  {
    n: 2,
    titulo: "Validar SICAF com o Assistente",
    descricao:
      "Abra o Assistente CADBRASIL para validar os documentos e atualizar seu cadastro no Compras.gov.br.",
    tempoMin: 8,
  },
] as const;
