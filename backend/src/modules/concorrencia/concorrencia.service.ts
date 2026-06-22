import { AppError } from "@/lib/http/errors";
import { getSicafAgentModule } from "@/modules/sicaf-assistant/legacy-bridge";
import { buildResultFromPncpSearch } from "@/modules/concorrencia/concorrencia.pncp";
import { buildResultFromTransparencia } from "@/modules/concorrencia/concorrencia.transparencia";
import { concorrenciaRepository } from "@/modules/concorrencia/concorrencia.repository";
import type { ConcorrenciaBuscaResult, ConcorrenciaEmpresa } from "@/modules/concorrencia/concorrencia.types";
import {
  buildPncpContratoUrl,
  buildPortalTransparenciaContratosUrl,
  buildPortalTransparenciaUrl,
  formatCnpjMasked,
  isValidCnpjDigits,
  normalizeCnpjDigits,
  toIsoDate,
  toNumber,
  withPercentuais,
} from "@/modules/concorrencia/concorrencia.utils";
import { searchContratosPorCnpj } from "@/modules/concorrencia/pncp-api.client";
import {
  isTransparenciaApiConfigured,
  searchContratosPorFornecedor,
} from "@/modules/concorrencia/transparencia-api.client";

type CnpjWs = {
  consultCnpjWs: (cnpj: string) => Promise<{
    success: boolean;
    data?: {
      razaoSocial?: string;
      nomeFantasia?: string;
      cidade?: string;
      estado?: string;
    };
    error?: string;
  }>;
};

export class ConcorrenciaService {
  async buscarPorCnpj(cnpjInput: string): Promise<ConcorrenciaBuscaResult> {
    const cnpj = normalizeCnpjDigits(cnpjInput);
    if (!isValidCnpjDigits(cnpj)) {
      throw new AppError("CNPJ inválido. Informe 14 dígitos.", 400, "VALIDATION_ERROR");
    }

    const empresaBase = await this.resolveEmpresa(cnpj);

    if (isTransparenciaApiConfigured()) {
      try {
        const contratos = await searchContratosPorFornecedor(cnpj);
        if (contratos.length > 0) {
          return buildResultFromTransparencia(cnpj, contratos, empresaBase);
        }
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 503) throw error;
        console.warn("[concorrencia] Portal da Transparência indisponível:", error);
      }
    }

