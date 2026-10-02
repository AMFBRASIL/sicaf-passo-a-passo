import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Hourglass, Info, Landmark } from "lucide-react";
import {
  AssessoriaPortalPage,
  type AssessoriaPortalConfig,
} from "@/components/assessoria-portal/assessoria-portal-page";

type CaufespSearch = { cnpj?: string };

export const Route = createFileRoute("/caufesp")({
  head: () => ({
    meta: [
      { title: "Cadastro CAUFESP (BEC/SP) — Portal CADBRASIL" },
      {
        name: "description",
        content:
          "Assessoria CADBRASIL para o cadastro de fornecedores do Estado de São Paulo (CAUFESP/BEC).",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): CaufespSearch => ({
    cnpj: typeof search.cnpj === "string" ? search.cnpj : undefined,
  }),
  component: CaufespPage,
});

const CAUFESP_CONFIG: AssessoriaPortalConfig = {
  portal: "caufesp",
  nome: "CAUFESP",
  titulo: "Cadastro CAUFESP (BEC/SP)",
  subtitulo:
    "Pague a assessoria, envie os documentos e a CADBRASIL cuida do protocolo no Governo de SP.",
  icon: <Landmark className="h-5 w-5" />,
  statusLabel: {
    aguardando_pagamento: "Aguardando pagamento",
    documentacao: "Envio de documentos",
    conferencia_cadbrasil: "Em conferência pela CADBRASIL",
    pendencia_documentos: "Documentos com pendência",
    protocolado: "Protocolado no CAUFESP",
    analise_governo: "Em análise pelo Governo de SP",
    exigencia_governo: "Exigência do Governo de SP",
    aprovado: "Cadastro aprovado",
    indeferido: "Cadastro indeferido",
  },
  passos: [
    "Pagamento da assessoria",
    "Envio dos documentos",
    "Conferência CADBRASIL",
    "Protocolo no CAUFESP",
    "Análise do Governo de SP",
    "Cadastro aprovado (CRC)",
  ],
  avisos: [
    {
      icon: Info,
      titulo: "A CADBRASIL não é órgão do governo",
      texto:
        "Somos uma assessoria privada especializada em licitações. O cadastro no CAUFESP é gratuito junto ao Governo de SP; o valor cobrado aqui refere-se exclusivamente aos nossos serviços de assessoria no processo.",
    },
    {
      icon: Hourglass,
      titulo: "Sem prazo garantido",
      texto:
        "A aprovação depende da análise da Unidade Cadastradora do Governo de SP, que pode pedir complementações. Por isso não é possível determinar prazo nem agilizar essa etapa.",
    },
  ],
  semPrazo: "Sem prazo definido: a aprovação depende da análise do Governo de SP.",
  pagamento: {
    rotulo: "Assessoria CADBRASIL · Cadastro CAUFESP",
    itens: [
      "Conferência completa da documentação exigida pelo Decreto SP 52.205/2007",
      "Pré-cadastro e protocolo no sistema CAUFESP",
      "Acompanhamento das exigências até o resultado da análise",
    ],
  },
  escolha: {
    pergunta: "Qual é a atividade da empresa?",
    ajuda: "Define quais inscrições e certidões estaduais/municipais o CAUFESP exige.",
    opcoes: [
      { id: "bens", label: "Fornecimento de bens", hint: "Vende produtos" },
      { id: "servicos", label: "Prestação de serviços", hint: "Presta serviços" },
      { id: "ambos", label: "Bens e serviços", hint: "Os dois" },
    ],
    pendente: "Informe a atividade da empresa e envie todos os documentos obrigatórios.",
  },
  grupos: [
    { id: "habilitacao_juridica", label: "Habilitação jurídica" },
    { id: "regularidade_fiscal", label: "Regularidade fiscal e trabalhista" },
    { id: "qualificacao_tecnica", label: "Qualificação técnica" },
    { id: "qualificacao_economica", label: "Qualificação econômico-financeira" },
    { id: "declaracoes", label: "Declarações" },
  ],
  rotuloCondicional: "Conforme atividade",
  notaDocumentos:
    "Envie PDFs legíveis. Documentos sem versão eletrônica precisam ser cópias autenticadas em cartório. Modelos das declarações: fale com a equipe CADBRASIL.",
  textoEnviado:
    "Se a CADBRASIL ou o Governo de SP pedirem ajustes, o envio é liberado novamente aqui.",
  etapas: {
    conferencia:
      "Nossa equipe confere cada documento (validade, assinaturas e compatibilidade com o contrato social). Se algo precisar de ajuste, avisamos aqui e você reenvia o documento na etapa 2.",
    protocolo:
      "Com a documentação conferida, a CADBRASIL faz o pré-cadastro no sistema CAUFESP, anexa os documentos e envia a solicitação para a Unidade Cadastradora do Governo de SP.",
    analise:
      "A Comissão de Avaliação Cadastral do Governo de SP analisa o pedido e pode solicitar complementações. Essa etapa é conduzida exclusivamente pelo governo: não há prazo definido e a CADBRASIL não consegue acelerá-la. Acompanhamos o andamento e avisamos você a cada retorno.",
    aprovado:
      "Com o deferimento, sua empresa recebe o Registro Cadastral (CRC), válido por 1 ano, e pode participar das compras do Estado de São Paulo pela BEC/SP.",
  },
  rotuloProtocolo: "Protocolo",
  rotuloValidade: "CRC válido até",
  linkPortal: { href: "https://www.bec.sp.gov.br", label: "Acessar a BEC/SP" },
  whatsappContexto: "CAUFESP (BEC/SP)",
};

function CaufespPage() {
  const { cnpj } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <AssessoriaPortalPage
      config={CAUFESP_CONFIG}
      cnpj={cnpj}
      onSelecionarCnpj={(c, replace) => void navigate({ search: { cnpj: c }, replace })}
    />
  );
}
