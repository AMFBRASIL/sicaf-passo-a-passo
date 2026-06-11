/**
 * Consulta CNPJ na Receita Federal via API comercial CNPJ.ws (mesmo fluxo do legado).
 */

function normalizeCnpjWsResponse(cnpj, data) {
  const est = data.estabelecimento || data;
  const end = est.endereco || est;

  return {
    cnpj: est.cnpj || cnpj,
    razaoSocial: data.razao_social || est.razao_social || "",
    nomeFantasia: est.nome_fantasia || data.nome_fantasia || "",
    porte: data.porte?.descricao || data.porte || "",
    naturezaJuridica: data.natureza_juridica?.descricao || "",
    situacao: est.situacao_cadastral || data.situacao || "",
    atividadePrincipal:
      est.atividade_principal?.descricao ||
      (Array.isArray(est.atividades_secundarias) ? "" : ""),
    email: est.email || data.email || "",
    telefone: est.ddd1
      ? `(${est.ddd1}) ${est.telefone1 || ""}`.trim()
      : est.telefone || data.telefone || "",
    logradouro: end.logradouro || est.logradouro || "",
    numero: end.numero || est.numero || "",
    complemento: end.complemento || est.complemento || "",
    bairro: end.bairro || est.bairro || "",
    cidade: end.cidade?.nome || est.cidade || est.municipio || "",
    estado: end.estado?.sigla || est.estado || est.uf || "",
    cep: end.cep || est.cep || "",
  };
}

async function consultCnpjWs(cnpj) {
  const cnpjDigits = String(cnpj || "").replace(/\D/g, "");
  if (cnpjDigits.length !== 14) {
    return { success: false, error: "CNPJ deve ter 14 dígitos." };
  }

  let apiToken = (
    process.env.CNPJ_WS_API_TOKEN ||
    process.env.RECEITAWS_API_TOKEN ||
    ""
  ).trim();
  apiToken = apiToken.replace(/^["']|["']$/g, "");

  if (!apiToken) {
    return {
      success: false,
      error: "Token da API CNPJ.ws não configurado no .env",
    };
  }

  const url = `https://comercial.cnpj.ws/cnpj/${cnpjDigits}?token=${encodeURIComponent(apiToken)}`;
  console.log(`[CNPJ] Consultando: ${cnpjDigits}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "CadBrasil/1.0",
        x_api_token: apiToken,
      },
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return { success: false, error: "Resposta inválida da API CNPJ.ws" };
    }

    if (!response.ok) {
      let errorMsg =
        data.message || data.error || data.detail || `Erro ${response.status}`;
      if (response.status === 404) {
        errorMsg = "CNPJ não encontrado na base da Receita Federal.";
      }
      return { success: false, error: errorMsg };
    }

    if (data.resultado === 0 || data.resultado === "0") {
      return {
        success: false,
        error: "CNPJ não encontrado na base da Receita Federal.",
      };
    }

    return {
      success: true,
      data: normalizeCnpjWsResponse(cnpjDigits, data),
    };
  } catch (e) {
    console.error("[CNPJ] Erro:", e.message);
    return { success: false, error: `Erro ao consultar CNPJ: ${e.message}` };
  }
}

module.exports = { consultCnpjWs };
