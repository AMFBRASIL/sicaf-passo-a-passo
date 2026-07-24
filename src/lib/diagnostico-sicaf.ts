import type { NivelStatus } from "@/components/admin/nivel-dots";
import type { DocChecklistItem } from "@/lib/documentos-api";
import type { EmpresaGerenciarPainel } from "@/lib/empresas-api";
import { NIVEIS_SICAF, type EmpresaData } from "@/lib/empresas-shared";

export type DiagnosticoEtapaStatus = "ok" | "atencao" | "pendente";

export type DiagnosticoEtapa = {
  n: number;
  titulo: string;
  descricao: string;
  status: DiagnosticoEtapaStatus;
  detalhe: string;
};

export type DiagnosticoNivel = {
  num: number;
  roman: string;
  nome: string;
  color: string;
  status: NivelStatus;
  docsTotal: number;
  docsOk: number;
  docsFaltando: DocChecklistItem[];
};

export type DiagnosticoResultado = {
  empresa: EmpresaData;
  taxaPaga: boolean;
  sicafStatus: string;
  etapas: DiagnosticoEtapa[];
  niveis: DiagnosticoNivel[];
  docsFaltando: DocChecklistItem[];
  docsTotal: number;
  docsOk: number;
  niveisValidados: number;
  score: number;
  proximaEtapa: DiagnosticoEtapa | null;
  pendenciasPainel: EmpresaGerenciarPainel["pendencias"];
};

const NIVEL_STATUS_LABEL: Record<NivelStatus, string> = {
  validado: "Validado",
  vencendo: "Vencendo",
  vencido: "Vencido",
  pendente: "Em análise",
  nao_cadastrado: "Não cadastrado",
};

export function nivelStatusLabel(status: NivelStatus): string {
  return NIVEL_STATUS_LABEL[status];
}

function nivelStatusOf(empresa: EmpresaData, num: number): NivelStatus {
  return empresa.detalhesNiveis?.[num]?.status ?? "nao_cadastrado";
}

/** Nível já recebeu dados reais do Assistente (Situação do Fornecedor). */
function nivelSincronizado(status: NivelStatus): boolean {
  return status === "validado" || status === "vencendo" || status === "vencido";
}

function etapaStatusFromNivel(status: NivelStatus): DiagnosticoEtapaStatus {
  if (status === "validado") return "ok";
  if (status === "nao_cadastrado") return "pendente";
  return "atencao";
}

function detalheNivel(
  status: NivelStatus,
  faltando: DocChecklistItem[],
  vencimento?: string,
): string {
  const pend = faltando.length
    ? ` Faltam ${faltando.length} documento${faltando.length === 1 ? "" : "s"}: ${faltando
        .slice(0, 3)
        .map((d) => d.nome)
        .join(", ")}${faltando.length > 3 ? "…" : ""}.`
    : "";

  if (status === "validado") {
    return `Nível validado na Situação do Fornecedor.${vencimento ? ` Validade ${vencimento}.` : ""}`;
  }
  if (status === "vencendo") {
    return `Habilitado, mas com validade próxima do vencimento — renove em breve.${pend}`;
  }
  if (status === "vencido") {
    return `Habilitação expirada — atualize os documentos no SICAF.${pend}`;
  }
  if (status === "pendente") {
    return `Cadastro iniciado no Compras.gov.br — conclua a documentação.${pend}`;
  }
  return `Ainda não validado. Envie a Situação do Fornecedor pelo Assistente.${pend}`;
}

/** Documento que ainda impede o cadastro: não enviado, vencido ou vencendo. */
export function isDocFaltando(doc: DocChecklistItem): boolean {
  return doc.status !== "ok";
}

export function docFaltandoLabel(doc: DocChecklistItem): string {
  if (doc.status === "vencida") return "Vencido";
  if (doc.status === "vencendo") return "Vencendo";
  return "Não enviado";
}

