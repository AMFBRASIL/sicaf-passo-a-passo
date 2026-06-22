import type { RowDataPacket } from "mysql2/promise";
import { getWritePool } from "@/lib/db/mysql";
import { queryOne, queryRows } from "@/lib/db/query";

const CNPJ_CONTRATADO_NORM =
  "REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(c.cnpj_contratado, ''), '.', ''), '/', ''), '-', ''), ' ', '')";
const CNPJ_FORNECEDOR_NORM =
  "REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(f.cnpj_cpf, ''), '.', ''), '/', ''), '-', ''), ' ', '')";

type ContratoRow = RowDataPacket & {
  id: number;
  numero_contrato: string | null;
  nome_orgao: string | null;
  objeto: string | null;
  modalidade_licitacao: string | null;
  tipo: string | null;
  categoria: string | null;
  situacao: string | null;
  valor_global: number | string | null;
  data_assinatura: Date | string | null;
  data_publicacao: Date | string | null;
  data_inicio_vigencia: Date | string | null;
  data_fim_vigencia: Date | string | null;
  nome_contratado: string | null;
  dados_originais: string | null;
};

type GrupoRow = RowDataPacket & {
  nome: string;
  quantidade: number;
  valor: number | string;
};

type KpiRow = RowDataPacket & {
  total_contratos: number;
  valor_total: number | string;
  total_orgaos: number;
};

type FornecedorRow = RowDataPacket & {
  cnpj_cpf: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  uf: string | null;
  municipio: string | null;
};

function buildWhereSql(alias = "c"): string {
  const cnpjNorm = CNPJ_CONTRATADO_NORM.replaceAll("c.", `${alias}.`);
  return `(
    ${cnpjNorm} = :cnpj
    OR EXISTS (
      SELECT 1 FROM fornecedores f
      WHERE f.id = ${alias}.fornecedor_id
        AND ${CNPJ_FORNECEDOR_NORM} = :cnpj
    )
  )`;
}

export class ConcorrenciaRepository {
  async findFornecedorByCnpj(cnpj: string): Promise<FornecedorRow | null> {
    const pool = getWritePool();
    return queryOne<FornecedorRow>(
      pool,
      `SELECT cnpj_cpf, razao_social, nome_fantasia, uf, municipio
       FROM fornecedores f
       WHERE ${CNPJ_FORNECEDOR_NORM} = :cnpj
       LIMIT 1`,
      { cnpj },
    );
  }

  async getKpis(cnpj: string): Promise<KpiRow | null> {
    const pool = getWritePool();
    return queryOne<KpiRow>(
      pool,
      `SELECT
         COUNT(*) AS total_contratos,
         COALESCE(SUM(COALESCE(c.valor_global, c.valor_inicial, 0)), 0) AS valor_total,
         COUNT(DISTINCT NULLIF(TRIM(c.nome_orgao), '')) AS total_orgaos
       FROM contratos c
       WHERE ${buildWhereSql("c")}`,
      { cnpj },
    );
  }

  async getOrgaos(cnpj: string, limit = 12): Promise<GrupoRow[]> {
    const pool = getWritePool();
    return queryRows<GrupoRow>(
      pool,
      `SELECT
         COALESCE(
           NULLIF(TRIM(c.nome_orgao), ''),
           NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.dados_originais, '$.orgaoEntidade.razaoSocial'))), ''),
           'Não informado'
         ) AS nome,
         COUNT(*) AS quantidade,
         COALESCE(SUM(COALESCE(c.valor_global, c.valor_inicial, 0)), 0) AS valor
       FROM contratos c
       WHERE ${buildWhereSql("c")}
       GROUP BY nome
       ORDER BY quantidade DESC, valor DESC
       LIMIT ${Math.max(1, Math.min(limit, 30))}`,
      { cnpj },
    );
  }

  async getModalidades(cnpj: string, limit = 12): Promise<GrupoRow[]> {
    const pool = getWritePool();
    return queryRows<GrupoRow>(
      pool,
      `SELECT
         COALESCE(
           NULLIF(TRIM(c.modalidade_licitacao), ''),
           NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.dados_originais, '$.tipoContrato.nome'))), ''),
           NULLIF(TRIM(c.tipo), ''),
           NULLIF(TRIM(c.categoria), ''),
           'Sem informação'
         ) AS nome,
         COUNT(*) AS quantidade,
         COALESCE(SUM(COALESCE(c.valor_global, c.valor_inicial, 0)), 0) AS valor
       FROM contratos c
       WHERE ${buildWhereSql("c")}
       GROUP BY nome
       ORDER BY quantidade DESC, valor DESC
       LIMIT ${Math.max(1, Math.min(limit, 30))}`,
      { cnpj },
    );
  }

  async getMinisterios(cnpj: string, limit = 12): Promise<GrupoRow[]> {
    const pool = getWritePool();
    return queryRows<GrupoRow>(
      pool,
      `SELECT
         COALESCE(
           NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.dados_originais, '$.usuarioNome'))), ''),
           NULLIF(TRIM(c.nome_orgao), ''),
           'Não informado'
         ) AS nome,
         COUNT(*) AS quantidade,
         COALESCE(SUM(COALESCE(c.valor_global, c.valor_inicial, 0)), 0) AS valor
       FROM contratos c
       WHERE ${buildWhereSql("c")}
       GROUP BY nome
       ORDER BY quantidade DESC, valor DESC
       LIMIT ${Math.max(1, Math.min(limit, 30))}`,
      { cnpj },
    );
  }

  async listContratos(cnpj: string, limit = 50): Promise<ContratoRow[]> {
    const pool = getWritePool();
    return queryRows<ContratoRow>(
      pool,
      `SELECT
         c.id,
         c.numero_contrato,
         c.nome_orgao,
         c.objeto,
         c.modalidade_licitacao,
         c.tipo,
         c.categoria,
         c.situacao,
         c.valor_global,
         c.data_assinatura,
         c.data_publicacao,
         c.data_inicio_vigencia,
         c.data_fim_vigencia,
         c.nome_contratado,
         c.dados_originais
       FROM contratos c
       WHERE ${buildWhereSql("c")}
       ORDER BY COALESCE(c.data_assinatura, c.data_publicacao, c.created_at) DESC
       LIMIT ${Math.max(1, Math.min(limit, 100))}`,
      { cnpj },
    );
  }

  async getEmpresaNomeFromContratos(cnpj: string): Promise<string | null> {
    const pool = getWritePool();
    const row = await queryOne<RowDataPacket & { nome: string | null }>(
      pool,
      `SELECT
         COALESCE(
           NULLIF(TRIM(c.nome_contratado), ''),
           NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.dados_originais, '$.nomeRazaoSocialFornecedor'))), '')
         ) AS nome
       FROM contratos c
       WHERE ${buildWhereSql("c")}
       LIMIT 1`,
      { cnpj },
    );
    return row?.nome || null;
  }
}

export const concorrenciaRepository = new ConcorrenciaRepository();
