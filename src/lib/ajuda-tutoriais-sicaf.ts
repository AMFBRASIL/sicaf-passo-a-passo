export const TUTORIAL_GOV_BASE =
  "https://tutoriais.comprasgovernamentais.gov.br/sicaf/html";

export type TutorialGovTopico = {
  id: string;
  titulo: string;
  subtitulo: string;
  urls: string[];
};

function demoUrl(n: number) {
  return `${TUTORIAL_GOV_BASE}/demo_${n}.html`;
}

export const TOPICOS_CADASTRO_SICAF: TutorialGovTopico[] = [
  {
    id: "cadastro-sicaf",
    titulo: "Cadastro do SICAF",
    subtitulo: "Tutorial oficial — etapas 8 a 16",
    urls: Array.from({ length: 9 }, (_, i) => demoUrl(8 + i)),
  },
  {
    id: "linha-fornecimento",
    titulo: "Linha de fornecimento",
    subtitulo: "Como cadastrar a linha de fornecimento",
    urls: [demoUrl(17)],
  },
  {
    id: "emissao-crc",
    titulo: "Emissão do CRC",
    subtitulo: "Certificado de Registro Cadastral",
    urls: [demoUrl(18)],
  },
  {
    id: "situacao-fornecedor-gov",
    titulo: "Situação fornecedor",
    subtitulo: "Consulta e envio no Compras.gov.br",
    urls: [demoUrl(19)],
  },
];
