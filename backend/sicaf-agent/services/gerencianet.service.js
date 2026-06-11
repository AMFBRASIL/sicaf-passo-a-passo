/**
 * Serviço centralizado Gerencianet / Efí Pay.
 *
 * Funcionalidades:
 *  - Gerar boleto (one-step)
 *  - Gerar PIX (cobrança imediata + QR Code)
 *  - Consultar cobrança / PIX
 *  - Diagnóstico (boleto e PIX)
 *
 * Usa o SDK oficial sdk-node-apis-efi (substituto do gn-api-sdk-node).
 * Configuração via variáveis de ambiente (.env) ou via parâmetros.
 */
const EfiPay = require('sdk-node-apis-efi');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// ── Helpers ──────────────────────────────────────────────────────────────────

const LOG = (step, msg, detail) => {
  const d = detail != null ? ` | ${typeof detail === 'object' ? JSON.stringify(detail) : detail}` : '';
  console.log(`[Gerencianet] ${step} ${msg}${d}`);
};

function normalizeExpireAt(rawDate) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const parsed = rawDate ? new Date(rawDate) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    const d = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    if (d > todayStart) return d.toISOString().slice(0, 10);
  }
  const fallback = new Date(todayStart);
  fallback.setDate(fallback.getDate() + 3);
  return fallback.toISOString().slice(0, 10);
}

/** Extrai mensagem de erro do SDK Efí (pode lançar response.data, não Error). */
function extrairMensagemErro(err) {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;

  // Tentar extrair campos padrão do SDK
  const code = err.error || err.code || err.nome;
  let desc = err.error_description ?? err.detail ?? err.mensagem;
  const httpStatus = err.status || err.statusCode || err.httpStatus;

  if (desc && typeof desc === 'object') {
    desc = desc.message
      ? (desc.property ? `${desc.property}: ${desc.message}` : desc.message)
      : (desc.property || JSON.stringify(desc));
  }

  // Mensagens amigáveis para erros conhecidos
  if (code === 'Unauthorized' || code === 'unauthorized' || httpStatus === 401) {
    return 'Unauthorized: Credenciais Gerencianet/Efí rejeitadas. Verifique CLIENT_ID, CLIENT_SECRET e o certificado .p12 no .env. Para boletos, confirme que a conta tem a emissão de boletos habilitada.';
  }
  if (code === 'Forbidden' || httpStatus === 403) {
    return 'Forbidden: Sua conta Gerencianet/Efí não tem permissão para esta operação. Verifique se o produto (Boleto/PIX) está habilitado na sua conta.';
  }

  if (code && desc && String(code) !== String(desc)) return `${code}: ${desc}`;
  const msg = code || desc || err.message;
  if (msg) return String(msg);
  try { return JSON.stringify(err); } catch { return String(err); }
}

