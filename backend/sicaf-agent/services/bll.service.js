/**
 * Assessoria CADBRASIL de documentação para a BLL Compras (bll.org.br).
 *
 * A BLL exige para o cadastro: Termo de Adesão assinado pelo representante legal,
 * contrato social com a última alteração (autenticado) e procuração quando necessário.
 * As certidões de habilitação são cobradas em cada edital — a assessoria já as deixa em ordem.
 * O uso da plataforma é cobrado pela própria BLL (plano trimestral ou % sobre lote vencido).
 */
const { criarServicoAssessoria } = require('./assessoria-portal.service');

const DOCUMENTOS_BLL = [
  {
    codigo: 'contrato_social',
    grupo: 'cadastro_bll',
    nome: 'Contrato social e última alteração (autenticados)',
    descricao: 'Exigido pela BLL para validar o cadastro. Envie a versão consolidada ou o contrato com todas as alterações.',
    obrigatorio: true,
  },
  {
    codigo: 'documento_representante',
    grupo: 'cadastro_bll',
    nome: 'Documento oficial com foto do representante legal',
    descricao: 'RG ou CNH com CPF — acompanha o Termo de Adesão quando assinado à mão.',
    obrigatorio: true,
  },
  {
    codigo: 'cartao_cnpj',
    grupo: 'cadastro_bll',
    nome: 'Comprovante de inscrição no CNPJ',
    descricao: 'Cartão CNPJ atualizado, emitido no site da Receita Federal.',
    obrigatorio: true,
  },
  {
    codigo: 'procuracao',
    grupo: 'cadastro_bll',
    nome: 'Procuração',
    descricao: 'Apenas quando quem vai operar na BLL não consta como representante no contrato social.',
    obrigatorio: false,
  },
  {
    codigo: 'cnd_federal',
    grupo: 'habilitacao',
    nome: 'Certidão de Débitos Federais e Dívida Ativa da União',
    descricao: 'Certidão conjunta RFB/PGFN — inclui as contribuições previdenciárias (INSS).',
    obrigatorio: true,
    validade: true,
  },
  {
    codigo: 'crf_fgts',
    grupo: 'habilitacao',
    nome: 'Certificado de Regularidade do FGTS (CRF)',
    descricao: 'Emitido no site da Caixa Econômica Federal.',
    obrigatorio: true,
    validade: true,
  },
  {
    codigo: 'cndt',
    grupo: 'habilitacao',
    nome: 'Certidão Negativa de Débitos Trabalhistas (CNDT)',
    descricao: 'Emitida no site do Tribunal Superior do Trabalho.',
    obrigatorio: true,
    validade: true,
  },
  {
    codigo: 'cnd_estadual',
    grupo: 'habilitacao',
    nome: 'Certidão de regularidade estadual',
    descricao: 'Débitos com a Fazenda do Estado da sede da empresa.',
    obrigatorio: true,
    validade: true,
  },
  {
    codigo: 'cnd_municipal',
    grupo: 'habilitacao',
    nome: 'Certidão de regularidade municipal',
    descricao: 'Débitos com a Prefeitura da sede da empresa.',
    obrigatorio: true,
    validade: true,
  },
  {
    codigo: 'certidao_falencia',
    grupo: 'habilitacao',
    nome: 'Certidão negativa de falência e recuperação judicial',
    descricao: 'Expedida pelo distribuidor da sede da empresa.',
    obrigatorio: true,
    validade: true,
  },
  {
    codigo: 'balanco_patrimonial',
    grupo: 'habilitacao',
    nome: 'Balanço patrimonial e DRE do último exercício',
    descricao: 'Assinados pelo contador e pelo responsável — exigido na maioria dos editais.',
    obrigatorio: true,
  },
  {
    codigo: 'inscricao_estadual_municipal',
    grupo: 'complementares',
    nome: 'Inscrição estadual e/ou municipal',
    descricao: 'Comprovante de inscrição no cadastro de contribuintes, conforme a atividade.',
    obrigatorio: false,
  },
  {
    codigo: 'certidao_me_epp',
    grupo: 'complementares',
    nome: 'Certidão de enquadramento ME/EPP',
    descricao: 'Garante os benefícios da LC 123/2006 nas licitações (Junta Comercial).',
    obrigatorio: false,
  },
  {
    codigo: 'atestado_capacidade',
    grupo: 'complementares',
    nome: 'Atestado de capacidade técnica',
    descricao: 'Emitido por clientes (públicos ou privados) que já compraram da empresa.',
    obrigatorio: false,
  },
  {
    codigo: 'alvara_funcionamento',
    grupo: 'complementares',
    nome: 'Alvará de funcionamento / licenças do ramo',
    descricao: 'Quando a atividade exigir (ex.: Vigilância Sanitária, ANVISA).',
    obrigatorio: false,
    validade: true,
  },
];

module.exports = criarServicoAssessoria({
  nome: 'BLL',
  origem: 'bll',
  tabelaProcessos: 'bll_processos',
  tabelaDocumentos: 'bll_documentos',
  chaveValor: 'valor_assessoria_bll',
  valorPadrao: 479,
  descricaoCobranca: 'Assessoria CADBRASIL - Documentação BLL Compras',
  protocoloPrefixo: 'BLL',
  documentos: DOCUMENTOS_BLL,
  opcoes: ['trimestral', 'exito'],
  mensagemOpcaoPendente: 'Escolha o plano da BLL que a empresa vai usar.',
});
