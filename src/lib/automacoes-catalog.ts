export type AcaoAutomacaoTipo =
  | "email"
  | "whatsapp"
  | "ticket"
  | "tarefa"
  | "cobranca"
  | "acesso"
  | "alerta"
  | "agendar";

export interface FluxoAutomacao {
  id?: string;
  nome: string;
  descricao?: string;
  gatilho: string;
  gatilhoTipo: string;
  condicoes?: string;
  acoes: { tipo: AcaoAutomacaoTipo; label: string; config?: string; delay?: string }[];
  ativo: boolean;
  rodou?: number;
}

export type GatilhoCatalogItem = {
  value: string;
  label: string;
  grupo: string;
  descricao?: string;
};

/** Catálogo de gatilhos disponíveis no wizard de automações. */
export const GATILHOS_CATALOG: GatilhoCatalogItem[] = [
  // SICAF — status
  { grupo: "SICAF — Status", value: "sicaf_ativado", label: "Cliente SICAF ativado", descricao: "Status alterado para Ativo" },
  { grupo: "SICAF — Status", value: "sicaf_cancelado", label: "Cliente SICAF cancelado", descricao: "Status alterado para Cancelado" },
  { grupo: "SICAF — Status", value: "sicaf_suspenso", label: "Cliente SICAF suspenso", descricao: "Status alterado para Suspenso" },
  { grupo: "SICAF — Status", value: "sicaf_vencendo", label: "SICAF entrando em vencimento", descricao: "Faltam ≤ 30 dias para vencer" },
  { grupo: "SICAF — Status", value: "sicaf_vencido", label: "SICAF vencido", descricao: "Validade expirada" },
  { grupo: "SICAF — Status", value: "sicaf_pendente", label: "SICAF com pendência", descricao: "Documentos ou pagamento pendentes" },
  { grupo: "SICAF — Status", value: "sicaf_renovado", label: "SICAF renovado", descricao: "Renovação concluída com sucesso" },
  { grupo: "SICAF — Status", value: "sicaf_regularizado", label: "SICAF regularizado manualmente", descricao: "Admin registrou pagamento retroativo" },

  // Financeiro
  { grupo: "Financeiro", value: "pagamento_recebido", label: "Cliente pagou fatura", descricao: "Confirmação de pagamento" },
  { grupo: "Financeiro", value: "pagamento_atrasado", label: "Pagamento em atraso", descricao: "Fatura vencida e não paga" },
  { grupo: "Financeiro", value: "boleto_vencendo", label: "Boleto vence em X dias", descricao: "Lembrete antes do vencimento" },
  { grupo: "Financeiro", value: "boleto_vencido", label: "Boleto vencido", descricao: "Cobrança não quitada no prazo" },
  { grupo: "Financeiro", value: "fatura_cancelada", label: "Fatura cancelada", descricao: "Cancelamento de cobrança" },
  { grupo: "Financeiro", value: "primeira_fatura_paga", label: "Primeira fatura paga", descricao: "Primeiro pagamento do cliente" },

  // Documentos & certidões
  { grupo: "Documentos", value: "certidao_vencendo", label: "Certidão vence em X dias", descricao: "Alerta de renovação de certidão" },
  { grupo: "Documentos", value: "certidao_vencida", label: "Certidão vencida", descricao: "Certidão fora da validade" },
  { grupo: "Documentos", value: "certidao_aprovada", label: "Certidão aprovada", descricao: "Documento validado pela equipe" },
  { grupo: "Documentos", value: "certidao_reprovada", label: "Certidão reprovada", descricao: "Documento recusado — reenvio necessário" },
  { grupo: "Documentos", value: "documento_enviado", label: "Cliente enviou documento", descricao: "Novo upload para análise" },

  // Cliente & conta
  { grupo: "Cliente", value: "novo_cliente", label: "Novo cliente cadastrado", descricao: "Cadastro concluído no sistema" },
  { grupo: "Cliente", value: "cliente_inadimplente", label: "Cliente inadimplente", descricao: "Débitos em aberto" },
  { grupo: "Cliente", value: "score_risco", label: "Score de cancelamento alto", descricao: "Risco elevado de churn" },
  { grupo: "Cliente", value: "manutencao_ativada", label: "Manutenção ativada", descricao: "Plano de manutenção contratado" },
  { grupo: "Cliente", value: "manutencao_cancelada", label: "Manutenção cancelada", descricao: "Plano de manutenção encerrado" },
  { grupo: "Cliente", value: "onboarding_concluido", label: "Onboarding concluído", descricao: "Todas as etapas iniciais finalizadas" },

  // Licitação
  { grupo: "Licitação", value: "licitacao_apto", label: "Cliente apto a licitar", descricao: "Todos os níveis SICAF OK" },
  { grupo: "Licitação", value: "licitacao_inapto", label: "Cliente inapto a licitar", descricao: "Pendência impede participação" },

  // Suporte
  { grupo: "Suporte", value: "ticket_aberto", label: "Novo ticket aberto", descricao: "Cliente abriu chamado" },
  { grupo: "Suporte", value: "ticket_sla", label: "Ticket próximo do SLA", descricao: "Prazo de atendimento expirando" },
  { grupo: "Suporte", value: "ticket_resolvido", label: "Ticket resolvido", descricao: "Chamado encerrado" },

  // Outros
  { grupo: "Outros", value: "manual", label: "Disparo manual", descricao: "Executado pelo operador" },
];