export function buildDiagnosticoSicaf(params: {
  empresa: EmpresaData;
  painel: EmpresaGerenciarPainel | null;
  docsPorNivel: Record<number, DocChecklistItem[]>;
  taxaPaga: boolean;
}): DiagnosticoResultado {
  const { empresa, painel, docsPorNivel, taxaPaga } = params;

  const niveis: DiagnosticoNivel[] = NIVEIS_SICAF.map((nivel) => {
    const lista = docsPorNivel[nivel.num] || [];
    const faltando = lista.filter(isDocFaltando);
    return {
      num: nivel.num,
      roman: nivel.roman,
      nome: nivel.nome,
      color: nivel.color,
      status: nivelStatusOf(empresa, nivel.num),
      docsTotal: lista.length,
      docsOk: lista.length - faltando.length,
      docsFaltando: faltando,
    };
  });

  const docsFaltando = niveis.flatMap((n) => n.docsFaltando);
  const docsTotal = niveis.reduce((s, n) => s + n.docsTotal, 0);
  const docsOk = docsTotal - docsFaltando.length;
  const niveisValidados = niveis.filter((n) => n.status === "validado").length;
  const niveisSincronizados = niveis.filter((n) => nivelSincronizado(n.status)).length;

  const sicafStatus = painel?.sicaf?.status || "Sem SICAF";
  const sicafVencido = sicafStatus.toLowerCase() === "vencido";

  const docsBaseEnviados = (painel?.documentos || []).filter(
    (d) => d.status === "ok" || d.arquivoUrl,
  ).length;

  const validade = (empresa.validade || "").replace(/^validade\s+/i, "").trim();

  const etapaTaxa: DiagnosticoEtapa = {
    n: 1,
    titulo: "Pagamento da taxa CADBRASIL",
    descricao: "Libera a atualização dos seus níveis junto ao Compras.gov.br.",
    status: taxaPaga ? "ok" : sicafVencido ? "atencao" : "pendente",
    detalhe: taxaPaga
      ? `Licença SICAF paga e vigente.${validade ? ` Validade ${validade}.` : ""}`
      : sicafVencido
        ? "Licença SICAF vencida — renove para retomar o processo."
        : "Aguardando confirmação do pagamento da taxa CADBRASIL.",
  };

  const etapaDocumentos: DiagnosticoEtapa = {
    n: 2,
    titulo: "Documentação da empresa",
    descricao: "Documentos básicos usados para o cadastro e atualização no SICAF.",
    status: docsBaseEnviados >= 4 ? "ok" : docsBaseEnviados > 0 ? "atencao" : "pendente",
    detalhe:
      docsBaseEnviados >= 4
        ? `${docsBaseEnviados} documentos da empresa já enviados.`
        : docsBaseEnviados > 0
          ? `Apenas ${docsBaseEnviados} documento(s) enviado(s) — envie os demais para liberar o cadastro.`
          : "Nenhum documento da empresa enviado ainda.",
  };

  const etapaAssistente: DiagnosticoEtapa = {
    n: 3,
    titulo: "Conectar ao Compras.gov.br",
    descricao: "O Assistente CADBRASIL lê a Situação do Fornecedor e sincroniza seus níveis.",
    status: niveisSincronizados > 0 ? "ok" : "pendente",
    detalhe:
      niveisSincronizados > 0
        ? `${niveisSincronizados} de 6 níveis já sincronizados pelo Assistente.`
        : "Nenhum nível sincronizado — envie a Situação do Fornecedor no Assistente.",
  };

  const nivel3 = niveis.find((n) => n.num === 3)!;
  const etapaNivel3: DiagnosticoEtapa = {
    n: 4,
    titulo: "Nível III — Regularidade Fiscal Federal",
    descricao: "CND Federal, FGTS e débitos trabalhistas (CNDT).",
    status: etapaStatusFromNivel(nivel3.status),
    detalhe: detalheNivel(
      nivel3.status,
      nivel3.docsFaltando,
      empresa.detalhesNiveis?.[3]?.vencimento,
    ),
  };

  const nivel4 = niveis.find((n) => n.num === 4)!;
  const etapaNivel4: DiagnosticoEtapa = {
    n: 5,
    titulo: "Nível IV — Regularidade Fiscal Estadual/Municipal",
    descricao: "Certidões estaduais e municipais da sede da empresa.",
    status: etapaStatusFromNivel(nivel4.status),
    detalhe: detalheNivel(
      nivel4.status,
      nivel4.docsFaltando,
      empresa.detalhesNiveis?.[4]?.vencimento,
    ),
  };

  const etapaFinal: DiagnosticoEtapa = {
    n: 6,
    titulo: "Validação final",
    descricao: "Conferência dos 6 níveis — empresa pronta para licitar.",
    status:
      niveisValidados === NIVEIS_SICAF.length
        ? "ok"
        : niveisValidados > 0
          ? "atencao"
          : "pendente",
    detalhe:
      niveisValidados === NIVEIS_SICAF.length
        ? "Todos os níveis validados — sua empresa está apta a licitar."
        : `${niveisValidados} de ${NIVEIS_SICAF.length} níveis validados${
            docsFaltando.length
              ? ` · ${docsFaltando.length} documento(s) pendente(s) no total`
              : ""
          }.`,
  };

  const etapas = [
    etapaTaxa,
    etapaDocumentos,
    etapaAssistente,
    etapaNivel3,
    etapaNivel4,
    etapaFinal,
  ];

  const pesoTaxa = taxaPaga ? 20 : 0;
  const pesoDocs = docsTotal ? Math.round((docsOk / docsTotal) * 40) : 0;
  const pesoNiveis = Math.round((niveisValidados / NIVEIS_SICAF.length) * 40);
  const score = Math.max(0, Math.min(100, pesoTaxa + pesoDocs + pesoNiveis));

  return {
    empresa,
    taxaPaga,
    sicafStatus,
    etapas,
    niveis,
    docsFaltando,
    docsTotal,
    docsOk,
    niveisValidados,
    score,
    proximaEtapa: etapas.find((e) => e.status !== "ok") ?? null,
    pendenciasPainel: painel?.pendencias || [],
  };
}
