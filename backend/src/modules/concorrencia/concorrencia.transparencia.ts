import type { ConcorrenciaBuscaResult, ConcorrenciaContrato } from "@/modules/concorrencia/concorrencia.types";
import {
  formatCnpjMasked,
  parseBrDateToIso,
  toIsoDate,
  toNumber,
  withPercentuais,
} from "@/modules/concorrencia/concorrencia.utils";
import type { TransparenciaContrato } from "@/modules/concorrencia/transparencia-api.client";

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

function pickValor(row: TransparenciaContrato): number {
  return toNumber(row.valorFinalCompra ?? row.valorInicialCompra ?? row.valorContratado);
}

function getUnidade(row: TransparenciaContrato) {
  return row.unidadeGestora || row.unidadeGestoraCompras;
}

export function mapTransparenciaContrato(row: TransparenciaContrato): ConcorrenciaContrato {
  const unidade = getUnidade(row);
  const orgao =
    unidade?.nome?.trim() ||
    unidade?.orgaoVinculado?.nome?.trim() ||
    null;

  const id = row.id ?? hashId(JSON.stringify(row));

  return {
    id: Number(id) || hashId(String(id)),
    numeroContrato: row.numero?.trim() || row.numeroContrato?.trim() || null,
    numeroControlePncp: null,
    orgao,
    objeto: row.objeto?.trim() || row.compra?.objeto?.trim() || null,
    modalidade: row.modalidadeCompra?.trim() || "Sem informação",
    tipo: null,
    situacao: row.situacaoContrato?.trim() || null,
    valor: pickValor(row),
    dataAssinatura: toIsoDate(row.dataAssinatura) || parseBrDateToIso(row.dataAssinatura),
    dataPublicacao: toIsoDate(row.dataPublicacaoDOU) || parseBrDateToIso(row.dataPublicacaoDOU),
    dataInicioVigencia:
      toIsoDate(row.dataInicioVigencia) || parseBrDateToIso(row.dataInicioVigencia),
    dataFimVigencia: toIsoDate(row.dataFimVigencia) || parseBrDateToIso(row.dataFimVigencia),
    urlPncp: row.id
      ? `https://portaldatransparencia.gov.br/contratos/${row.id}`
      : null,
  };
}

export function buildResultFromTransparencia(
  cnpjDigits: string,
  rows: TransparenciaContrato[],
  empresa: ConcorrenciaBuscaResult["empresa"],
): ConcorrenciaBuscaResult {
  const contratos = rows.map(mapTransparenciaContrato);
  const totalContratos = contratos.length;
  const valorTotal = contratos.reduce((sum, c) => sum + c.valor, 0);
  const valorMedio = totalContratos > 0 ? valorTotal / totalContratos : 0;

  const orgaosMap = new Map<string, { quantidade: number; valor: number }>();
  const modalidadesMap = new Map<string, { quantidade: number; valor: number }>();
  const ministeriosMap = new Map<string, { quantidade: number; valor: number }>();
  const orgaosDistintos = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const contrato = contratos[i];
    const valor = contrato.valor;
    const unidade = getUnidade(row);

    const orgaoNome =
      unidade?.nome?.trim() ||
      unidade?.orgaoVinculado?.nome?.trim() ||
      "Não informado";
    orgaosDistintos.add(orgaoNome);
    const orgaoBucket = orgaosMap.get(orgaoNome) || { quantidade: 0, valor: 0 };
    orgaoBucket.quantidade += 1;
    orgaoBucket.valor += valor;
    orgaosMap.set(orgaoNome, orgaoBucket);

    const modalidade = row.modalidadeCompra?.trim() || "Sem informação";
    const modalidadeBucket = modalidadesMap.get(modalidade) || { quantidade: 0, valor: 0 };
    modalidadeBucket.quantidade += 1;
    modalidadeBucket.valor += valor;
    modalidadesMap.set(modalidade, modalidadeBucket);

    const ministerio =
      unidade?.orgaoMaximo?.nome?.trim() ||
      unidade?.orgaoVinculado?.nome?.trim() ||
      "Não informado";
    const ministerioBucket = ministeriosMap.get(ministerio) || { quantidade: 0, valor: 0 };
    ministerioBucket.quantidade += 1;
    ministerioBucket.valor += valor;
    ministeriosMap.set(ministerio, ministerioBucket);
  }

  const fornecedorNome =
    rows[0]?.fornecedor?.razaoSocialReceita?.trim() ||
    rows[0]?.fornecedor?.nome?.trim();

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
      razaoSocial: fornecedorNome || empresa.razaoSocial,
      fonteDados: "Portal da Transparência — consulta ao vivo",
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
