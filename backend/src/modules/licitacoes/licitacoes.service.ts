import { notFound } from "@/lib/http/errors";
import {
  licitacoesRepository,
  type LicitacaoRow,
  type ListFilters,
} from "@/modules/licitacoes/licitacoes.repository";
import { deadlineInfo } from "@/modules/licitacoes/licitacoes.utils";

function mapMiraMeta(row: {
  id: number;
  pipeline_status: string;
  notas: string | null;
  cliente_id: number | null;
  alertas_ativos: number;
  updated_at: Date | string | null;
}) {
  return {
    miraId: row.id,
    pipelineStatus: row.pipeline_status || "na_mira",
    notas: row.notas || "",
    clienteId: row.cliente_id || null,
    alertasAtivos: row.alertas_ativos !== 0,
    updatedAt: row.updated_at,
  };
}

function mapListItem(row: LicitacaoRow, miraMeta: ReturnType<typeof mapMiraMeta> | null) {
  return {
    id: row.id,
    numero_processo: row.numero_processo,
    numero_controle_pncp: row.numero_controle_pncp,
    origem: row.origem,
    lei: row.lei,
    modalidade: row.modalidade,
    modo_disputa: row.modo_disputa,
    tipo: row.tipo,
    criterio_julgamento: row.criterio_julgamento,
    orgao_id: row.orgao_id,
    uasg_id: row.uasg_id,
    codigo_orgao: row.codigo_orgao,
    nome_orgao: row.nome_orgao,
    codigo_uasg: row.codigo_uasg,
    nome_uasg: row.nome_uasg,
    uf: row.uf,
    municipio: row.municipio,
    esfera: row.esfera,
    objeto: row.objeto,
    objeto_resumido: row.objeto_resumido,
    data_publicacao: row.data_publicacao,
    data_abertura: row.data_abertura,
    data_encerramento: row.data_encerramento,
    data_homologacao: row.data_homologacao,
    valor_estimado: row.valor_estimado,
    valor_homologado: row.valor_homologado,
    status: row.status,
    situacao: row.situacao,
    srp: row.srp,
    link_edital: row.link_edital,
    link_portal: row.link_portal,
    na_mira: !!miraMeta,
    mira_meta: miraMeta,
    prazo: deadlineInfo(row),
  };
}

export class LicitacoesService {
  async getHomeKpis(usuarioId: number) {
    return licitacoesRepository.getHomeKpis(usuarioId);
  }

  async getStatsForUser(usuarioId: number) {
    const [stats, kpis] = await Promise.all([
      licitacoesRepository.getStats(),
      licitacoesRepository.getPersonalKpisFull(usuarioId),
    ]);
    return { stats, kpis };
  }

  async getFilterOptions() {
    const [status, modalidades, esferas, ufs, leis, modos_disputa, criterios_julgamento, origens] =
      await Promise.all([
        licitacoesRepository.distinctTop("status"),
        licitacoesRepository.distinctTop("modalidade"),
        licitacoesRepository.distinctTop("esfera"),
        licitacoesRepository.distinctTop("uf", 30),
        licitacoesRepository.distinctTop("lei"),
        licitacoesRepository.distinctTop("modo_disputa"),
        licitacoesRepository.distinctTop("criterio_julgamento"),
        licitacoesRepository.distinctTop("origem", 10),
      ]);

    return {
      status,
      modalidades,
      esferas,
      ufs,
      leis,
      modos_disputa,
      criterios_julgamento,
      origens,
    };
  }

  async list(filters: ListFilters, page: number) {
    const [total, rows, miraMap] = await Promise.all([
      licitacoesRepository.countList(filters),
      licitacoesRepository.list(filters),
      licitacoesRepository.getMiraMetaMap(filters.usuarioId),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / filters.limit));
    const licitacoes = rows.map((r) => {
      const meta = miraMap.get(r.id);
      return mapListItem(r, meta ? mapMiraMeta(meta) : null);
    });

    return {
      total,
      page,
      limit: filters.limit,
      total_pages: totalPages,
      order_by: filters.orderBy,
      order_dir: filters.orderDir,
      licitacoes,
    };
  }

  async getDetail(id: number, usuarioId: number) {
    const row = await licitacoesRepository.findById(id);
    if (!row) throw notFound("Licitação não encontrada");

    const miraMap = await licitacoesRepository.getMiraMetaMap(usuarioId);
    const meta = miraMap.get(id);

    return {
      licitacao: row,
      prazo: deadlineInfo(row),
      mira: meta
        ? {
            na_mira: true,
            pipelineStatus: meta.pipeline_status,
            notas: meta.notas,
            clienteId: meta.cliente_id,
            alertasAtivos: meta.alertas_ativos !== 0,
          }
        : null,
    };
  }

  async toggleMira(usuarioId: number, licitacaoId: number) {
    const row = await licitacoesRepository.findById(licitacaoId);
    if (!row) throw notFound("Licitação não encontrada");
    const result = await licitacoesRepository.toggleMira(usuarioId, licitacaoId);
    return {
      na_mira: result.na_mira,
      message: result.na_mira
        ? "Licitação adicionada à sua mira"
        : "Licitação removida da sua mira",
      pipelineStatus: result.na_mira ? "na_mira" : undefined,
    };
  }

  async getMiraIds(usuarioId: number) {
    const ids = await licitacoesRepository.getMiraIds(usuarioId);
    return { ids, total: ids.length };
  }
}

export const licitacoesService = new LicitacoesService();