/** Remove aspas e espaços das variáveis .env. */
function sanitizeEnv(value) {
  if (value == null || typeof value !== 'string') return '';
  return value.trim().replace(/^["']|["']$/g, '').trim();
}

// ── Certificado ──────────────────────────────────────────────────────────────

let cachedCertPathFromBase64 = null;

/**
 * Resolve o caminho do certificado .p12.
 * Suporta:
 *  1) GERENCIANET_CERTIFICATE_BASE64 (serverless / Vercel)
 *  2) GERENCIANET_CERTIFICATE_PATH   (caminho relativo a server/)
 */
function resolveCertPath() {
  const base64 = process.env.GERENCIANET_CERTIFICATE_BASE64;
  if (base64 && typeof base64 === 'string') {
    const trimmed = base64.trim().replace(/\s/g, '');
    if (trimmed.length > 0) {
      if (cachedCertPathFromBase64 && fs.existsSync(cachedCertPathFromBase64)) {
        return cachedCertPathFromBase64;
      }
      try {
        const buf = Buffer.from(trimmed, 'base64');
        if (buf.length < 200) return null;
        const tmpPath = path.join(os.tmpdir(), 'gerencianet-cert.p12');
        fs.writeFileSync(tmpPath, buf, { mode: 0o600 });
        cachedCertPathFromBase64 = tmpPath;
        LOG('CERT', 'Certificado carregado via BASE64 (temp)', tmpPath);
        return tmpPath;
      } catch (e) {
        console.warn('[Gerencianet] Falha ao decodificar CERTIFICATE_BASE64:', e?.message);
        return null;
      }
    }
  }

  let raw = process.env.GERENCIANET_CERTIFICATE_PATH;
  if (!raw || typeof raw !== 'string') return null;
  raw = raw.trim().replace(/^["']|["']$/g, '');
  if (!raw) return null;
  if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw;
  const bases = [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..', '..', '..'),
  ];
  for (const base of bases) {
    const certPath = path.resolve(base, raw);
    if (fs.existsSync(certPath)) return certPath;
  }
  return null;
}

/** Retorna passphrase do certificado (opcional). */
function getCertPassphrase() {
  const raw = process.env.GERENCIANET_CERTIFICATE_PASSPHRASE;
  if (raw == null || typeof raw !== 'string') return '';
  return raw.trim().replace(/^["']|["']$/g, '') || '';
}

/** Valida arquivo .p12. */
function validateP12File(certPath) {
  try {
    const stat = fs.statSync(certPath);
    if (!stat.isFile()) return { ok: false, error: 'Caminho não é um arquivo.' };
    if (stat.size === 0) return { ok: false, error: 'Arquivo .p12 está vazio.' };
    if (stat.size < 200) return { ok: false, error: 'Arquivo .p12 parece muito pequeno (possível corrompido).' };
    return { ok: true, size: stat.size };
  } catch (e) {
    return { ok: false, error: e?.message || 'Erro ao ler arquivo.' };
  }
}

// ── Instâncias SDK ───────────────────────────────────────────────────────────
//
// IMPORTANTE: O SDK da Efí compartilha o cache de token OAuth (this.auth) entre
// todas as APIs dentro da mesma instância. Se o PIX é chamado primeiro, o token
// PIX fica cacheado e é reutilizado para Cobranças (boleto), que rejeita com
// "Unauthorized" porque os tokens são de APIs diferentes.
//
// SOLUÇÃO: Usamos DUAS instâncias separadas:
//   - efiCobrancas: para boletos (API Cobranças, SEM certificado)
//   - efiPix:       para PIX (API Pix, COM certificado mTLS)
//

/** Monta as options do SDK (base, sem certificado). */
function getEfiBaseConfig() {
  const sandbox = process.env.GERENCIANET_SANDBOX === 'true';
  const clientId = sanitizeEnv(process.env.GERENCIANET_CLIENT_ID);
  const clientSecret = sanitizeEnv(process.env.GERENCIANET_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    throw new Error('GERENCIANET_CLIENT_ID e GERENCIANET_CLIENT_SECRET são obrigatórios no .env');
  }

  return { sandbox, client_id: clientId, client_secret: clientSecret };
}

/** Config completa para PIX (com certificado). */
function getEfiPixConfig() {
  const options = getEfiBaseConfig();

  const certPath = resolveCertPath();
  if (certPath) {
    options.certificate = certPath;
    const passphrase = getCertPassphrase();
    if (passphrase) options.certificatePassword = passphrase;

    if (process.env.NODE_ENV === 'development') {
      LOG('CONFIG', 'Certificado carregado (PIX)', certPath);
      const pathLower = (process.env.GERENCIANET_CERTIFICATE_PATH || '').toLowerCase();
      if (options.sandbox && (pathLower.includes('producao') || pathLower.includes('produção'))) {
        console.warn('[Gerencianet] SANDBOX=true mas certificado parece de PRODUÇÃO.');
      }
      if (!options.sandbox && (pathLower.includes('homolog') || pathLower.includes('sandbox'))) {
        console.warn('[Gerencianet] SANDBOX=false mas certificado parece de HOMOLOGAÇÃO.');
      }
    }
  } else {
    const r = (process.env.GERENCIANET_CERTIFICATE_PATH || '').trim().replace(/^["']|["']$/g, '');
    if (r) console.warn(`[Gerencianet] Certificado PIX não encontrado: ${r}`);
  }

  return options;
}

/** Config para Cobranças / Boletos (SEM certificado — usa apenas OAuth). */
function getEfiCobrancasConfig() {
  const options = getEfiBaseConfig();
  // Cobranças API NÃO usa mTLS → NÃO incluir certificado
  return options;
}

let efiPixInstance = null;
let efiCobrancasInstance = null;

/** Retorna instância do SDK para PIX (com certificado mTLS). */
function getEfiPix() {
  if (!efiPixInstance) {
    LOG('CONFIG', 'Instanciando SDK Efí Pay (PIX, com cert)...');
    const config = getEfiPixConfig();
    efiPixInstance = new EfiPay(config);
    LOG('CONFIG', 'SDK PIX instanciado', { sandbox: config.sandbox, temCert: !!config.certificate });
  }
  return efiPixInstance;
}

/** Retorna instância do SDK para Cobranças/Boletos (SEM certificado). */
function getEfiCobrancas() {
  if (!efiCobrancasInstance) {
    LOG('CONFIG', 'Instanciando SDK Efí Pay (Cobranças, sem cert)...');
    const config = getEfiCobrancasConfig();
    efiCobrancasInstance = new EfiPay(config);
    LOG('CONFIG', 'SDK Cobranças instanciado', { sandbox: config.sandbox });
  }
  return efiCobrancasInstance;
}

/** Compat: retorna instância PIX (para funções que usavam getEfi). */
function getEfi() {
  return getEfiPix();
}

/** Reseta ambas instâncias (útil se certificado mudar em runtime). */
function resetInstance() {
  efiPixInstance = null;
  efiCobrancasInstance = null;
}

// ── Mutex / Lock (SDK não suporta concorrência) ──────────────────────────────

let sdkLock = Promise.resolve();

async function withSdkLock(fn) {
  const currentLock = sdkLock;
  let resolve;
  sdkLock = new Promise((r) => { resolve = r; });
  try {
    await currentLock;
    return await fn();
  } finally {
    resolve();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BOLETO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gera um boleto em uma única etapa (one-step).
 * @param {Object} dados
 * @param {number} dados.valor - Valor em centavos
 * @param {string} dados.vencimento - Data de vencimento (YYYY-MM-DD)
 * @param {Object} dados.cliente - Dados do cliente (nome, email, cpf/cnpj, razaoSocial, telefone, endereco)
 * @param {string} dados.protocolo - Protocolo/referência do pedido
 * @param {string} [dados.idPedido] - ID interno do pedido
 * @returns {Promise<Object>} Dados do boleto gerado
 */
async function gerarBoleto(dados) {
  return withSdkLock(async () => {
    try {
      LOG('BOLETO 1/5', 'Iniciando geração de boleto');
      const efi = getEfiCobrancas();

      LOG('BOLETO 2/5', 'Montando payload');
      const items = [{
        name: 'Guia de Processamento SICAF - CadBrasil',
        value: dados.valor,
        amount: 1,
      }];

      const metadata = {
        custom_id: dados.idPedido?.toString() || dados.protocolo || '',
      };

      const isPJ = !!dados.cliente.cnpj;
      const name = isPJ
        ? (dados.cliente.razaoSocial || dados.cliente.nome || 'Cliente')
        : (dados.cliente.nome || 'Cliente');
      const email = (dados.cliente.email || '').trim();
      if (!email) throw new Error('E-mail do cliente é obrigatório para gerar boleto.');

      const customer = { name: name || 'Cliente', email };

      const telRaw = dados.cliente.telefone ? String(dados.cliente.telefone).replace(/\D/g, '') : '';
      const tel = telRaw.replace(/^0+/, '');
      if (/^[1-9]{2}9?[0-9]{8}$/.test(tel)) customer.phone_number = tel;

      if (isPJ) {
        customer.juridical_person = {
          corporate_name: dados.cliente.razaoSocial || dados.cliente.nome || name,
          cnpj: dados.cliente.cnpj.replace(/\D/g, ''),
        };
      } else if (dados.cliente.cpf) {
        customer.cpf = dados.cliente.cpf.replace(/\D/g, '');
      }

      // Endereço (opcional — precisa de CEP válido + cidade)
      const end = dados.cliente.endereco;
      const zip = end?.cep?.replace(/\D/g, '') || '';
      const hasZip = zip.length === 8;
      const city = (end?.cidade || '').trim();
      if (end && hasZip && city) {
        customer.address = {
          street: (end.logradouro || '').trim() || 'Não informado',
          number: (end.numero || '').trim() || 'S/N',
          neighborhood: (end.bairro || '').trim() || 'Não informado',
          zipcode: zip,
          city,
          state: (end.uf || '').trim().slice(0, 2) || 'SP',
          complement: (end.complemento || '').trim() || null,
        };
      }

      const body = {
        items,
        metadata,
        payment: {
          banking_billet: {
            expire_at: normalizeExpireAt(dados.vencimento),
            message: `Assessoria CADBRASIL\nServiços de assessoria para licitações\nReferência: ${dados.protocolo || ''}`,
            customer,
          },
        },
      };

      LOG('BOLETO 3/5', 'Chamando createOneStepCharge...', { expire_at: body.payment.banking_billet.expire_at });
      const response = await efi.createOneStepCharge({}, body);
      LOG('BOLETO 4/5', 'createOneStepCharge OK', { charge_id: response?.data?.charge_id });
      LOG('BOLETO 5/5', 'Boleto gerado com sucesso');
      return response;
    } catch (error) {
      // Log completo do erro para diagnóstico
      try {
        LOG('BOLETO ERRO RAW', JSON.stringify(error, null, 2));
      } catch { LOG('BOLETO ERRO RAW', String(error)); }
      const msg = extrairMensagemErro(error);
      LOG('BOLETO ERRO', msg);
      const e = new Error(msg || 'Erro ao gerar boleto na Gerencianet.');
      e.raw = error;
      throw e;
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PIX
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gera um PIX (cobrança imediata + QR Code).
 * @param {Object} dados
 * @param {number} dados.valor - Valor em centavos
 * @param {Object} dados.cliente - Dados do cliente (nome, cpf/cnpj, email)
 * @param {string} dados.protocolo - Protocolo/referência
 * @param {string} [dados.chavePix] - Chave PIX da conta (fallback: env)
 * @returns {Promise<Object>} Dados do PIX (txid, QR Code, copia-e-cola)
 */
async function gerarPix(dados) {
  return withSdkLock(async () => {
    try {
      LOG('PIX 1/7', 'Iniciando geração de PIX');

      const certPath = resolveCertPath();
      if (!certPath) {
        throw new Error('PIX exige certificado .p12. Configure GERENCIANET_CERTIFICATE_PATH no .env.');
      }
      LOG('PIX 2/7', 'Certificado OK', { path: certPath });

      const chave = dados.chavePix || process.env.GERENCIANET_PIX_KEY || '';
      if (!chave || !chave.trim()) {
        throw new Error('Chave PIX não configurada. Defina GERENCIANET_PIX_KEY no .env.');
      }
      LOG('PIX 3/7', 'Chave PIX OK');

      const efi = getEfiPix();

      const nome = dados.cliente.nome || dados.cliente.razaoSocial || 'Cliente';
      const cpf = dados.cliente.cpf ? String(dados.cliente.cpf).replace(/\D/g, '') : '';
      const cnpj = dados.cliente.cnpj ? String(dados.cliente.cnpj).replace(/\D/g, '') : '';

      const devedor = { nome };
      if (cpf.length === 11) devedor.cpf = cpf;
      else if (cnpj.length === 14) devedor.cnpj = cnpj;
      else throw new Error('Para PIX é obrigatório CPF (11 dígitos) ou CNPJ (14 dígitos) do pagador.');

      const valorOriginal = (dados.valor / 100).toFixed(2);
      const body = {
        calendario: { expiracao: 3600 },
        devedor,
        valor: { original: valorOriginal },
        chave: chave.trim(),
        solicitacaoPagador: String(dados.protocolo || ''),
        infoAdicionais: [
          { nome: 'Protocolo SICAF', valor: String(dados.protocolo || '') },
          { nome: 'Email', valor: String(dados.cliente.email || '') },
          { nome: 'Serviço', valor: 'Credenciamento SICAF CADBRASIL' },
        ],
      };
      LOG('PIX 4/7', 'Body montado', { valor: valorOriginal });

      LOG('PIX 5/7', 'Chamando pixCreateImmediateCharge...');
      const pixResponse = await efi.pixCreateImmediateCharge([], body);
      LOG('PIX 5/7', 'pixCreateImmediateCharge OK', { txid: pixResponse?.txid, locId: pixResponse?.loc?.id });

      if (!pixResponse?.txid || !pixResponse?.loc?.id) {
        throw new Error('Erro ao criar cobrança PIX: txid ou loc não retornado.');
      }

      const qrParams = { id: pixResponse.loc.id };
      LOG('PIX 6/7', 'Chamando pixGenerateQRCode...', qrParams);
      const qrcodeResponse = await efi.pixGenerateQRCode(qrParams);
      LOG('PIX 7/7', 'PIX gerado com sucesso');

      return { ...pixResponse, qrcode: qrcodeResponse };
    } catch (error) {
      const msg = extrairMensagemErro(error);
      LOG('PIX ERRO', msg);
      const e = new Error(msg || 'Erro ao gerar PIX na Gerencianet.');
      e.raw = error;
      throw e;
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// CONSULTAS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Consulta o status de uma cobrança (boleto).
 * @param {number} chargeId - ID da cobrança
 * @returns {Promise<Object>}
 */
async function consultarCobranca(chargeId) {
  return withSdkLock(async () => {
    try {
      const efi = getEfiCobrancas();
      return await efi.detailCharge({ id: chargeId });
    } catch (error) {
      console.error('[Gerencianet] Erro ao consultar cobrança:', error);
      throw error;
    }
  });
}

/**
 * Consulta o status de um pagamento PIX.
 * @param {string} txid - Transaction ID do PIX
 * @returns {Promise<Object>}
 */
async function consultarPix(txid) {
  return withSdkLock(async () => {
    try {
      const efi = getEfiPix();
      return await efi.pixDetailCharge({ txid });
    } catch (error) {
      console.error('[Gerencianet] Erro ao consultar PIX:', error);
      throw error;
    }
  });
}

/**
 * Cancela / marca como devolvida uma cobrança.
 * @param {number} chargeId
 * @returns {Promise<Object>}
 */
async function cancelarCobranca(chargeId) {
  return withSdkLock(async () => {
    try {
      const efi = getEfiCobrancas();
      return await efi.cancelCharge({ id: chargeId });
    } catch (error) {
      console.error('[Gerencianet] Erro ao cancelar cobrança:', error);
      throw error;
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Diagnóstico de boleto: cria cobrança mínima para validar configuração.
 */
async function diagnosticoBoleto() {
  const out = { ok: false, boletoStatus: null, charge_id: null, error: null, message: '', config: {} };
  try {
    const clientId = sanitizeEnv(process.env.GERENCIANET_CLIENT_ID);
    const clientSecret = sanitizeEnv(process.env.GERENCIANET_CLIENT_SECRET);
    const certPath = resolveCertPath();
    const sandbox = process.env.GERENCIANET_SANDBOX === 'true';
    out.config = { hasClientId: !!clientId, hasClientSecret: !!clientSecret, hasCert: !!certPath, sandbox };
    if (!clientId || !clientSecret) {
      out.error = 'GERENCIANET_CLIENT_ID e GERENCIANET_CLIENT_SECRET são obrigatórios no .env';
      return out;
    }

    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    const ts = Date.now();
    const body = {
      items: [{ name: `Teste diagnóstico boleto ${ts}`, value: 1 + (ts % 99), amount: 1 }],
      metadata: { custom_id: `diagnostico-boleto-${ts}` },
      payment: {
        banking_billet: {
          expire_at: exp.toISOString().slice(0, 10),
          customer: {
            name: `Teste Diagnostico ${ts}`,
            email: 'teste@cadbrasil.com.br',
            cpf: '94271564656',
            birth: '1977-01-15',
            phone_number: '51987654321',
          },
        },
      },
    };

    const efi = getEfiCobrancas();
    const res = await efi.createOneStepCharge({}, body);
    out.ok = true;
    out.boletoStatus = 201;
    out.charge_id = res?.data?.charge_id;
    out.message = 'Boleto OK. createOneStepCharge respondeu com sucesso.';
    return out;
  } catch (err) {
    out.error = extrairMensagemErro(err);
    out.message = `Erro ao gerar boleto de teste: ${out.error}`;
    return out;
  }
}

/**
 * Diagnóstico PIX: testa OAuth da API PIX.
 */
async function diagnosticoPix() {
  LOG('DIAG 1/4', 'Diagnóstico PIX (OAuth) iniciado');
  try {
    const certPath = resolveCertPath();
    if (!certPath) return { ok: false, step: 'oauth', error: 'Certificado .p12 não encontrado.' };
    LOG('DIAG 2/4', 'Certificado OK', { path: certPath });

    const clientId = sanitizeEnv(process.env.GERENCIANET_CLIENT_ID);
    const clientSecret = sanitizeEnv(process.env.GERENCIANET_CLIENT_SECRET);
    if (!clientId || !clientSecret) return { ok: false, step: 'oauth', error: 'client_id ou client_secret ausentes.' };

    LOG('DIAG 3/4', 'Credenciais OK, enviando POST /oauth/token...');
    await _getPixOAuthToken();
    LOG('DIAG 4/4', 'OAuth OK');
    return { ok: true, step: 'oauth' };
  } catch (e) {
    LOG('DIAG ERRO', 'OAuth falhou', { message: e?.message });
    return { ok: false, step: 'oauth', error: e?.message || String(e) };
  }
}

/**
 * Diagnóstico PIX + POST /v2/cob (cobrança mínima).
 */
async function diagnosticoPixCob() {
  LOG('DIAG-COB 1/3', 'Diagnóstico PIX (OAuth + POST /v2/cob) iniciado');
  const out = { oauthOk: false, cobStatus: null, cobResponse: null, request: null, error: null };

  let token;
  try {
    token = await _getPixOAuthToken();
    out.oauthOk = true;
  } catch (e) {
    out.error = 'OAuth falhou: ' + (e?.message || String(e));
    return out;
  }
  LOG('DIAG-COB 2/3', 'OAuth OK, enviando POST /v2/cob...');

  const chave = (process.env.GERENCIANET_PIX_KEY || '').trim();
  const body = {
    calendario: { expiracao: 3600 },
    devedor: { cpf: '12345678909', nome: 'Teste Diag' },
    valor: { original: '0.01' },
    chave,
    solicitacaoPagador: 'diagnostico-pix-cob',
  };
  const bodyStr = JSON.stringify(body);
  out.request = { method: 'POST', url: `https://${token.host}/v2/cob`, chave };

  return new Promise((resolve) => {
    const agent = new https.Agent({
      pfx: fs.readFileSync(resolveCertPath()),
      passphrase: '',
    });
    const req = https.request(
      {
        host: token.host, port: 443, path: '/v2/cob', method: 'POST',
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
        agent,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = data ? JSON.parse(data) : null; } catch { parsed = { _raw: data }; }
          out.cobStatus = res.statusCode;
          out.cobResponse = parsed;
          LOG('DIAG-COB 3/3', 'POST /v2/cob retornou', { status: res.statusCode });
          if (res.statusCode >= 200 && res.statusCode < 300) out.error = null;
          else out.error = parsed?.error_description || parsed?.error || `HTTP ${res.statusCode}`;
          resolve(out);
        });
      }
    );
    req.on('error', (err) => {
      out.error = 'Erro de rede: ' + (err?.message || String(err));
      resolve(out);
    });
    req.write(bodyStr);
    req.end();
  });
}

// ── Helper interno: OAuth token Cobranças (boleto) ───────────────────────────

/**
 * Testa autenticação OAuth na API de Cobranças (boleto).
 * A API de Cobranças NÃO usa certificado mTLS — apenas client_id + client_secret.
 */
function _getCobrancasOAuthToken() {
  const clientId = sanitizeEnv(process.env.GERENCIANET_CLIENT_ID);
  const clientSecret = sanitizeEnv(process.env.GERENCIANET_CLIENT_SECRET);
  if (!clientId || !clientSecret) throw new Error('client_id e client_secret são obrigatórios.');

  const sandbox = process.env.GERENCIANET_SANDBOX === 'true';
  const host = sandbox ? 'cobrancas-h.api.efipay.com.br' : 'cobrancas.api.efipay.com.br';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = JSON.stringify({ grant_type: 'client_credentials' });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host, port: 443, path: '/v1/authorize', method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = data ? JSON.parse(data) : null; } catch { parsed = { _raw: data }; }
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed?.access_token) {
            return resolve({ access_token: parsed.access_token, host, statusCode: res.statusCode });
          }
          reject(new Error(
            `HTTP ${res.statusCode}: ${parsed?.error_description || parsed?.error || parsed?.message || 'Autenticação na API de Cobranças falhou. Verifique se sua aplicação Efí tem a API de Cobranças (boletos) habilitada.'}`
          ));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Diagnóstico completo da API de Cobranças (boleto):
 * 1) Testa OAuth na API de Cobranças (sem certificado)
 * 2) Se OAuth OK, tenta consultar uma cobrança simples
 */
async function diagnosticoCobrancasAuth() {
  const out = {
    oauthOk: false,
    oauthError: null,
    config: {},
    message: '',
  };

  const clientId = sanitizeEnv(process.env.GERENCIANET_CLIENT_ID);
  const clientSecret = sanitizeEnv(process.env.GERENCIANET_CLIENT_SECRET);
  const sandbox = process.env.GERENCIANET_SANDBOX === 'true';
  out.config = {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    sandbox,
    cobrancasHost: sandbox ? 'cobrancas-h.api.efipay.com.br' : 'cobrancas.api.efipay.com.br',
    pixHost: sandbox ? 'pix-h.api.efipay.com.br' : 'pix.api.efipay.com.br',
  };

  // Step 1: Testar OAuth na API de Cobranças
  try {
    LOG('DIAG-BOLETO', 'Testando OAuth na API de Cobranças (sem certificado mTLS)...');
    const token = await _getCobrancasOAuthToken();
    out.oauthOk = true;
    LOG('DIAG-BOLETO', 'OAuth Cobranças OK ✓', { host: token.host });
    out.message = 'Autenticação na API de Cobranças OK. As credenciais têm permissão para boletos.';
  } catch (e) {
    out.oauthError = e.message;
    LOG('DIAG-BOLETO', 'OAuth Cobranças FALHOU ✗', e.message);
    out.message = `Autenticação na API de Cobranças FALHOU: ${e.message}\n\n` +
      'SOLUÇÃO: Acesse o painel Efí Pay (app.sejaefi.com.br) → API → Aplicações → selecione a aplicação → ' +
      'verifique se "API Cobranças" está HABILITADA. Se não estiver, habilite e tente novamente. ' +
      'Se a aplicação foi criada apenas para PIX, pode ser necessário habilitar também a API de Cobranças.';
  }

  return out;
}

// ── Helper interno: OAuth token PIX ──────────────────────────────────────────

function _getPixOAuthToken() {
  const certPath = resolveCertPath();
  if (!certPath) throw new Error('Certificado .p12 não encontrado.');
  const clientId = sanitizeEnv(process.env.GERENCIANET_CLIENT_ID);
  const clientSecret = sanitizeEnv(process.env.GERENCIANET_CLIENT_SECRET);
  if (!clientId || !clientSecret) throw new Error('client_id e client_secret são obrigatórios.');

  const sandbox = process.env.GERENCIANET_SANDBOX === 'true';
  const host = sandbox ? 'pix-h.api.efipay.com.br' : 'pix.api.efipay.com.br';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = JSON.stringify({ grant_type: 'client_credentials' });

  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ pfx: fs.readFileSync(certPath), passphrase: '' });
    const req = https.request(
      {
        host, port: 443, path: '/oauth/token', method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        agent,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = data ? JSON.parse(data) : null; } catch { parsed = { _raw: data }; }
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed?.access_token) {
            return resolve({ access_token: parsed.access_token, host });
          }
          reject(new Error(parsed?.error_description || parsed?.error || `OAuth HTTP ${res.statusCode}`));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// STATUS / INFO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Retorna informações de configuração da Gerencianet (sem secrets).
 */
function getStatus() {
  const clientId = sanitizeEnv(process.env.GERENCIANET_CLIENT_ID);
  const clientSecret = sanitizeEnv(process.env.GERENCIANET_CLIENT_SECRET);
  const certPath = resolveCertPath();
  const sandbox = process.env.GERENCIANET_SANDBOX === 'true';
  const pixKey = (process.env.GERENCIANET_PIX_KEY || '').trim();

  let certValid = null;
  if (certPath) certValid = validateP12File(certPath);

  return {
    configurado: !!(clientId && clientSecret),
    sandbox,
    temCertificado: !!certPath,
    certificadoValido: certValid?.ok || false,
    certificadoTamanho: certValid?.size || 0,
    temChavePix: !!pixKey,
    chavePix: pixKey ? pixKey.substring(0, 4) + '***' : null,
    instancias: {
      pix: !!efiPixInstance,
      cobrancas: !!efiCobrancasInstance,
      nota: 'Instâncias separadas para evitar conflito de token OAuth entre APIs',
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Boleto
  gerarBoleto,
  diagnosticoBoleto,
  diagnosticoCobrancasAuth,

  // PIX
  gerarPix,
  diagnosticoPix,
  diagnosticoPixCob,

  // Consultas
  consultarCobranca,
  consultarPix,
  cancelarCobranca,

  // Utilitários
  getStatus,
  resetInstance,
  resolveCertPath,
  validateP12File,
};
