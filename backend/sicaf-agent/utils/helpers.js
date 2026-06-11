/**
 * Utilitários compartilhados do backend CadBrasil
 */
const fs = require('fs');
const path = require('path');

/**
 * Garante que um diretório existe, criando recursivamente se necessário.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Promise de sleep.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve caminhos relativos ao diretório raiz do server.
 */
function serverPath(...segments) {
  return path.resolve(__dirname, '..', '..', ...segments);
}

/**
 * Requisição HTTP GET que retorna JSON.
 */
function httpGetJson(url) {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('JSON parse error'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD.
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return null;
}

/**
 * Calcula dias até o vencimento.
 */
function calcDiasVencimento(dataValidade) {
  if (!dataValidade) return null;
  const hoje = new Date();
  const validade = new Date(dataValidade + 'T00:00:00');
  return Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
}

module.exports = {
  ensureDir,
  sleep,
  serverPath,
  httpGetJson,
  parseDate,
  calcDiasVencimento,
};
