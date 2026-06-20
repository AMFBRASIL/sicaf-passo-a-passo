/**
 * Consulta CNPJ e cliente por documento — banco legado (cadbrasilsys).
 */
const { getDb } = require("../database/connection");
const { consultCnpjWs } = require("./cnpj-ws");
const {
  resolveSicafDisplayStatus,
  isSicafDisplayValid,
  calcDaysRemaining,
} = require("../utils/sicaf-status");

const URL_CADASTRO_CADBRASIL =
  process.env.CADASTRO_PORTAL_URL || "https://cadastro.cadbrasil.com.br";

async function buildRespostaCnpjNaoCadastrado(cnpjDigits) {
  const receita = await consultCnpjWs(cnpjDigits);

  const base = {
    ok: true,
    cnpj: cnpjDigits,
    possuiCadastro: false,
    cadastroConcluido: false,
    cadastroValido: false,
    sicafValido: false,
    possuiRenovacao: false,
    possuiManutencao: false,
    razaoSocial: null,
    cliente: null,
    sicaf: null,
    renovacao: null,
    manutencao: null,
    urlCadastro: URL_CADASTRO_CADBRASIL,
    podeConcluirCadastro: true,
  };

  if (receita.success && receita.data) {
    const d = receita.data;
    const razao = d.razaoSocial || null;
    const situacao = d.situacao || null;

    return {
      ...base,
      razaoSocial: razao,
      encontradoNaReceitaFederal: true,
      situacaoReceitaFederal: situacao,
      receitaFederal: {
        cnpj: d.cnpj || cnpjDigits,
        razaoSocial: razao,
        nomeFantasia: d.nomeFantasia || null,
        situacaoCadastral: situacao,
        atividadePrincipal: d.atividadePrincipal || null,
        email: d.email || null,
        telefone: d.telefone || null,
        logradouro: d.logradouro || null,
        numero: d.numero || null,
        complemento: d.complemento || null,
        bairro: d.bairro || null,
        cidade: d.cidade || null,
        estado: d.estado || null,
        cep: d.cep || null,
        porte: d.porte || null,
        naturezaJuridica: d.naturezaJuridica || null,
      },
      message:
        "CNPJ localizado na Receita Federal, porém o cadastro na CADBRASIL ainda não foi concluído.",
      orientacaoUsuario: `Para concluir o cadastro e dar sequência ao processo, acesse: ${URL_CADASTRO_CADBRASIL}`,
      orientacaoIA: [
        `O CNPJ ${cnpjDigits} corresponde a ${razao || "empresa identificada na Receita Federal"}`,
        situacao ? `(situação cadastral: ${situacao})` : "",
        "mas NÃO possui cadastro concluído na plataforma CADBRASIL.",
        `Informe ao cliente que ele pode finalizar o cadastro em ${URL_CADASTRO_CADBRASIL} para continuar o processo SICAF.`,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    ...base,
    encontradoNaReceitaFederal: false,
    receitaFederal: null,
    message: "CNPJ não encontrado na base de clientes CADBRASIL.",
    orientacaoUsuario: `Caso a empresa ainda não tenha se cadastrado, acesse ${URL_CADASTRO_CADBRASIL} para concluir o cadastro.`,
    orientacaoIA: [
      `O CNPJ ${cnpjDigits} não foi encontrado na base CADBRASIL.`,
      receita.error ? `Consulta à Receita Federal: ${receita.error}.` : "Não foi possível confirmar os dados na Receita Federal.",
      `Oriente o cliente a verificar o número informado ou concluir o cadastro em ${URL_CADASTRO_CADBRASIL}.`,
    ].join(" "),
    erroReceitaFederal: receita.error || null,
  };
}

async function consultClientByCnpj(cnpj) {
  const db = getDb();
  if (!db) return { ok: false, error: "Banco de dados não disponível" };

  const cnpjDigits = String(cnpj || "").replace(/\D/g, "");
  if (cnpjDigits.length !== 14) {
    return { ok: false, error: "CNPJ inválido. Informe 14 dígitos." };
  }

  try {
    const row = await db("clientes as c")
      .leftJoin("sicaf_cadastros as s", "c.id", "s.cliente_id")
      .whereRaw(
        "REPLACE(REPLACE(REPLACE(c.documento, '.', ''), '/', ''), '-', '') = ?",
        [cnpjDigits],
      )
      .select(
        "c.*",
        "s.id as sicaf_id",
        "s.status as sicaf_status",
        "s.data_validade as sicaf_data_validade",
        "s.dias_validade as sicaf_dias_validade",
        "s.manutencao_ativa as sicaf_manutencao_ativa",
        "s.completude as sicaf_completude",
      )
      .orderBy("c.id", "desc")
      .first();

    if (!row) {
      return buildRespostaCnpjNaoCadastrado(cnpjDigits);
    }

    let ultimaRenovacao = null;
    if (row.sicaf_id) {
      ultimaRenovacao = await db("sicaf_renovacoes")
        .where("sicaf_id", row.sicaf_id)
        .where("cliente_id", row.id)
        .orderBy("id", "desc")
        .first();
    }

    const manutencaoAtual = await db("manutencoes")
      .where("cliente_id", row.id)
      .orderBy("created_at", "desc")
      .first();

    const sicafValido =
      !!row.sicaf_id &&
      isSicafDisplayValid(row.sicaf_status, row.sicaf_data_validade, true);
    const renovacaoStatus = String(ultimaRenovacao?.status || "").toLowerCase();
    const possuiRenovacao =
      !!ultimaRenovacao &&
      ["concluida", "concluída", "aprovada", "paga", "confirmada"].includes(
        renovacaoStatus,
      );
    const cadastroValido = sicafValido || possuiRenovacao;

    const manutStatus = String(manutencaoAtual?.status || "").toLowerCase();
    const manutencaoAtivaPorStatus = ["ativo", "a vencer", "vencendo"].includes(
      manutStatus,
    );
    const possuiManutencao =
      row.sicaf_manutencao_ativa === 1 ||
      row.sicaf_manutencao_ativa === true ||
      manutencaoAtivaPorStatus;

    return {
      ok: true,
      cnpj: cnpjDigits,
      possuiCadastro: true,
      cadastroConcluido: true,
      cadastroValido,
      sicafValido,
      possuiRenovacao,
      possuiManutencao,
      razaoSocial: row.razao_social || null,
      cliente: {
        id: row.id,
        razaoSocial: row.razao_social || null,
        nomeFantasia: row.nome_fantasia || null,
        tipoDocumento: row.tipo_documento || null,
        documento: row.documento || null,
        email: row.email || null,
        telefone: row.telefone || null,
        celular: row.celular || null,
        endereco: row.endereco || null,
        cidade: row.cidade || null,
        estado: row.estado || null,
        cep: row.cep || null,
        porte: row.porte || null,
        ramoAtividade: row.ramo_atividade || null,
        status: row.status || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      },
      sicaf: row.sicaf_id
        ? {
            id: row.sicaf_id,
            status: resolveSicafDisplayStatus(
              row.sicaf_status,
              row.sicaf_data_validade,
              true,
            ),
            valido: sicafValido,
            dataValidade: row.sicaf_data_validade || null,
            diasValidade: (() => {
              const d = calcDaysRemaining(row.sicaf_data_validade);
              return d !== null
                ? Math.max(0, d)
                : row.sicaf_dias_validade != null
                  ? Number(row.sicaf_dias_validade)
                  : null;
            })(),
            completude:
              row.sicaf_completude != null ? Number(row.sicaf_completude) : null,
          }
        : null,
      renovacao: ultimaRenovacao
        ? {
            id: ultimaRenovacao.id,
            status: ultimaRenovacao.status || null,
            anoReferencia: ultimaRenovacao.ano_referencia || null,
            createdAt: ultimaRenovacao.created_at || null,
          }
        : null,
      manutencao: manutencaoAtual
        ? {
            id: manutencaoAtual.id,
            status: manutencaoAtual.status || null,
            dataInicio: manutencaoAtual.data_inicio || null,
            dataFim: manutencaoAtual.data_fim || null,
            valor:
              manutencaoAtual.valor != null ? Number(manutencaoAtual.valor) : null,
            diasRestantes:
              manutencaoAtual.dias_restantes != null
                ? Number(manutencaoAtual.dias_restantes)
                : null,
          }
        : null,
    };
  } catch (e) {
    console.error("[Clients] Erro consultClientByCnpj:", e.message);
    return { ok: false, error: "Erro interno no servidor" };
  }
}

async function getClientByDocumento(docParam) {
  const db = getDb();
  if (!db) return { ok: false, error: "Banco de dados não disponível" };

  const docDigits = String(docParam || "").replace(/\D/g, "");
  if (!docDigits) {
    return { ok: false, error: "Documento inválido. Informe CPF/CNPJ com números." };
  }

  try {
    const row = await db("clientes as c")
      .leftJoin("sicaf_cadastros as s", "c.id", "s.cliente_id")
      .whereRaw(
        "REPLACE(REPLACE(REPLACE(c.documento, '.', ''), '/', ''), '-', '') = ?",
        [docDigits],
      )
      .select(
        "c.*",
        "s.id as sicaf_id",
        "s.status as sicaf_status",
        "s.data_validade as sicaf_data_validade",
      )
      .orderBy("c.id", "desc")
      .first();

    if (!row) {
      return { ok: false, error: "Cliente não encontrado" };
    }

    const sicafStatus = row.sicaf_id
      ? resolveSicafDisplayStatus(row.sicaf_status, row.sicaf_data_validade, true)
      : null;
    const sicafValid = row.sicaf_id
      ? isSicafDisplayValid(row.sicaf_status, row.sicaf_data_validade, true)
      : false;

    let ultimaRenovacao = null;
    if (row.sicaf_id) {
      ultimaRenovacao = await db("sicaf_renovacoes")
        .where("sicaf_id", row.sicaf_id)
        .where("cliente_id", row.id)
        .orderBy("id", "desc")
        .first();
    }

    const client = {
      id: row.id,
      name: row.razao_social || null,
      razao_social: row.razao_social || null,
      nome_fantasia: row.nome_fantasia || null,
      documento: row.documento || null,
      email: row.email || null,
      telefone: row.telefone || null,
      celular: row.celular || null,
      endereco: row.endereco || null,
      cidade: row.cidade || null,
      estado: row.estado || null,
      responsavel_nome: row.responsavel_nome || null,
      ramo_atividade: row.ramo_atividade || null,
      status: row.status || null,
      sicafId: row.sicaf_id || null,
      sicaf_id: row.sicaf_id || null,
      sicafStatus,
      sicaf_status: sicafStatus,
      sicafValid,
      sicafValidade: row.sicaf_data_validade || null,
      sicaf_validade: row.sicaf_data_validade || null,
      ultimaRenovacao: ultimaRenovacao
        ? {
            status: ultimaRenovacao.status,
            ano: ultimaRenovacao.ano_referencia,
            createdAt: ultimaRenovacao.created_at,
          }
        : null,
    };

    return { ok: true, client, cliente: client };
  } catch (e) {
    console.error("[Clients] Erro getClientByDocumento:", e.message);
    return { ok: false, error: "Erro interno no servidor" };
  }
}

module.exports = { consultClientByCnpj, getClientByDocumento };
