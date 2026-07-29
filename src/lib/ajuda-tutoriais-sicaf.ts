/**
 * Tutoriais oficiais atuais do Compras.gov.br (manuais 04/2025+).
 * Não usar demonstra.serpro.gov.br (sistema antigo) nem
 * tutoriais.comprasgovernamentais.gov.br (fora do ar / 502).
 */
export type TutorialGovTopico = {
  id: string;
  titulo: string;
  subtitulo: string;
  /** URL oficial no portal gov.br (PDF ou página). */
  url: string;
  /** Como abrir no modal / nova aba. */
  tipo: "pdf" | "pagina";
};

const MANUAL_APLICATIVO =
  "https://www.gov.br/compras/pt-br/acesso-a-informacao/manuais/manual-fase-externa/manual-aplicativo-compras";

const MANUAL_SICAF =
  "https://www.gov.br/compras/pt-br/acesso-a-informacao/manuais/manual-fase-externa/manual-sicaf";

export const TOPICOS_CADASTRO_SICAF: TutorialGovTopico[] = [
  {
    id: "cadastro-sicaf",
    titulo: "Cadastro do SICAF",
    subtitulo: "Credenciamento de CNPJ — tutorial oficial 04/2025",
    url: `${MANUAL_APLICATIVO}/29460_tutorial_credenciamento_de_cnpj_no_sicaf.pdf`,
    tipo: "pdf",
  },
  {
    id: "linha-fornecimento",
    titulo: "Linha de fornecimento",
    subtitulo: "Como cadastrar linhas de fornecimento — tutorial oficial 04/2025",
    url: `${MANUAL_APLICATIVO}/29465_tutorial_linhas_de_fornecimento.pdf`,
    tipo: "pdf",
  },
  {
    id: "emissao-crc",
    titulo: "Emissão do CRC",
    subtitulo: "Manual operacional do SICAF (fornecedor)",
    url: `${MANUAL_SICAF}/manual_do_sicaf__versao_final_sistema_fornecedor-1-5.pdf`,
    tipo: "pdf",
  },
  {
    id: "situacao-fornecedor-gov",
    titulo: "Situação fornecedor",
    subtitulo: "Consulta da situação no portal — ver também o vídeo CADBRASIL (Etapa 01)",
    url: `${MANUAL_SICAF}/manual_do_sicaf__versao_final_sistema_fornecedor-1-5.pdf`,
    tipo: "pdf",
  },
];
