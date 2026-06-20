import type { EmpresaData } from "@/lib/empresas-shared";
import type { NivelStatus } from "@/components/admin/nivel-dots";

export type EtapaEstado = "concluida" | "em_andamento" | "pendente";

export type ProcessoEtapa = {
  id: "ativacao" | "juridica" | "licitacoes_federais";
  ordem: number;
  titulo: string;
  subtitulo: string;
  descricao: string;
  estado: EtapaEstado;
  detalhe: string;
};

export type ProcessoClienteResumo = {
  etapas: ProcessoEtapa[];
  concluidas: number;
  total: number;
  percentual: number;
  processoConcluido: boolean;
  proximaEtapa: ProcessoEtapa | null;
};

function nivelStatus(empresa: EmpresaData, num: number): NivelStatus {
  return empresa.detalhesNiveis?.[num]?.status ?? "nao_cadastrado";
}

/** Empresa com Nível III (ou superior) habilitado no Compras.gov.br. */
function atingiuPeloMenosNivelIII(empresa: EmpresaData): boolean {
  if (nivelStatus(empresa, 3) !== "nao_cadastrado") return true;
  return (empresa.niveis ?? []).some((n) => n >= 3);
}

function forcarEtapasConcluidas(etapas: ProcessoEtapa[]): ProcessoEtapa[] {
  return etapas.map((etapa) => ({
    ...etapa,
    estado: "concluida" as const,
    detalhe:
      etapa.id === "licitacoes_federais"
        ? "Nível III habilitado no Compras.gov.br — processo essencial concluído para licitações federais."
        : etapa.id === "juridica"
          ? "Habilitação jurídica concluída (Nível II)."
          : "Ativação SICAF concluída na CADBRASIL.",
  }));
}

function etapaFromNivel(status: NivelStatus): Pick<ProcessoEtapa, "estado" | "detalhe"> {
  if (status === "validado") {
    return { estado: "concluida", detalhe: "Nível validado na Situação do Fornecedor." };
  }
  if (status === "vencendo") {
    return {
      estado: "em_andamento",
      detalhe: "Habilitado, mas com validade próxima do vencimento — renove em breve.",
    };
  }
  if (status === "vencido") {
    return {
      estado: "em_andamento",
      detalhe: "Habilitação expirada — atualize os documentos no SICAF.",
    };
  }
  if (status === "pendente") {
    return {
      estado: "em_andamento",
      detalhe: "Cadastro iniciado no Compras.gov.br — conclua a documentação.",
    };
  }
  return {
    estado: "pendente",
    detalhe: "Ainda não validado. Envie a Situação do Fornecedor pelo Assistente.",
  };
}

function etapaAtivacao(empresa: EmpresaData): ProcessoEtapa {
  const base = {
    id: "ativacao" as const,
    ordem: 1,
    titulo: "Ativação SICAF",
    subtitulo: "Licença e início do processo",
    descricao:
      "Pagamento da taxa CADBRASIL e liberação do processo de cadastro e atualização no Compras.gov.br.",
  };

  if (empresa.sicaf === "sem_cadastro" || empresa.taxaPendente) {
    return {
      ...base,
      estado: "pendente",
      detalhe: empresa.taxaPendente
        ? "Aguardando confirmação do pagamento da licença SICAF."
        : "Empresa ainda sem SICAF cadastrado na plataforma.",
    };
  }

  if (empresa.sicaf === "vencido") {
    return {
      ...base,
      estado: "em_andamento",
      detalhe: "Licença SICAF vencida — renove para retomar o processo.",
    };
  }

  const validade = empresa.validade ? ` Validade: ${empresa.validade}.` : "";
  return {
    ...base,
    estado: "concluida",
    detalhe: `Licença SICAF ativa na CADBRASIL.${validade}`,
  };
}

function etapaJuridica(empresa: EmpresaData): ProcessoEtapa {
  const nivel = etapaFromNivel(nivelStatus(empresa, 2));
  return {
    id: "juridica",
    ordem: 2,
    titulo: "Habilitação Jurídica",
    subtitulo: "Nível II — Compras.gov.br",
    descricao:
      "Contrato social, alterações consolidadas e documentos societários exigidos para habilitação jurídica.",
    ...nivel,
  };
}

function etapaLicitacoesFederais(empresa: EmpresaData): ProcessoEtapa {
  const nivel = etapaFromNivel(nivelStatus(empresa, 3));
  return {
    id: "licitacoes_federais",
    ordem: 3,
    titulo: "Habilitação para Licitações Federais",
    subtitulo: "Nível III — Regularidade fiscal federal",
    descricao:
      "CND Federal, FGTS e débitos trabalhistas — requisitos para participar de licitações do governo federal.",
    ...nivel,
  };
}

/** Três marcos do processo do cliente na CADBRASIL. */
export function buildProcessoClienteEtapas(empresa: EmpresaData): ProcessoClienteResumo {
  const etapasBrutas = [
    etapaAtivacao(empresa),
    etapaJuridica(empresa),
    etapaLicitacoesFederais(empresa),
  ];
  const etapas = atingiuPeloMenosNivelIII(empresa)
    ? forcarEtapasConcluidas(etapasBrutas)
    : etapasBrutas;
  const concluidas = etapas.filter((e) => e.estado === "concluida").length;
  const total = etapas.length;
  const proximaEtapa = etapas.find((e) => e.estado !== "concluida") ?? null;

  return {
    etapas,
    concluidas,
    total,
    percentual: Math.round((concluidas / total) * 100),
    processoConcluido: concluidas === total,
    proximaEtapa,
  };
}
