/**
 * Serviço de gerenciamento do Chrome nativo + CDP.
 * Inclui launch, conexão Puppeteer, e gerenciamento de certificado digital.
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const puppeteer = require('puppeteer');
const config = require('../../../config');
const { ensureDir, sleep, httpGetJson } = require('../../../utils/helpers');

let chromeProc = null;

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICADO DIGITAL (PFX via PowerShell)
// ═══════════════════════════════════════════════════════════════════════════════

function runPS(script) {
  if (process.platform !== 'win32') {
    console.log('  ℹ PowerShell não disponível neste SO — ignorando comando');
    return '';
  }
  const tmpFile = path.join(config.paths.data, '_tmp.ps1');
  ensureDir(path.dirname(tmpFile));
  fs.writeFileSync(tmpFile, script, 'utf8');
  try {
    return execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`, {
      encoding: 'utf8',
      timeout: 30000,
    }).trim();
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

function importPfx(pfxPath, password) {
  const resolved = path.resolve(pfxPath).replace(/\\/g, '\\\\');
  const result = runPS(
    `$ErrorActionPreference='Stop'\n` +
    `$pw=ConvertTo-SecureString -String '${password}' -AsPlainText -Force\n` +
    `$c=Import-PfxCertificate -FilePath '${resolved}' -CertStoreLocation Cert:\\CurrentUser\\My -Password $pw -Exportable\n` +
    `Write-Output "$($c.Thumbprint)|$($c.Subject)|$($c.NotAfter.ToString('yyyy-MM-dd'))"`
  );
  const [thumbprint, subject, expiresAt] = result.split('|');
  return { thumbprint, subject, expiresAt };
}

function removePfx(thumbprint) {
  try {
    runPS(`Remove-Item "Cert:\\CurrentUser\\My\\${thumbprint}" -Force -ErrorAction SilentlyContinue`);
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHROME NATIVO
// ═══════════════════════════════════════════════════════════════════════════════

function findChrome() {
  const isLinux = process.platform === 'linux';
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  const paths = [];

  if (isWin) {
    paths.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    );
  }

  if (isLinux) {
    paths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/usr/lib/chromium/chromium',
      '/usr/lib/chromium-browser/chromium-browser',
    );
  }

  if (isMac) {
    paths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  }

  // Variável de ambiente customizada (prioridade máxima)
  if (process.env.CHROME_PATH) {
    paths.unshift(process.env.CHROME_PATH);
  }

  return paths.find((p) => p && fs.existsSync(p));
}

/**
 * Limpa o cache SSL/certificado do perfil do Chrome.
 * Isso garante que ao abrir com um novo certificado digital (outro CNPJ),
 * o Chrome peça novamente qual certificado usar ao invés de reutilizar o anterior.
 */
function clearChromeCertCache() {
  const profileDefault = path.join(config.paths.chromeProfile, 'Default');
  // Arquivos que armazenam seleção de certificado SSL e estado de transporte
  const filesToDelete = [
    path.join(profileDefault, 'TransportSecurity'),
    path.join(profileDefault, 'Network Persistent State'),
    path.join(profileDefault, 'AutoSelectCertificateForUrls'),
    path.join(profileDefault, 'client_cert'),
  ];
  // Diretórios que podem conter cache de sessão SSL
  const dirsToDelete = [
    path.join(profileDefault, 'Service Worker'),
    path.join(profileDefault, 'Cache'),
    path.join(profileDefault, 'Code Cache'),
    path.join(config.paths.chromeProfile, 'Default', 'Network'),
  ];

  let cleaned = 0;

  for (const f of filesToDelete) {
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
        cleaned++;
      }
    } catch (_) {}
  }

  for (const d of dirsToDelete) {
    try {
      if (fs.existsSync(d)) {
        fs.rmSync(d, { recursive: true, force: true });
        cleaned++;
      }
    } catch (_) {}
  }

  // Limpar a preferência de auto-seleção de certificado do Preferences JSON
  const prefsFile = path.join(profileDefault, 'Preferences');
  try {
    if (fs.existsSync(prefsFile)) {
      const prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
      // Limpar content_settings de client_certificate (seleção de cert por site)
      if (prefs.profile && prefs.profile.content_settings &&
          prefs.profile.content_settings.exceptions &&
          prefs.profile.content_settings.exceptions.client_certificate) {
        delete prefs.profile.content_settings.exceptions.client_certificate;
        cleaned++;
      }
      // Limpar managed auto-select
      if (prefs.policy && prefs.policy.AutoSelectCertificateForUrls) {
        delete prefs.policy.AutoSelectCertificateForUrls;
        cleaned++;
      }
      fs.writeFileSync(prefsFile, JSON.stringify(prefs, null, 2), 'utf8');
    }
  } catch (_) {}

  if (cleaned > 0) {
    console.log(`  ✔ Cache de certificado SSL limpo (${cleaned} itens removidos)`);
  }
}

