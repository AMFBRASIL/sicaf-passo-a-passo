import type { ConcorrenciaBuscaResult, ConcorrenciaContrato } from "@/modules/concorrencia/concorrencia.types";
import {
  buildPncpContratoUrl,
  formatCnpjMasked,
  toIsoDate,
  toNumber,
  withPercentuais,
} from "@/modules/concorrencia/concorrencia.utils";
import type { PncpSearchContratoItem } from "@/modules/concorrencia/pncp-api.client";

function groupBy<T extends { quantidade: number; valor: number; nome: string }>(
  items: T[],
  limit = 12,
): T[] {
  return items.sort((a, b) => b.quantidade - a.quantidade || b.valor - a.valor).slice(0, limit);
}

function hashId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function mapPncpSearchItemToContrato(item: PncpSearchContratoItem): ConcorrenciaContrato {
  const numeroControle = item.numero_controle_pncp || null;
  const orgao =
    item.unidade_nome?.trim() ||
    item.orgao_nome?.trim() ||
    null;

  return {
    id: hashId(numeroControle || item.id),
    numeroContrato: item.title?.replace(/^Contrato nº\s*/i, "").trim() || null,
    numeroControlePncp: numeroControle,
    orgao,
    objeto: item.description?.trim() || null,
    modalidade: item.modalidade_licitacao_nome?.trim() || "Sem informação",
    tipo: item.tipo_contrato_nome?.trim() || item.tipo_nome?.trim() || null,
    situacao: item.situacao_nome?.trim() || null,
    valor: toNumber(item.valor_global),
    dataAssinatura: toIsoDate(item.data_assinatura),
    dataPublicacao: toIsoDate(item.data_publicacao_pncp),
    dataInicioVigencia: toIsoDate(item.data_inicio_vigencia),
    dataFimVigencia: toIsoDate(item.data_fim_vigencia),
    urlPncp:
      item.item_url && item.item_url.startsWith("/")
        ? `https://pncp.gov.br/app${item.item_url}`
        : buildPncpContratoUrl(numeroControle),
  };
}

export function buildResultFromPncpSearch(
  cnpjDigits: string,
  items: PncpSearchContratoItem[],
  empresa: ConcorrenciaBuscaResult["empresa"],
): ConcorrenciaBuscaResult {
  const contratos = items.map(mapPncpSearchItemToContrato);
  const totalContratos = contratos.length;
  const valorTotal = contratos.reduce((sum, c) => sum + c.valor, 0);
  const valorMedio = totalContratos > 0 ? valorTotal / totalContratos : 0;

  const orgaosMap = new Map<string, { quantidade: number; valor: number }>();
  const modalidadesMap = new Map<string, { quantidade: number; valor: number }>();
  const ministeriosMap = new Map<string, { quantidade: number; valor: number }>();
  const orgaosDistintos = new Set<string>();

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const contrato = contratos[i];
    const valor = contrato.valor;

    const orgaoNome =
      item.unidade_nome?.trim() ||
      item.orgao_nome?.trim() ||
      "Não informado";
    orgaosDistintos.add(orgaoNome);
    const orgaoBucket = orgaosMap.get(orgaoNome) || { quantidade: 0, valor: 0 };
    orgaoBucket.quantidade += 1;
    orgaoBucket.valor += valor;
    orgaosMap.set(orgaoNome, orgaoBucket);

    const modalidade = item.modalidade_licitacao_nome?.trim() || "Sem informação";
    const modalidadeBucket = modalidadesMap.get(modalidade) || { quantidade: 0, valor: 0 };
    modalidadeBucket.quantidade += 1;
    modalidadeBucket.valor += valor;
    modalidadesMap.set(modalidade, modalidadeBucket);

    const ministerio =
      item.orgao_nome?.trim() ||
      [item.esfera_nome, item.poder_nome].filter(Boolean).join(" / ") ||
      "Não informado";
    const ministerioBucket = ministeriosMap.get(ministerio) || { quantidade: 0, valor: 0 };
    ministerioBucket.quantidade += 1;
    ministerioBucket.valor += valor;
    ministeriosMap.set(ministerio, ministerioBucket);
  }

  const toGrupos = (map: Map<string, { quantidade: number; valor: number }>) =>
    groupBy(
      [...map.entries()].map(([nome, stats]) => ({
        nome,
        quantidade: stats.quantidade,
        valor: stats.valor,
      })),
    );

  return {
    empresa: {
      ...empresa,
      cnpj: formatCnpjMasked(cnpjDigits),
      fonteDados: "PNCP — consulta ao vivo",
    },
    kpis: {
      totalContratos,
      valorTotal,
      valorMedio,
      totalOrgaos: orgaosDistintos.size,
    },
    orgaos: withPercentuais(toGrupos(orgaosMap), totalContratos),
    modalidades: withPercentuais(toGrupos(modalidadesMap), totalContratos),
    ministerios: withPercentuais(toGrupos(ministeriosMap), totalContratos),
    contratos,
    totalContratos,
  };
}
