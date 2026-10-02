import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Gavel, Hourglass, Info, Wallet } from "lucide-react";
import {
  AssessoriaPortalPage,
  type AssessoriaPortalConfig,
} from "@/components/assessoria-portal/assessoria-portal-page";

type BllSearch = { cnpj?: string };

export const Route = createFileRoute("/bll")({
  head: () => ({
    meta: [
      { title: "Cadastro BLL Compras — Portal CADBRASIL" },
      {
        name: "description",
        content:
          "Assessoria CADBRASIL de documentação para o cadastro de fornecedores na BLL Compras.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): BllSearch => ({
    cnpj: typeof search.cnpj === "string" ? search.cnpj : undefined,
  }),
  component: BllPage,
});

const BLL_CONFIG: AssessoriaPortalConfig = {
  portal: "bll",
  nome: "BLL",
  titulo: "Cadastro BLL Compras",
  subtitulo:
    "Deixe a documentação em ordem antes de entrar na BLL: a CADBRASIL confere tudo para o cadastro ser liberado sem retrabalho.",
  icon: <Gavel className="h-5 w-5" />,
  statusLabel: {
    aguardando_pagamento: "Aguardando pagamento",
    documentacao: "Envio de documentos",
    conferencia_cadbrasil: "Em conferência pela CADBRASIL",
    pendencia_documentos: "Documentos com pendência",
    protocolado: "Cadastro iniciado na BLL",
    analise_governo: "Em validação pela BLL",
    exigencia_governo: "Pendência apontada pela BLL",
    aprovado: "Cadastro liberado na BLL",
    indeferido: "Cadastro recusado pela BLL",
  },
  passos: [
    "Pagamento da assessoria",
    "Envio dos documentos",
    "Conferência CADBRASIL",
    "Cadastro na plataforma BLL",
    "Validação pela BLL",
    "Cadastro liberado",
  ],
  avisos: [
    {
      icon: Info,
      titulo: "A CADBRASIL não é a BLL nem órgão do governo",
      texto:
        "Somos uma assessoria privada especializada em licitações. O valor cobrado aqui refere-se apenas à nossa assessoria de documentação.",
    },
    {
      icon: Wallet,
      titulo: "A BLL tem custo próprio",
      texto:
        "O uso da plataforma é cobrado diretamente pela BLL, conforme o plano escolhido (trimestral ou por lote vencido). Esse valor não está incluído na assessoria.",
    },
    {
      icon: Hourglass,
      titulo: "Prazo de validação é da BLL",
      texto:
        "Depois do envio, a liberação do cadastro depende da análise da própria BLL. A CADBRASIL não controla nem consegue acelerar essa etapa.",
    },
  ],
  semPrazo: "A liberação final depende da validação feita pela própria BLL.",
  pagamento: {
    rotulo: "Assessoria CADBRASIL · Documentação BLL",
    itens: [
      "Conferência de toda a documentação antes de entrar na BLL",
      "Kit de certidões de habilitação revisado e dentro da validade",
      "Orientação no pré-cadastro, escolha do plano e Termo de Adesão",
    ],
    observacao: (
      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Planos da BLL, cobrados pela própria BLL e à parte desta assessoria:{" "}
        <strong>trimestral</strong> (R$ 630,00 a cada 3 meses) ou <strong>por êxito</strong> (1,5%
        sobre o lote vencido, limitado a R$ 600,00 por lote). Valores divulgados em bll.org.br e
        sujeitos a alteração pela BLL.
      </p>
    ),
  },
  escolha: {
    pergunta: "Qual plano da BLL a empresa vai usar?",
    ajuda:
      "O plano é contratado e pago diretamente na BLL. Se ainda tiver dúvida, escolha o mais provável e ajustamos na conferência.",
    opcoes: [
      {
        id: "trimestral",
        label: "Plano trimestral",
        hint: "R$ 630,00 a cada 3 meses — indicado para quem participa de muitas licitações",
      },
      {
        id: "exito",
        label: "Plano por êxito",
        hint: "Paga só quando vence: 1,5% do lote arrematado, até R$ 600,00 por lote",
      },
    ],
    pendente: "Escolha o plano da BLL e envie todos os documentos obrigatórios.",
  },
  grupos: [
    { id: "cadastro_bll", label: "Documentos do cadastro na BLL" },
    { id: "habilitacao", label: "Kit de habilitação (exigido nos editais)" },
    { id: "complementares", label: "Complementares" },
  ],
  notaDocumentos:
    "Envie PDFs legíveis. A BLL exige contrato social autenticado: se o seu não tiver autenticação digital da Junta Comercial, envie cópia autenticada em cartório.",
  textoEnviado: "Se a CADBRASIL ou a BLL pedirem ajustes, o envio é liberado novamente aqui.",
  etapas: {
    conferencia:
      "Nossa equipe confere cada documento: validade das certidões, assinaturas, dados do representante legal e compatibilidade com o contrato social. Se algo precisar de ajuste, avisamos aqui e você reenvia na etapa 2.",
    protocolo:
      "Com tudo em ordem, fazemos com você o pré-cadastro na BLL Compras (bll.org.br) no plano escolhido. A BLL gera o Termo de Adesão, que deve ser assinado pelo representante legal (assinatura digital ou com firma reconhecida) e enviado junto com o contrato social.",
    analise:
      "A BLL confere o Termo de Adesão e os documentos e libera o acesso do fornecedor. Essa validação é feita exclusivamente pela BLL; se houver pendência, avisamos você aqui para corrigir.",
    aprovado:
      "Cadastro liberado: sua empresa já pode participar dos pregões, dispensas e leilões publicados na BLL por prefeituras e órgãos de todo o país, com a documentação de habilitação pronta para os editais.",
  },
  rotuloProtocolo: "Login / identificação na BLL",
  rotuloValidade: "Plano válido até",
  linkPortal: { href: "https://bll.org.br", label: "Acessar a BLL" },
  whatsappContexto: "BLL Compras",
};

function BllPage() {
  const { cnpj } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <AssessoriaPortalPage
      config={BLL_CONFIG}
      cnpj={cnpj}
      onSelecionarCnpj={(c, replace) => void navigate({ search: { cnpj: c }, replace })}
    />
  );
}