export const GATILHOS_GRUPOS = [...new Set(GATILHOS_CATALOG.map((g) => g.grupo))];

export function gatilhoLabel(value: string): string {
  return GATILHOS_CATALOG.find((g) => g.value === value)?.label ?? value;
}

export const TEMPLATES_IA = [
  {
    nome: "Boas-vindas após pagamento",
    gatilho: "pagamento_recebido",
    acoes: [
      { tipo: "ticket" as const, label: "Criar ticket de onboarding" },
      { tipo: "email" as const, label: "E-mail de boas-vindas", delay: "imediato" },
      { tipo: "acesso" as const, label: "Liberar acesso ao SICAF" },
    ],
  },
  {
    nome: "E-mail ao ativar SICAF",
    gatilho: "sicaf_ativado",
    acoes: [
      { tipo: "email" as const, label: "E-mail de SICAF ativo", delay: "imediato" },
      { tipo: "whatsapp" as const, label: "WhatsApp de confirmação", delay: "imediato" },
    ],
  },
  {
    nome: "E-mail ao cancelar SICAF",
    gatilho: "sicaf_cancelado",
    acoes: [
      { tipo: "email" as const, label: "E-mail de cancelamento (template)", delay: "imediato" },
      { tipo: "alerta" as const, label: "Alertar gerente da conta", delay: "imediato" },
    ],
  },
  {
    nome: "Régua de cobrança",
    gatilho: "boleto_vencendo",
    acoes: [
      { tipo: "whatsapp" as const, label: "Lembrete D-3", delay: "3 dias antes" },
      { tipo: "email" as const, label: "Aviso D-1", delay: "1 dia antes" },
      { tipo: "cobranca" as const, label: "Gerar 2ª via PIX", delay: "no vencimento" },
    ],
  },
  {
    nome: "Renovação SICAF vencendo",
    gatilho: "sicaf_vencendo",
    acoes: [
      { tipo: "email" as const, label: "E-mail de renovação", delay: "imediato" },
      { tipo: "whatsapp" as const, label: "Lembrete WhatsApp", delay: "1 dia depois" },
      { tipo: "cobranca" as const, label: "Gerar taxa de renovação", delay: "3 dias depois" },
    ],
  },
  {
    nome: "Retenção de cliente em risco",
    gatilho: "score_risco",
    acoes: [
      { tipo: "alerta" as const, label: "Avisar gerente da conta" },
      { tipo: "email" as const, label: "Oferta de retenção" },
      { tipo: "agendar" as const, label: "Follow-up em 7 dias" },
    ],
  },
  {
    nome: "Certidão reprovada",
    gatilho: "certidao_reprovada",
    acoes: [
      { tipo: "email" as const, label: "E-mail com motivo da reprovação", delay: "imediato" },
      { tipo: "ticket" as const, label: "Criar ticket para operador", delay: "imediato" },
    ],
  },
];