function launchChromeNative(url) {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome/Chromium não encontrado. No Linux instale com: apt install -y chromium-browser ou google-chrome-stable. Ou defina CHROME_PATH no .env');

  // Limpar cache de certificado antes de abrir o Chrome (só funciona em Windows)
  if (process.platform === 'win32') {
    clearChromeCertCache();
  }

  ensureDir(config.paths.chromeProfile);
  const args = [
    `--remote-debugging-port=${config.sicaf.cdpPort}`,
    `--user-data-dir=${config.paths.chromeProfile}`,
    '--lang=pt-BR,pt',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
  ];

  // Em Linux (servidor), rodar headless + flags de segurança para rodar como root
  if (process.platform === 'linux') {
    args.push(
      '--headless=new',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--window-size=1920,1080',
    );
  } else {
    // Windows/Mac — modo visual com janela maximizada
    args.push('--start-maximized');
  }

  if (url) args.push(url);
  chromeProc = spawn(chromePath, args, { detached: false, stdio: 'ignore' });
  return chromeProc;
}

/**
 * Aguarda o Chrome abrir e o CDP ficar disponível.
 */
async function waitForCDP(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      return await httpGetJson(`http://localhost:${config.sicaf.cdpPort}/json/version`);
    } catch (_) {
      await sleep(500);
    }
  }
  return null;
}

/**
 * Obtém a URL da aba principal via HTTP (sem CDP conectado).
 */
async function getTabUrlViaHttp() {
  try {
    const tabs = await httpGetJson(`http://localhost:${config.sicaf.cdpPort}/json/list`);
    if (!Array.isArray(tabs) || !tabs.length) return '';
    const tab = tabs.find((t) => t.url.includes('gov.br') || t.url.includes('comprasnet') || t.url.includes('sicaf'));
    return (tab || tabs[0]).url || '';
  } catch {
    return '';
  }
}

/**
 * Verifica se as abas essenciais (SICAF + Assistente) estão abertas.
 * Ignora abas extras (PDFs, downloads, etc.) — só verifica as duas abas que importam.
 */
async function bothTabsAlive() {
  try {
    const tabs = await httpGetJson(`http://localhost:${config.sicaf.cdpPort}/json/list`);
    // Se o Chrome fechou totalmente, não há tabs
    if (!Array.isArray(tabs) || tabs.length === 0) return false;

    // Verificar se a aba do assistente existe
    const hasAssistant = tabs.some((t) => t.url && t.url.includes('localhost:' + config.sicaf.assistantPort));

    // Verificar se há alguma aba principal (SICAF, Gov.br, ComprasNet, welcome, ou about:blank)
    // Uma aba extra (PDF, outro site) não é considerada — e fechar ela não deve matar o assistente
    const hasMain = tabs.some((t) => {
      if (!t.url) return false;
      if (t.url.includes('localhost:' + config.sicaf.assistantPort)) return false; // é o assistente
      // Abas reconhecidas como "principal"
      return t.url.includes('sicaf') ||
             t.url.includes('comprasnet') ||
             t.url.includes('gov.br') ||
             t.url.includes('welcome') ||
             t.url === 'about:blank' ||
             t.url.startsWith('chrome://') ||
             t.url.startsWith('file:///');
    });

    // Se não achou aba principal específica, mas tem pelo menos 2 abas e o assistente está vivo,
    // considerar que está ok (pode ser uma aba de transição/redirecionamento)
    if (hasAssistant && !hasMain && tabs.length >= 2) {
      return true;
    }

    return hasAssistant && hasMain;
  } catch {
    return false;
  }
}

/**
 * Conecta o Puppeteer ao Chrome via CDP.
 */
async function connectPuppeteer() {
  return await puppeteer.connect({
    browserURL: `http://localhost:${config.sicaf.cdpPort}`,
    defaultViewport: null,
  });
}

/**
 * Tira screenshot da página.
 */
async function takeScreenshot(page, label) {
  ensureDir(config.paths.screenshots);
  try {
    await page.screenshot({
      path: path.join(config.paths.screenshots, `${Date.now()}_${label}.png`),
      fullPage: false,
    });
  } catch (_) {}
}

function getChromeProc() {
  return chromeProc;
}

function killChrome() {
  try {
    if (chromeProc) {
      process.kill(chromeProc.pid);
      chromeProc = null;
    }
  } catch (_) {}
}

/**
 * Restaura e traz TODAS as janelas do Chrome para o primeiro plano (Windows).
 * Usa Win32 API via PowerShell oculto (nenhuma janela CMD/PS visível).
 * Script .ps1 usa ShowWindow(SW_RESTORE) + Alt-key trick + SetForegroundWindow.
 */
function bringChromeToFront() {
  if (process.platform !== 'win32') return;
  try {
    const scriptPath = path.resolve(__dirname, '..', '..', '..', '..', 'data', 'restore-chrome.ps1');
    execSync(
      `powershell.exe -NoProfile -NoLogo -WindowStyle Hidden -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { windowsHide: true, stdio: 'ignore', timeout: 8000 }
    );
  } catch (_) {}
}

module.exports = {
  // Certificado
  importPfx,
  removePfx,
  clearChromeCertCache,
  // Chrome
  findChrome,
  launchChromeNative,
  waitForCDP,
  getTabUrlViaHttp,
  bothTabsAlive,
  connectPuppeteer,
  takeScreenshot,
  getChromeProc,
  killChrome,
  bringChromeToFront,
};
