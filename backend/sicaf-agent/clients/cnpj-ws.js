/**
 * Consulta CNPJ via OpenCNPJ (pública, gratuita).
 * Documentação: https://www.opencnpj.com/#api-usage
 * GET https://kitana.opencnpj.com/cnpj/{14_dígitos}
 */

const OPENCNPJ_BASE_URL = (
  process.env.OPENCNPJ_API_URL || 'https://kitana.opencnpj.com'
).replace(/\/$/, '');

function normalizeOpenCnpjResponse(cnpj, data) {
  let atividadePrincipal = '';
  if (Array.isArray(data.cnaes) && data.cnaes.length) {
    atividadePrincipal = data.cnaes[0]?.descricao || '';
  }

  const cnpjLimpo = String(data.cnpj || cnpj).replace(/\D/g, '');

  return {
    cnpj: cnpjLimpo || cnpj,
    razaoSocial: data.razaoSocial || '',
    nomeFantasia: data.nomeFantasia || '',
    porte: data.porteEmpresa || data.porte || '',
    naturezaJuridica: data.naturezaJuridica || '',
    situacao: data.situacaoCadastral || '',
    atividadePrincipal,
    email: data.email || '',
    telefone: data.telefone || '',
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    cidade: data.municipio || '',
    estado: data.uf || '',
    cep: String(data.cep || '').replace(/\D/g, ''),
  };
}

async function consultCnpjWs(cnpj) {
  const cnpjDigits = String(cnpj || '').replace(/\D/g, '');
  if (cnpjDigits.length !== 14) {
    return { success: false, error: 'CNPJ deve ter 14 dígitos.' };
  }

  const url = `${OPENCNPJ_BASE_URL}/cnpj/${cnpjDigits}`;
  console.log(`[CNPJ] Consultando OpenCNPJ (Kitana): ${cnpjDigits}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CadBrasil/1.0',
      },
    });

    const responseText = await response.text();
    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return { success: false, error: 'Resposta inválida da API OpenCNPJ.' };
    }

    if (response.status === 404) {
      return { success: false, error: 'CNPJ não encontrado na base da Receita Federal.' };
    }

    if (response.status === 429) {
      return {
        success: false,
        error: 'Limite de consultas atingido (100/min). Tente novamente em instantes.',
      };
    }

    if (!response.ok) {
      const errorMsg =
        payload.message ||
        payload.error ||
        payload.detail ||
        `Erro ${response.status} na consulta CNPJ.`;
      return { success: false, error: errorMsg };
    }

    if (payload.success === false) {
      return {
        success: false,
        error: payload.message || 'CNPJ não encontrado na base da Receita Federal.',
      };
    }

    const data = payload.data || payload;
    if (!data || !String(data.cnpj || '').replace(/\D/g, '')) {
      return { success: false, error: 'CNPJ não encontrado na base da Receita Federal.' };
    }

    return {
      success: true,
      data: normalizeOpenCnpjResponse(cnpjDigits, data),
    };
  } catch (e) {
    console.error('[CNPJ] Erro OpenCNPJ:', e.message);
    return { success: false, error: `Erro ao consultar CNPJ: ${e.message}` };
  }
}

module.exports = { consultCnpjWs };
