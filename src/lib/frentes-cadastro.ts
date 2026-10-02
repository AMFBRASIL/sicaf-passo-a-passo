import type { LucideIcon } from "lucide-react";
import { Building2, Gavel, Globe, Landmark, ShieldCheck } from "lucide-react";

export type FrenteCadastroId = "sicaf" | "bec-caufesp" | "bll" | "licitacoes-e" | "pncp";

export type FrenteCadastro = {
  id: FrenteCadastroId;
  sigla: string;
  nome: string;
  abrangencia: string;
  resumo: string;
  descricao: string;
  icon: LucideIcon;
  /** Gradiente/acento do card (classes Tailwind). */
  accent: string;
  /** Cor sólida do ícone/badge. */
  cor: string;
  siteOficial: { label: string; url: string };
  /** Quando a frente já tem página própria no portal (ex.: SICAF → /sicaf). */
  rotaPropria?: "/sicaf" | "/caufesp" | "/bll" | "/licitacoes-e" | "/pncp";
  beneficios: string[];
  documentos: string[];
  etapas: { titulo: string; descricao: string }[];
  observacao?: string;
  destaque?: string;
};

export const FRENTES_CADASTRO: FrenteCadastro[] = [
  {
    id: "sicaf",
    sigla: "SICAF",
    nome: "Sistema de Cadastramento Unificado de Fornecedores",
    abrangencia: "Governo Federal",
    resumo: "Cadastro obrigatório para vender ao Governo Federal pelo Compras.gov.br.",
    descricao:
      "Cadastro oficial do Governo Federal, usado em todas as licitações do Compras.gov.br. A habilitação é organizada em níveis I a VI.",
    icon: ShieldCheck,
    accent: "from-emerald-500/15 to-emerald-600/5",
    cor: "bg-emerald-600",
    siteOficial: { label: "Compras.gov.br", url: "https://www.gov.br/compras" },
    rotaPropria: "/sicaf",
    destaque: "Pilar principal",
    beneficios: [],
    documentos: [],
    etapas: [],
  },
  {
    id: "bec-caufesp",
    sigla: "BEC · CAUFESP",
    nome: "Bolsa Eletrônica de Compras de SP · Cadastro Unificado de Fornecedores do Estado de São Paulo",
    abrangencia: "Estado de São Paulo",
    resumo: "Venda para secretarias, autarquias, universidades e hospitais do Governo de SP.",
    descricao:
      "O CAUFESP é o cadastro de fornecedores do Governo do Estado de São Paulo. Com ele, sua empresa recebe o CRC e passa a disputar as compras publicadas na BEC/SP — pregões eletrônicos e ofertas de compra de todo o estado.",
    icon: Landmark,
    accent: "from-sky-500/15 to-sky-600/5",
    cor: "bg-sky-600",
    siteOficial: { label: "bec.sp.gov.br", url: "https://www.bec.sp.gov.br" },
    rotaPropria: "/caufesp",
    beneficios: [
      "Acesso às compras diárias de secretarias, universidades e hospitais estaduais de SP.",
      "Pregões eletrônicos e ofertas de compra (dispensas) em uma só plataforma.",
      "CRC (Certificado de Registro Cadastral) aceito nas licitações do Estado.",
      "Não precisa reapresentar os documentos a cada licitação.",
    ],
    documentos: [
      "Contrato Social ou última alteração consolidada",
      "Cartão CNPJ",
      "Documento de identidade do representante legal",
      "Inscrição Estadual e/ou Municipal",
      "Certidões Federal (RFB/PGFN), FGTS e Trabalhista (CNDT)",
      "Certidões de regularidade Estadual e Municipal",
      "Balanço patrimonial e demonstrações do último exercício",
      "Certificado digital e-CNPJ (A1 ou A3)",
    ],
    etapas: [
      {
        titulo: "Análise da documentação",
        descricao: "Conferimos o que sua empresa já tem e o que precisa ser emitido.",
      },
      {
        titulo: "Pré-cadastro no CAUFESP",
        descricao: "Fazemos o pré-cadastro com o certificado digital da empresa.",
      },
      {
        titulo: "Envio dos documentos",
        descricao: "Encaminhamos os documentos para a unidade cadastradora do Estado.",
      },
      {
        titulo: "Emissão do CRC",
        descricao: "Com o cadastro aprovado, o CRC é emitido e a BEC fica liberada.",
      },
      {
        titulo: "Acompanhamento",
        descricao: "Monitoramos vencimentos de certidões para manter o cadastro ativo.",
      },
    ],
  },
  {
    id: "bll",
    sigla: "BLL",
    nome: "BLL Compras — Bolsa de Licitações e Leilões do Brasil",
    abrangencia: "Municípios de todo o Brasil",
    resumo: "Pregões e dispensas de prefeituras, câmaras e consórcios em todo o país.",
    descricao:
      "A BLL é uma das plataformas mais usadas por prefeituras, câmaras municipais e consórcios públicos. Um único cadastro dá acesso às licitações de todos os órgãos que utilizam a plataforma.",
    icon: Gavel,
    accent: "from-orange-500/15 to-orange-600/5",
    cor: "bg-orange-600",
    siteOficial: { label: "bll.org.br", url: "https://bll.org.br" },
    rotaPropria: "/bll",
    beneficios: [
      "Acesso a licitações de prefeituras e órgãos municipais em todo o Brasil.",
      "Pregões eletrônicos, dispensas eletrônicas e leilões na mesma plataforma.",
      "Um único cadastro vale para todos os órgãos que usam a BLL.",
      "Excelente porta de entrada para pequenas e médias empresas.",
    ],
    documentos: [
      "Contrato social e última alteração (autenticados)",
      "Cartão CNPJ",
      "Documento de identidade do representante legal",
      "Procuração (quando o operador não for o representante legal)",
      "Termo de Adesão gerado pela BLL, assinado pelo representante legal",
      "Certidões de habilitação (Federal, FGTS, CNDT, Estadual, Municipal, Falência)",
    ],
    etapas: [
      {
        titulo: "Assessoria de documentação",
        descricao: "Conferimos toda a documentação antes de entrar na BLL.",
      },
      {
        titulo: "Escolha do plano",
        descricao: "Trimestral ou por êxito, contratado diretamente com a BLL.",
      },
      {
        titulo: "Pré-cadastro e Termo de Adesão",
        descricao: "Pré-cadastro na plataforma e termo assinado pelo representante legal.",
      },
      {
        titulo: "Validação pela BLL",
        descricao: "A BLL confere os documentos e libera o acesso da empresa.",
      },
      {
        titulo: "Pronto para disputar",
        descricao: "Kit de habilitação em ordem para os editais da plataforma.",
      },
    ],
    observacao:
      "A BLL cobra do fornecedor pelo uso da plataforma (plano trimestral ou percentual sobre o lote vencido). Esse custo é pago diretamente à BLL, à parte da assessoria CADBRASIL.",
  },
  {
    id: "licitacoes-e",
    sigla: "Licitações-e",
    nome: "Licitações-e — Banco do Brasil",
    abrangencia: "Federal, estadual e municipal",
    resumo:
      "Assistente Licitações-e CADBRASIL: do acesso ao resultado nas licitações do Banco do Brasil.",
    descricao:
      "O Licitações-e é o portal de licitações do Banco do Brasil. Além das compras do próprio banco, é utilizado por estados, municípios e empresas estatais para pregões eletrônicos.",
    icon: Building2,
    accent: "from-amber-400/20 to-yellow-500/5",
    cor: "bg-amber-500",
    siteOficial: { label: "licitacoes-e.com.br", url: "https://www.licitacoes-e.com.br" },
    rotaPropria: "/licitacoes-e",
    destaque: "Assistente",
    beneficios: [
      "Participe das compras do Banco do Brasil e de órgãos conveniados.",
      "Pregões eletrônicos de estados, municípios e estatais.",
      "Credenciamento único, válido para todo o portal.",
      "Acompanhamento de editais e sessões em tempo real.",
    ],
    documentos: [
      "Contrato Social e alterações",
      "Cartão CNPJ",
      "Documento de identidade e CPF do representante",
      "Procuração para o operador (quando aplicável)",
      "Certificado digital e-CNPJ ou e-CPF do representante",
      "Comprovante de endereço da empresa",
    ],
    etapas: [
      {
        titulo: "Conferência dos documentos",
        descricao: "Validamos documentos da empresa e do representante.",
      },
      {
        titulo: "Solicitação do credenciamento",
        descricao: "Abrimos o pedido de credenciamento no Licitações-e.",
      },
      {
        titulo: "Validação do representante",
        descricao: "Validação via certificado digital ou em agência do Banco do Brasil.",
      },
      {
        titulo: "Liberação do acesso",
        descricao: "A chave e a senha de acesso são liberadas para a empresa.",
      },
      {
        titulo: "Primeiro acesso",
        descricao: "Acompanhamos o primeiro acesso e a configuração do perfil.",
      },
    ],
    observacao:
      "Dependendo do caso, o credenciamento pode exigir validação presencial em agência do Banco do Brasil — a CADBRASIL orienta em cada etapa.",
  },
  {
    id: "pncp",
    sigla: "PNCP",
    nome: "Portal Nacional de Contratações Públicas",
    abrangencia: "Nacional · Lei 14.133/2021",
    resumo:
      "PNCP Inteligente: pesquisa de oportunidades, inteligência de mercado público e treinamento.",
    descricao:
      "Pela Nova Lei de Licitações, todos os órgãos públicos divulgam seus editais, atas e contratos no PNCP. É a base do Radar de Licitações da CADBRASIL para encontrar oportunidades em qualquer plataforma.",
    icon: Globe,
    accent: "from-indigo-500/15 to-indigo-600/5",
    cor: "bg-indigo-600",
    siteOficial: { label: "pncp.gov.br", url: "https://pncp.gov.br" },
    rotaPropria: "/pncp",
    destaque: "Inteligente",
    beneficios: [
      "Todas as licitações do país, de todos os entes, em um só lugar.",
      "Base do Radar de Licitações da CADBRASIL.",
      "Consulta de atas de registro de preços e contratos firmados.",
      "Transparência para analisar concorrentes e preços praticados.",
    ],
    documentos: [
      "Cadastro ativo em ao menos uma plataforma de disputa (SICAF, BEC, BLL, Licitações-e…)",
      "Certidões fiscais e trabalhistas em dia",
      "Documentos de habilitação exigidos em cada edital",
      "Certificado digital e-CNPJ",
    ],
    etapas: [
      {
        titulo: "Configurar o Radar",
        descricao: "Definimos palavras-chave e regiões do seu segmento.",
      },
      {
        titulo: "Monitoramento diário",
        descricao: "Acompanhamos os editais publicados no PNCP todos os dias.",
      },
      {
        titulo: "Plataforma de disputa",
        descricao: "Identificamos em qual plataforma cada edital será disputado.",
      },
      {
        titulo: "Cadastro em dia",
        descricao: "Garantimos o cadastro ativo na plataforma necessária.",
      },
      { titulo: "Participação", descricao: "Acompanhamos sua participação até o resultado." },
    ],
    observacao:
      "O PNCP é um portal de divulgação: a disputa acontece na plataforma indicada no edital. Por isso, manter os cadastros das outras frentes em dia é o que garante sua participação.",
  },
];

export function getFrenteCadastro(id: string): FrenteCadastro | undefined {
  return FRENTES_CADASTRO.find((f) => f.id === id);
}

export function mensagemWhatsAppFrente(frente: FrenteCadastro): string {
  return `Olá! Estou no Portal CADBRASIL e quero fazer/regularizar meu cadastro no ${frente.sigla} (${frente.abrangencia}). Podem me ajudar?`;
}