    try {
      const searchItems = await searchContratosPorCnpj(cnpj, formatCnpjMasked(cnpj));
      if (searchItems.length > 0) {
        return buildResultFromPncpSearch(cnpj, searchItems, {
          ...empresaBase,
          fonteDados: "PNCP — consulta ao vivo",
        });
      }
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 503) throw error;
      console.warn("[concorrencia] PNCP search indisponível:", error);
    }

    const local = await this.buscarNaBaseLocal(cnpj, empresaBase);
    if (local) return local;

    if (!isTransparenciaApiConfigured()) {
      throw new AppError(
        "Nenhum contrato encontrado. Configure PORTAL_TRANSPARENCIA_API_KEY no servidor para consultar o Portal da Transparência (contratos federais por CNPJ do fornecedor).",
        404,
        "NOT_FOUND",
      );
    }

    throw new AppError(
      "Nenhum contrato público federal encontrado para este CNPJ no Portal da Transparência e no PNCP.",
      404,
      "NOT_FOUND",
    );
  }

  private async resolveEmpresa(cnpj: string): Promise<ConcorrenciaEmpresa> {
    const [fornecedor, nomeContrato] = await Promise.all([
      concorrenciaRepository.findFornecedorByCnpj(cnpj),
      concorrenciaRepository.getEmpresaNomeFromContratos(cnpj),
    ]);

    let razaoSocial =
      fornecedor?.razao_social ||
      nomeContrato ||
      `Empresa ${formatCnpjMasked(cnpj)}`;
    let nomeFantasia = fornecedor?.nome_fantasia || null;
    let uf = fornecedor?.uf || null;
    let municipio = fornecedor?.municipio || null;

    try {
      const cnpjWs = await getSicafAgentModule<CnpjWs>("clients/cnpj-ws");
      const receita = await cnpjWs.consultCnpjWs(cnpj);
      if (receita.success && receita.data?.razaoSocial) {
        razaoSocial = receita.data.razaoSocial;
        nomeFantasia = receita.data.nomeFantasia || nomeFantasia;
        uf = receita.data.estado || uf;
        municipio = receita.data.cidade || municipio;
      }
    } catch {
      // mantém nome derivado de fornecedor/local
    }

    return {
      cnpj: formatCnpjMasked(cnpj),
      razaoSocial,
      nomeFantasia,
      uf,
      municipio,
      fonteDados: "Portal da Transparência — consulta ao vivo",
    };
  }

  private async buscarNaBaseLocal(
    cnpj: string,
    empresaBase: ConcorrenciaEmpresa,
  ): Promise<ConcorrenciaBuscaResult | null> {
    const [kpisRow, orgaosRows, modalidadesRows, ministeriosRows, contratosRows] =
      await Promise.all([
        concorrenciaRepository.getKpis(cnpj),
        concorrenciaRepository.getOrgaos(cnpj),
        concorrenciaRepository.getModalidades(cnpj),
        concorrenciaRepository.getMinisterios(cnpj),
        concorrenciaRepository.listContratos(cnpj),
      ]);

    const totalContratos = Number(kpisRow?.total_contratos ?? 0);
    if (totalContratos === 0) return null;

    const valorTotal = toNumber(kpisRow?.valor_total);
    const valorMedio = totalContratos > 0 ? valorTotal / totalContratos : 0;

    return {
      empresa: {
        ...empresaBase,
        fonteDados: "PNCP / Base CADBRASIL (cache local)",
      },
      kpis: {
        totalContratos,
        valorTotal,
        valorMedio,
        totalOrgaos: Number(kpisRow?.total_orgaos ?? 0),
      },
      orgaos: withPercentuais(
        orgaosRows.map((row) => ({
          nome: row.nome,
          quantidade: Number(row.quantidade),
          valor: toNumber(row.valor),
        })),
        totalContratos,
      ),
      modalidades: withPercentuais(
        modalidadesRows.map((row) => ({
          nome: row.nome,
          quantidade: Number(row.quantidade),
          valor: toNumber(row.valor),
        })),
        totalContratos,
      ),
      ministerios: withPercentuais(
        ministeriosRows.map((row) => ({
          nome: row.nome,
          quantidade: Number(row.quantidade),
          valor: toNumber(row.valor),
        })),
        totalContratos,
      ),
      contratos: contratosRows.map((row) => {
        let numeroControle: string | null = null;
        try {
          if (row.dados_originais) {
            const payload = JSON.parse(row.dados_originais) as { numeroControlePNCP?: string };
            numeroControle = payload.numeroControlePNCP || null;
          }
        } catch {
          numeroControle = null;
        }

        return {
          id: row.id,
          numeroContrato: row.numero_contrato,
          numeroControlePncp: numeroControle,
          orgao: row.nome_orgao,
          objeto: row.objeto,
          modalidade:
            row.modalidade_licitacao || row.tipo || row.categoria || "Sem informação",
          tipo: row.tipo,
          situacao: row.situacao,
          valor: toNumber(row.valor_global),
          dataAssinatura: toIsoDate(row.data_assinatura),
          dataPublicacao: toIsoDate(row.data_publicacao),
          dataInicioVigencia: toIsoDate(row.data_inicio_vigencia),
          dataFimVigencia: toIsoDate(row.data_fim_vigencia),
          urlPncp: buildPncpContratoUrl(numeroControle, row.dados_originais),
        };
      }),
      totalContratos,
    };
  }

  getLinksExternos(cnpjInput: string) {
    const cnpj = normalizeCnpjDigits(cnpjInput);
    return {
      portalTransparencia: buildPortalTransparenciaContratosUrl(cnpj),
      pessoaJuridica: buildPortalTransparenciaUrl(cnpj),
    };
  }
}

export const concorrenciaService = new ConcorrenciaService();
