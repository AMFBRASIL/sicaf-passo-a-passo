export const SICAF_TOTAL_ETAPAS = 6;

export const SICAF_PASSOS = [
  {
    n: 1,
    titulo: "Pagamento da taxa CADBRASIL",
    descricao: "Confirme o pagamento para liberar a atualização dos seus níveis.",
    tempoMin: 2,
  },
  {
    n: 2,
    titulo: "Documentação da empresa",
    descricao: "Envie os documentos básicos que vamos usar para o cadastro.",
    tempoMin: 4,
  },
  {
    n: 3,
    titulo: "Conectar ao Compras.gov.br",
    descricao: "Vamos instalar o Assistente CADBRASIL para automatizar o acesso.",
    tempoMin: 3,
  },
  {
    n: 4,
    titulo: "Atualizar Nível III — Receita Federal",
    descricao: "Encontramos documentos que precisam ser atualizados.",
    tempoMin: 4,
  },
  {
    n: 5,
    titulo: "Atualizar Nível IV — Qualificação técnica",
    descricao: "Envie ou confirme os documentos da sua atividade.",
    tempoMin: 5,
  },
  {
    n: 6,
    titulo: "Validação Final",
    descricao: "Confirmação final — você pronto para licitar.",
    tempoMin: 1,
  },
] as const;