/** Fluxos de exemplo exibidos na listagem inicial (até integração com API/DB). */
export const FLUXOS_EXEMPLO: FluxoAutomacao[] = [
  {
    id: "1",
    nome: "Boas-vindas ao pagar",
    descricao: "Onboarding automático após confirmação do pagamento",
    gatilho: gatilhoLabel("pagamento_recebido"),
    gatilhoTipo: "pagamento_recebido",
    acoes: [
      { tipo: "ticket", label: "Criar ticket de onboarding", delay: "imediato" },
      { tipo: "email", label: "Enviar e-mail de boas-vindas", delay: "imediato" },
      { tipo: "acesso", label: "Liberar acesso ao SICAF", delay: "imediato" },
    ],
    ativo: true,
    rodou: 142,
  },
  {
    id: "2",
    nome: "E-mail ao ativar SICAF",
    descricao: "Notifica o cliente quando o cadastro SICAF é ativado",
    gatilho: gatilhoLabel("sicaf_ativado"),
    gatilhoTipo: "sicaf_ativado",
    acoes: [
      { tipo: "email", label: "E-mail de SICAF ativo", delay: "imediato" },
      { tipo: "whatsapp", label: "WhatsApp de confirmação", delay: "imediato" },
    ],
    ativo: true,
    rodou: 89,
  },
  {
    id: "3",
    nome: "E-mail ao cancelar SICAF",
    descricao: "Envia template de cancelamento quando status muda para Cancelado",
    gatilho: gatilhoLabel("sicaf_cancelado"),
    gatilhoTipo: "sicaf_cancelado",
    acoes: [
      { tipo: "email", label: "E-mail de cancelamento (template)", delay: "imediato" },
      { tipo: "alerta", label: "Alertar gerente da conta", delay: "imediato" },
    ],
    ativo: true,
    rodou: 23,
  },
  {
    id: "4",
    nome: "Renovação SICAF vencendo",
    gatilho: gatilhoLabel("sicaf_vencendo"),
    gatilhoTipo: "sicaf_vencendo",
    acoes: [
      { tipo: "email", label: "E-mail de renovação", delay: "imediato" },
      { tipo: "whatsapp", label: "Lembrete WhatsApp", delay: "1 dia depois" },
      { tipo: "cobranca", label: "Gerar taxa de renovação", delay: "3 dias depois" },
    ],
    ativo: true,
    rodou: 156,
  },
  {
    id: "5",
    nome: "Aviso de certidão vencendo",
    gatilho: gatilhoLabel("certidao_vencendo"),
    gatilhoTipo: "certidao_vencendo",
    acoes: [
      { tipo: "whatsapp", label: "WhatsApp para responsável", delay: "imediato" },
      { tipo: "email", label: "E-mail com checklist", delay: "1 dia depois" },
      { tipo: "tarefa", label: "Criar tarefa para operador", delay: "imediato" },
    ],
    ativo: true,
    rodou: 68,
  },
  {
    id: "6",
    nome: "Cobrança automática",
    gatilho: gatilhoLabel("boleto_vencendo"),
    gatilhoTipo: "boleto_vencendo",
    acoes: [
      { tipo: "whatsapp", label: "Lembrete WhatsApp", delay: "3 dias antes" },
      { tipo: "cobranca", label: "Gerar 2ª via PIX", delay: "no vencimento" },
    ],
    ativo: true,
    rodou: 231,
  },
  {
    id: "7",
    nome: "SICAF suspenso — alerta equipe",
    gatilho: gatilhoLabel("sicaf_suspenso"),
    gatilhoTipo: "sicaf_suspenso",
    acoes: [
      { tipo: "email", label: "E-mail de suspensão ao cliente", delay: "imediato" },
      { tipo: "alerta", label: "Notificar operador responsável", delay: "imediato" },
      { tipo: "ticket", label: "Abrir ticket de regularização", delay: "imediato" },
    ],
    ativo: true,
    rodou: 11,
  },
  {
    id: "8",
    nome: "Recuperar cliente em risco",
    gatilho: gatilhoLabel("score_risco"),
    gatilhoTipo: "score_risco",
    acoes: [
      { tipo: "alerta", label: "Alertar gerente da conta", delay: "imediato" },
      { tipo: "email", label: "Oferta de retenção", delay: "1 dia depois" },
    ],
    ativo: false,
    rodou: 14,
  },
  {
    id: "9",
    nome: "Novo cliente — sequência de boas-vindas",
    gatilho: gatilhoLabel("novo_cliente"),
    gatilhoTipo: "novo_cliente",
    acoes: [
      { tipo: "email", label: "E-mail de boas-vindas", delay: "imediato" },
      { tipo: "agendar", label: "Follow-up em 3 dias", delay: "3 dias depois" },
      { tipo: "ticket", label: "Ticket de onboarding", delay: "imediato" },
    ],
    ativo: true,
    rodou: 47,
  },
  {
    id: "10",
    nome: "Documento reprovado",
    gatilho: gatilhoLabel("certidao_reprovada"),
    gatilhoTipo: "certidao_reprovada",
    acoes: [
      { tipo: "email", label: "E-mail com motivo da reprovação", delay: "imediato" },
      { tipo: "whatsapp", label: "WhatsApp solicitando reenvio", delay: "1 dia depois" },
    ],
    ativo: true,
    rodou: 34,
  },
];
