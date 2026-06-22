export type ConcorrenciaGrupo = {
  nome: string;
  quantidade: number;
  valor: number;
  percentual: number;
};

export type ConcorrenciaContrato = {
  id: number;
  numeroContrato: string | null;
  numeroControlePncp: string | null;
  orgao: string | null;
  objeto: string | null;
  modalidade: string | null;
  tipo: string | null;
  situacao: string | null;
  valor: number;
  dataAssinatura: string | null;
  dataPublicacao: string | null;
  dataInicioVigencia: string | null;
  dataFimVigencia: string | null;
  urlPncp: string | null;
};

export type ConcorrenciaEmpresa = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  uf: string | null;
  municipio: string | null;
  fonteDados: string;
};

export type ConcorrenciaKpis = {
  totalContratos: number;
  valorTotal: number;
  valorMedio: number;
  totalOrgaos: number;
};

export type ConcorrenciaBuscaResult = {
  empresa: ConcorrenciaEmpresa;
  kpis: ConcorrenciaKpis;
  orgaos: ConcorrenciaGrupo[];
  modalidades: ConcorrenciaGrupo[];
  ministerios: ConcorrenciaGrupo[];
  contratos: ConcorrenciaContrato[];
  totalContratos: number;
  links?: {
    portalTransparencia: string;
    pessoaJuridica?: string;
  };
};
