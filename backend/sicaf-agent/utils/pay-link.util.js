/**
 * URL pública da página /pay/{code} (portal do fornecedor, não a API).
 */
const PROD_PAY_FALLBACK = 'https://fornecedor.cadbrasil.com.br';

function trimEnv(value) {
  return String(value || '').trim();
}

function isLocalhostUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/**
 * Ordem de prioridade:
 * 1. PUBLIC_PAY_URL — override explícito para links de pagamento
 * 2. PORTAL_URL — portal do fornecedor (produção)
 * 3. FRONTEND_URL — app React em produção/homolog
 * 4. NEXT_PUBLIC_APP_URL — legado
 *
 * APP_URL (API/backend) NÃO entra aqui — causa localhost:3001 nos e-mails.
 */
function getPublicPayBaseUrl() {
  const candidates = [
    trimEnv(process.env.PUBLIC_PAY_URL),
    trimEnv(process.env.PORTAL_URL),
    trimEnv(process.env.FRONTEND_URL),
    trimEnv(process.env.NEXT_PUBLIC_APP_URL),
  ].filter(Boolean);

  for (const base of candidates) {
    if (!isLocalhostUrl(base)) {
      return base.replace(/\/$/, '');
    }
  }

  return PROD_PAY_FALLBACK;
}

module.exports = {
  getPublicPayBaseUrl,
  PROD_PAY_FALLBACK,
};
