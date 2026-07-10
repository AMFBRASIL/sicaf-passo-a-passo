/**
 * Consulta CNPJ e cliente por documento — banco legado (cadbrasilsys).
 *
 * Cenários (campo situacaoCadastro):
 * - cnpj_invalido          → erro de validação
 * - nao_encontrado         → não está na CADBRASIL nem na Receita Federal
 * - cadastro_pendente      → encontrado na Receita, sem cadastro na CADBRASIL
 * - aguardando_pagamento   → cadastro na CADBRASIL, taxa SICAF não quitada
 * - sicaf_vencido          → cadastro na CADBRASIL, credenciamento expirado
 * - cadastro_sem_sicaf     → cliente na base, sem registro SICAF
 * - sicaf_incompleto       → SICAF iniciado, sem vigência e sem pendência financeira clara
 * - ativo                  → credenciamento SICAF válido
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

const WHATSAPP_NUMERO = process.env.CADBRASIL_WHATSAPP_NUMERO || "551121220202";
const WHATSAPP_DISPLAY = process.env.CADBRASIL_WHATSAPP_DISPLAY || "(11) 2122-0202";
const URL_VIDEO_ATUALIZAR_SICAF =
  process.env.SICAF_VIDEO_ATUALIZACAO_URL || "https://www.youtube.com/watch?v=ZG3csRrz1rQ";

const { getPublicPayBaseUrl } = require("../utils/pay-link.util");

const NIVEL_ICONE = {
  "Válido": "✅",
  Habilitado: "✅",
  "A Vencer": "⚠️",
  Vencido: "❌",
  Pendente: "⏳",
};

function getUrlAjuda() {
  return `${getPublicPayBaseUrl().replace(/\/$/, "")}/ajuda`;
}

function saudacaoPorHorario() {
  const hour = parseInt(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
    10,
  );
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatarDataBr(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return null;
  }
}

function formatNivelParaApi(nivel) {
  const dataValidade = formatarDataBr(nivel.expiry);
  const pendencia = ["Pendente", "Vencido", "A Vencer"].includes(nivel.status);
  return {
    nivel: nivel.level,
    nome: nivel.name,
    status: nivel.status,
    icone: NIVEL_ICONE[nivel.status] || "⏳",
    pendencia,
    dataValidade,
    certidoes: nivel.certCount || 0,
  };
}

function linhaNivelTexto(n) {
  const base = `${n.icone} Nível ${n.nivel} — ${n.nome}: ${n.status}`;
  return n.dataValidade ? `${base} (válido até ${n.dataValidade})` : base;
}

function formatarMoeda(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function resolveValorTaxaAnual() {
  const { resolveValorTaxaSicaf } = require("../services/planos.service");
  return resolveValorTaxaSicaf(null);
}

function isSicafStatusPendente(status) {
  const s = String(status || "").trim().toLowerCase();
  return ["pendente", "aguardando", "aguardando pagamento", "em aberto"].includes(s);
}

function buildMensagensCadastroPendenteReceita({ razaoSocial, valorTaxa, situacaoReceita }) {
  const nome = razaoSocial || "sua empresa";
  const valorFmt = formatarMoeda(valorTaxa) || "R$ 985,00";
  const url = URL_CADASTRO_CADBRASIL;

  return {
    situacaoCadastro: "cadastro_pendente",
    valorTaxaAnual: Number(valorTaxa) || 0,
    urlCadastro: url,
    podeConcluirCadastro: true,
    message: `CNPJ localizado na Receita Federal. Cadastro na CADBRASIL ainda não foi concluído.`,
    orientacaoUsuario: [
      `Olá, empresa ${nome}!`,
      "Localizamos seus dados na Receita Federal, porém o cadastro junto à CADBRASIL ainda não foi concluído corretamente no cadastramento digital.",
      `O caminho para continuar o processo é ${url}.`,
      "Preencha todas as informações atualizadas e corretas para obter acesso ao SICAF/CADBRASIL.",
      `Lembre-se: durante o processo será necessário pagar a taxa anual de ${valorFmt}.`,
    ].join(" "),
    orientacaoIA: [
      `O CNPJ corresponde a ${nome}`,
      situacaoReceita ? `(situação cadastral na Receita: ${situacaoReceita})` : "",
      "e foi encontrado na Receita Federal, mas NÃO possui cadastro concluído na CADBRASIL.",
      `Oriente o cliente a acessar ${url}, concluir o cadastramento digital com dados atualizados e efetuar o pagamento da taxa anual de ${valorFmt} para obter acesso ao SICAF.`,
      "Sem o cadastro completo e o pagamento, os níveis do SICAF não serão liberados.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function buildMensagensNaoEncontrado({ cnpjDigits, erroReceita }) {
  const url = URL_CADASTRO_CADBRASIL;
  return {
    situacaoCadastro: "nao_encontrado",
    urlCadastro: url,
    podeConcluirCadastro: true,
    message: "CNPJ não encontrado na base da CADBRASIL.",
    orientacaoUsuario: [
      "O CNPJ informado não foi localizado na base da CADBRASIL",
      erroReceita ? `(${erroReceita})` : "nem confirmado na Receita Federal.",
      "Verifique se o número está correto.",
      `Caso sua empresa ainda não tenha cadastro, acesse ${url} para iniciar o cadastramento digital e dar sequência ao processo SICAF.`,
    ]
      .filter(Boolean)
      .join(" "),
    orientacaoIA: [
      `O CNPJ ${cnpjDigits} não foi encontrado na base CADBRASIL.`,
      erroReceita
        ? `Consulta à Receita Federal: ${erroReceita}.`
        : "Não foi possível confirmar os dados na Receita Federal.",
      `Oriente o cliente a verificar o número informado ou iniciar o cadastro em ${url}.`,
    ].join(" "),
    erroReceitaFederal: erroReceita || null,
  };
}

function buildOrientacaoPagamentoPendente({ razaoSocial, valorPendente, urlPortal, pagamentosResumo }) {
  const nome = razaoSocial || "sua empresa";
  const valorFmt = formatarMoeda(valorPendente) || "valor pendente";
  const portal = urlPortal || getPublicPayBaseUrl();

  return {
    possuiPagamentoPendente: true,
    situacaoCadastro: "aguardando_pagamento",
    valorTotalPendente: Number(valorPendente) || 0,
    urlPortal: portal,
    pagamentosResumo: pagamentosResumo || null,
    message: `Cadastro SICAF identificado com pagamento pendente de ${valorFmt}.`,
    orientacaoUsuario: [
      `A empresa ${nome} já possui cadastro SICAF na CADBRASIL, porém o pagamento da taxa de credenciamento ainda está em aberto no valor de ${valorFmt}.`,
      `Para dar continuidade ao processo e liberar a conclusão dos níveis do SICAF, acesse o Portal do Fornecedor em ${portal}, faça login com sua conta e regularize o pagamento.`,
      "Enquanto o pagamento não for confirmado, os níveis do credenciamento SICAF não serão concluídos e sua empresa permanecerá com o credenciamento pendente.",
    ].join(" "),
    orientacaoIA: [
      `O CNPJ pertence a ${nome}, que já possui cadastro SICAF na CADBRASIL, mas ainda não quitou a taxa de credenciamento (${valorFmt}).`,
      `Oriente o cliente a acessar ${portal}, entrar com login e senha e efetuar o pagamento pendente para concluir os níveis do SICAF.`,
      "Sem a regularização do pagamento, o credenciamento permanece incompleto (status Pendente) e os níveis do SICAF não serão liberados.",
    ].join(" "),
  };
}

function buildMensagensSicafVencido({ razaoSocial, dataValidade, urlPortal }) {
  const nome = razaoSocial || "sua empresa";
  const portal = urlPortal || getPublicPayBaseUrl();
  const validadeFmt = dataValidade
    ? new Date(dataValidade).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : null;

  return {
    situacaoCadastro: "sicaf_vencido",
    urlPortal: portal,
    message: validadeFmt
      ? `Credenciamento SICAF vencido em ${validadeFmt}.`
      : "Credenciamento SICAF vencido.",
    orientacaoUsuario: [
      `A empresa ${nome} possui cadastro na CADBRASIL, porém o credenciamento SICAF está vencido`,
      validadeFmt ? `(validade expirada em ${validadeFmt})` : "",
      `Para renovar e restabelecer o acesso, acesse o Portal do Fornecedor em ${portal}, faça login e regularize a situação.`,
    ]
      .filter(Boolean)
      .join(" "),
    orientacaoIA: [
      `O cliente ${nome} tem cadastro na CADBRASIL com SICAF vencido`,
      validadeFmt ? `desde ${validadeFmt}` : "",
      `Oriente a renovação pelo portal ${portal}.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function buildMensagensCadastroSemSicaf({ razaoSocial, valorTaxa }) {
  const nome = razaoSocial || "sua empresa";
  const valorFmt = formatarMoeda(valorTaxa) || "R$ 985,00";
  const url = URL_CADASTRO_CADBRASIL;
  const portal = getPublicPayBaseUrl();

  return {
    situacaoCadastro: "cadastro_sem_sicaf",
    urlCadastro: url,
    urlPortal: portal,
    valorTaxaAnual: Number(valorTaxa) || 0,
    message: "Cliente cadastrado na CADBRASIL sem processo SICAF iniciado.",
    orientacaoUsuario: [
      `A empresa ${nome} está na base da CADBRASIL, mas o processo de credenciamento SICAF ainda não foi iniciado ou concluído.`,
      `Acesse ${portal} ou ${url} para dar continuidade ao cadastro e efetuar o pagamento da taxa anual de ${valorFmt}.`,
    ].join(" "),
    orientacaoIA: [
      `Cliente ${nome} existe na CADBRASIL sem registro SICAF ativo.`,
      `Oriente a conclusão do credenciamento em ${url} ou ${portal}, incluindo pagamento de ${valorFmt}.`,
    ].join(" "),
  };
}

function buildMensagensSicafIncompleto({ razaoSocial, sicafStatus, urlPortal }) {
  const nome = razaoSocial || "sua empresa";
  const portal = urlPortal || getPublicPayBaseUrl();

  return {
    situacaoCadastro: "sicaf_incompleto",
    urlPortal: portal,
    message: `Cadastro SICAF em andamento (status: ${sicafStatus || "Pendente"}).`,
    orientacaoUsuario: [
      `A empresa ${nome} possui cadastro na CADBRASIL, mas o credenciamento SICAF ainda não foi concluído`,
      sicafStatus ? `(situação atual: ${sicafStatus})` : "",
      `Acesse o Portal do Fornecedor em ${portal} para verificar pendências e concluir os níveis do SICAF.`,
    ]
      .filter(Boolean)
      .join(" "),
    orientacaoIA: [
      `Cliente ${nome} com SICAF incompleto (${sicafStatus || "Pendente"}).`,
      `Oriente acesso a ${portal} para regularizar pendências documentais e financeiras.`,
    ].join(" "),
  };
}

function buildMensagensAtivo({
  razaoSocial,
  sicafStatus,
  dataValidade,
  diasValidade,
  possuiRenovacao,
  renovacao,
  pagamentosEmDia,
  niveisSicaf,
  renovacaoProxima,
  renovacaoUrgente,
}) {
  const nome = razaoSocial || "Fornecedor";
  const portal = getPublicPayBaseUrl();
  const ajuda = getUrlAjuda();
  const saudacao = saudacaoPorHorario();
  const validadeFmt = formatarDataBr(dataValidade);
  const niveisComPendencia = niveisSicaf.filter((n) => n.pendencia);
  const niveisTexto = niveisSicaf.length
    ? niveisSicaf.map(linhaNivelTexto).join(" | ")
    : "Consulte o portal para ver o detalhamento dos níveis.";

  let alertaRenovacao = "";
  if (renovacaoUrgente && diasValidade != null) {
    alertaRenovacao = `Atenção: seu credenciamento SICAF vence em ${diasValidade} dia(s)${validadeFmt ? ` (${validadeFmt})` : ""}. Recomendamos iniciar a renovação pelo portal ou solicitar o boleto pelo WhatsApp ${WHATSAPP_DISPLAY}.`;
  } else if (renovacaoProxima && diasValidade != null) {
    alertaRenovacao = `Seu credenciamento SICAF vence em ${diasValidade} dia(s)${validadeFmt ? ` (${validadeFmt})` : ""}. Fique atento à renovação para manter seu acesso em dia.`;
  } else if (diasValidade != null && validadeFmt) {
    alertaRenovacao = `Seu credenciamento está válido por mais ${diasValidade} dia(s), até ${validadeFmt}.`;
  }

  const financeiroTexto = pagamentosEmDia
    ? "Os valores da taxa de credenciamento estão devidamente pagos e em ordem."
    : "Identificamos pendências financeiras. Acesse o portal ou solicite o boleto pelo WhatsApp para regularizar.";

  const renovacaoTexto = possuiRenovacao && renovacao?.status
    ? `Última renovação: ${renovacao.status}${renovacao.anoReferencia ? ` (referência ${renovacao.anoReferencia})` : ""}.`
    : "";

  const pendenciasNiveisTexto = niveisComPendencia.length
    ? `Há ${niveisComPendencia.length} nível(is) com pendência ou atenção: ${niveisComPendencia.map((n) => `Nível ${n.nivel} ${n.icone}`).join(", ")}. Verifique documentos e validades no portal.`
    : "Todos os níveis consultados estão em situação regular.";

  const temCertidaoVencendoOuVencida = niveisSicaf.some(
    (n) => n.status === "A Vencer" || n.status === "Vencido",
  );

  const videoAtualizacaoTexto = temCertidaoVencendoOuVencida
    ? `Identificamos certidão(ões) a vencer ou vencida(s) nos seus níveis SICAF. Assista ao vídeo passo a passo de como atualizar seu credenciamento: ${URL_VIDEO_ATUALIZAR_SICAF}`
    : `Caso tenha alguma certidão a vencer ou vencida, você também pode assistir ao vídeo de como atualizar o SICAF: ${URL_VIDEO_ATUALIZAR_SICAF}`;

  const orientacaoUsuario = [
    `Prezado Fornecedor ${nome}, ${saudacao.toLowerCase()}!`,
    `Seu cadastro encontra-se ${sicafStatus || "ATIVO"} na CADBRASIL`,
    validadeFmt ? `com credenciamento SICAF válido até ${validadeFmt}.` : "com credenciamento SICAF ativo.",
    financeiroTexto,
    renovacaoTexto,
    alertaRenovacao,
    `Níveis SICAF: ${niveisTexto}.`,
    pendenciasNiveisTexto,
    `Para emitir boletos ou acompanhar seu credenciamento, acesse ${portal}.`,
    `Você também pode solicitar o boleto pelo WhatsApp ${WHATSAPP_DISPLAY}.`,
    `Dúvidas para atualizar seu SICAF? Acesse a Central de Ajuda em ${ajuda} — lá você encontra vídeos práticos passo a passo.`,
    videoAtualizacaoTexto,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    situacaoCadastro: "ativo",
    urlPortal: portal,
    urlAjuda: ajuda,
    urlVideoAtualizacaoSicaf: URL_VIDEO_ATUALIZAR_SICAF,
    certidaoVencendoOuVencida: temCertidaoVencendoOuVencida,
    urlWhatsApp: `https://wa.me/${WHATSAPP_NUMERO}`,
    whatsappDisplay: WHATSAPP_DISPLAY,
    saudacao,
    pagamentosEmDia,
    renovacaoProxima: !!renovacaoProxima,
    renovacaoUrgente: !!renovacaoUrgente,
    diasParaRenovacao: diasValidade != null ? diasValidade : null,
    niveisSicaf,
    message: validadeFmt
      ? `Credenciamento SICAF ativo até ${validadeFmt}.`
      : "Credenciamento SICAF ativo na CADBRASIL.",
    orientacaoUsuario,
    orientacaoIA: [
      `Cliente ${nome} com SICAF ${sicafStatus || "Ativo"} na CADBRASIL`,
      validadeFmt ? `(validade ${validadeFmt}, ${diasValidade ?? "?"} dias restantes)` : "",
      pagamentosEmDia ? "Pagamentos em dia." : "Há pendências financeiras.",
      niveisComPendencia.length
        ? `Níveis com pendência: ${niveisComPendencia.map((n) => n.nivel).join(", ")}.`
        : "Níveis em ordem.",
      renovacaoProxima ? "Renovação próxima do vencimento." : "",
      temCertidaoVencendoOuVencida
        ? `Certidões a vencer/vencidas — vídeo atualização SICAF: ${URL_VIDEO_ATUALIZAR_SICAF}.`
        : `Vídeo como atualizar SICAF (se certidão vencer): ${URL_VIDEO_ATUALIZAR_SICAF}.`,
      `Portal: ${portal} | Ajuda: ${ajuda} | WhatsApp: ${WHATSAPP_DISPLAY}.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

async function buildMensagensAtivoCompleto({
  razaoSocial,
  clienteId,
  cnpjDigits,
  sicafStatus,
  dataValidade,
  diasValidade,
  possuiRenovacao,
  renovacao,
}) {
  const { loadSicafNiveisCliente, consultPendingBoletosByCnpj } = require("../services/clients.service");

  const [niveisRaw, pend] = await Promise.all([
    loadSicafNiveisCliente(clienteId),
    consultPendingBoletosByCnpj(cnpjDigits),
  ]);

  const niveisSicaf = niveisRaw.map(formatNivelParaApi);
  const pagamentosEmDia = (Number(pend?.totalPendentes) || 0) === 0;
  const dias = diasValidade != null ? Number(diasValidade) : calcDaysRemaining(dataValidade);
  const renovacaoProxima = dias !== null && dias <= 60;
  const renovacaoUrgente = dias !== null && dias <= 30;

  return buildMensagensAtivo({
    razaoSocial,
    sicafStatus,
    dataValidade,
    diasValidade: dias,
    possuiRenovacao,
    renovacao,
    pagamentosEmDia,
    niveisSicaf,
    renovacaoProxima,
    renovacaoUrgente,
  });
}

async function enrichRespostaPagamentoPendente(base, cnpjDigits, row, sicafValido, possuiRenovacao) {
  if (!row?.sicaf_id || sicafValido || possuiRenovacao) return null;

  const { consultPendingBoletosByCnpj } = require("../services/clients.service");
  const pend = await consultPendingBoletosByCnpj(cnpjDigits);

  const totalPendentes = Number(pend?.totalPendentes) || 0;
  const sicafPendente = isSicafStatusPendente(row.sicaf_status);

  if (totalPendentes === 0 && !sicafPendente) return null;

  let valorPendente = Number(pend?.valorTotalPendente) || 0;
  if (valorPendente <= 0) {
    valorPendente = await resolveValorTaxaAnual();
  }

  const pagamentosResumo = pend?.ok
    ? {
        totalPendentes,
        valorTotalPendente: valorPendente,
        manutencaoPendentes: (pend.boletos?.manutencaoPendentes || []).map((item) => ({
          valor: item.valor ?? null,
          status: item.status || null,
          dataVencimento: item.dataVencimento || null,
          urlPagamento: item.urlPagamento || null,
          payCode: item.payCode || null,
        })),
      }
    : null;

  return buildOrientacaoPagamentoPendente({
    razaoSocial: row.razao_social,
    valorPendente,
    urlPortal: getPublicPayBaseUrl(),
    pagamentosResumo,
  });
}

async function enrichRespostaClienteCadastrado(base, cnpjDigits, row, sicafValido, possuiRenovacao) {
  const pagamentoPendente = await enrichRespostaPagamentoPendente(
    base,
    cnpjDigits,
    row,
    sicafValido,
    possuiRenovacao,
  );
  if (pagamentoPendente) {
    return { ...base, ...pagamentoPendente };
  }

  const sicafDisplay = row.sicaf_id
    ? resolveSicafDisplayStatus(row.sicaf_status, row.sicaf_data_validade, true)
    : null;

  if (sicafValido) {
    const diasValidade = (() => {
      const d = calcDaysRemaining(row.sicaf_data_validade);
      return d !== null
        ? Math.max(0, d)
        : row.sicaf_dias_validade != null
          ? Number(row.sicaf_dias_validade)
          : null;
    })();

    const ativo = await buildMensagensAtivoCompleto({
      razaoSocial: row.razao_social,
      clienteId: row.id,
      cnpjDigits,
      sicafStatus: sicafDisplay,
      dataValidade: row.sicaf_data_validade,
      diasValidade,
      possuiRenovacao,
      renovacao: base.renovacao,
    });
    return { ...base, ...ativo };
  }

  if (sicafDisplay === "Vencido") {
    return { ...base, ...buildMensagensSicafVencido({
      razaoSocial: row.razao_social,
      dataValidade: row.sicaf_data_validade,
      urlPortal: getPublicPayBaseUrl(),
    }) };
  }

  if (!row.sicaf_id) {
    const valorTaxa = await resolveValorTaxaAnual();
    return { ...base, ...buildMensagensCadastroSemSicaf({
      razaoSocial: row.razao_social,
      valorTaxa,
    }) };
  }

  return { ...base, ...buildMensagensSicafIncompleto({
    razaoSocial: row.razao_social,
    sicafStatus: sicafDisplay,
    urlPortal: getPublicPayBaseUrl(),
  }) };
}

async function buildRespostaCnpjNaoCadastrado(cnpjDigits) {
  const [receita, valorTaxa] = await Promise.all([
    consultCnpjWs(cnpjDigits),
    resolveValorTaxaAnual(),
  ]);

  const base = {
    ok: true,
    cnpj: cnpjDigits,
    possuiCadastro: false,
    cadastroConcluido: false,
    cadastroValido: false,
    sicafValido: false,
    possuiRenovacao: false,
    possuiManutencao: false,
    possuiPagamentoPendente: false,
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
      ...buildMensagensCadastroPendenteReceita({
        razaoSocial: razao,
        valorTaxa,
        situacaoReceita: situacao,
      }),
    };
  }

  return {
    ...base,
    encontradoNaReceitaFederal: false,
    receitaFederal: null,
    ...buildMensagensNaoEncontrado({
      cnpjDigits,
      erroReceita: receita.error || null,
    }),
  };
}

async function consultClientByCnpj(cnpj) {
  const db = getDb();
  if (!db) return { ok: false, error: "Banco de dados não disponível" };

  const cnpjDigits = String(cnpj || "").replace(/\D/g, "");
  if (cnpjDigits.length !== 14) {
    return { ok: false, error: "CNPJ inválido. Informe 14 dígitos.", situacaoCadastro: "cnpj_invalido" };
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

    const base = {
      ok: true,
      cnpj: cnpjDigits,
      possuiCadastro: true,
      cadastroConcluido: true,
      cadastroValido,
      sicafValido,
      possuiRenovacao,
      possuiManutencao,
      possuiPagamentoPendente: false,
      razaoSocial: row.razao_social || null,
      urlCadastro: URL_CADASTRO_CADBRASIL,
      urlPortal: getPublicPayBaseUrl(),
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

    return enrichRespostaClienteCadastrado(
      base,
      cnpjDigits,
      row,
      sicafValido,
      possuiRenovacao,
    );
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
