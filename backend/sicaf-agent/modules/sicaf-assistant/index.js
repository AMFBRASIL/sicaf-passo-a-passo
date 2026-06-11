/**
 * AGENTE DIGITAL SICAF — Orquestrador Principal
 *
 * Fluxo completo:
 *  1. Inicializa OpenAI + MySQL
 *  2. Inicia servidor do assistente (HTTP + SSE)
 *  3. Importa certificado digital (se configurado)
 *  4. Abre Chrome nativo com tela de boas-vindas
 *  5. Abre popup do assistente grudado à direita
 *  6. Navega para o portal SICAF
 *  7. Fase 1: Aguarda login no SICAF → Gov.br
 *  8. Fase 2: Desconecta CDP durante Gov.br (anti-detecção)
 *  9. Fase 3: Reconecta após login e detecta dados do cliente
 * 10. Fase 4: Loop contínuo — detecção + ações + snap
 *
 * Uso: node server/src/modules/sicaf-assistant/index.js
 */
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { ensureDir, sleep } = require('../../utils/helpers');
const { initDatabase } = require('../../database/connection');
const { init: initIa, resetChatHistory } = require('../../services/ia.service');
const chrome = require('./services/chrome.service');
const { detectPageState } = require('./services/sicaf-navigator');
const { setupWindowSnap } = require('./services/window-manager');
const { startAssistantServer, sendStep, sendClientData, broadcastSSE } = require('./http/server');
const { buildWelcomeHTML } = require('./http/assistant-view');

// Estado global da página
const pageState = {
  step: 'welcome',
  url: '',
  text: '',
  clientData: null,
  loggedIn: false,
};

// Referência à página SICAF (pode mudar entre reconexões)
let sicafPage = null;

// Referência ao cleanup do snap (para parar/recriar entre fases)
let snapCleanup = null;

function killAll() {
  console.log('\n  [i] Encerrando tudo...');
  chrome.killChrome();
  setTimeout(() => process.exit(0), 500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════════════╗');
  console.log('  ║  AGENTE DIGITAL SICAF — Login Assistido v5               ║');
  console.log('  ║  Janelas Grudadas + Chat IA + Detecção de Tela           ║');
  console.log('  ╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // ── 1. OpenAI + MySQL ──
  initIa();
  initDatabase();

  // ── 2. Servidor assistente ──
  startAssistantServer({
    pageState,
    getSicafPage: () => sicafPage,
  });
  console.log(`  ✔ Servidor assistente: http://localhost:${config.sicaf.assistantPort}`);

  // ── 3. Certificado digital ──
  let pfxPath = process.argv[2] || config.cert.pfxPath;
  let pfxPw = process.argv[3] || config.cert.pfxPassword;
  let thumbprint = null;

  if (!pfxPath) {
    const certsDir = config.paths.certs;
    if (fs.existsSync(certsDir)) {
      const files = fs.readdirSync(certsDir).filter((x) => /\.(pfx|p12)$/i.test(x));
      if (files.length) pfxPath = path.join(certsDir, files[0]);
    }
  }

  if (pfxPath && pfxPw) {
    try {
      const c = chrome.importPfx(pfxPath, pfxPw);
      thumbprint = c.thumbprint;
      console.log(`  ✔ Cert: ${c.subject.substring(3, 60)}... (${c.expiresAt})`);
    } catch (e) {
      console.log(`  ℹ ${e.message.substring(0, 60)}`);
    }
  }

  // ── 4. Welcome HTML ──
  ensureDir(path.dirname(config.paths.welcomeFile));
  fs.writeFileSync(config.paths.welcomeFile, buildWelcomeHTML(), 'utf8');

  // ── 5. Abrir Chrome ──
  let cdpInfo = await chrome.waitForCDP(2000);
  if (!cdpInfo) {
    console.log('[1] Abrindo Chrome nativo...');
    const proc = chrome.launchChromeNative(`file:///${config.paths.welcomeFile.replace(/\\/g, '/')}`);
    proc.on('exit', () => {
      console.log('\n  [i] Chrome fechou.');
      if (thumbprint && config.cert.autoCleanup) chrome.removePfx(thumbprint);
      process.exit(0);
    });
    cdpInfo = await chrome.waitForCDP(15000);
    if (!cdpInfo) throw new Error('Chrome não iniciou');
    // Trazer Chrome ao primeiro plano imediatamente (Win32 API)
    chrome.bringChromeToFront();
    console.log('  ✔ Chrome nativo aberto');
  } else {
    console.log('[1] Chrome já rodando, reutilizando...');
  }

  // ── 6. Conectar Puppeteer ──
  console.log('[2] Conectando via CDP...');
  let browser = await chrome.connectPuppeteer();
  let pages = await browser.pages();
  let page = pages[0];
  sicafPage = page;
  console.log('  ✔ Conectado');

  // ── 7. Abrir assistente (popup grudado à direita) ──
  console.log('[3] Abrindo assistente grudado...');
  try {
    const screen = await page.evaluate(() => ({ w: screen.availWidth, h: screen.availHeight }));
    const assistantW = Math.max(380, Math.round(screen.w * 0.28));
    const mainW = screen.w - assistantW;
    const h = screen.h - 40;

    await page.evaluate((url, aW, h, left) => {
      window.open(url, 'sicaf-assistant', `width=${aW},height=${h},left=${left},top=0,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes`);
    }, `http://localhost:${config.sicaf.assistantPort}`, assistantW, h, mainW);
    await sleep(1000);

    // Encontrar a página do assistente
    const updatedPages = await browser.pages();
    const assistantPage = updatedPages.find((p) => p.url().includes('localhost:' + config.sicaf.assistantPort));

    if (assistantPage) {
      const snapResult = await setupWindowSnap({
        mainPage: page,
        assistantPage,
        browser,
      });
      snapCleanup = snapResult.cleanup;
      // Guardar cleanup para encerramento
      process.on('exit', () => { if (snapCleanup) snapCleanup(); });
    }
  } catch (e) {
    console.log(`  ℹ Popup: ${e.message.substring(0, 50)}`);
  }

  // ── 8. Tela de boas-vindas (3s) ──
  console.log('[4] Tela de boas-vindas...');
  await sleep(3000);

  // ── 9. Navegar para SICAF ──
  console.log('[5] Navegando para SICAF...');
  pageState.step = 'sicaf_home';
  sendStep('sicaf_home');
  try {
    await page.goto(config.sicaf.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (_) {}
  await sleep(1500);
  await chrome.takeScreenshot(page, 'sicaf_home');
  console.log('  ✔ SICAF carregado');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 1: SICAF → Esperar redirecionamento para Gov.br
  // ═══════════════════════════════════════════════════════════════════════
  console.log('  [Fase 1] Aguardando clique em "Entrar com Gov.br"...');
  let running = true;

  const detectionLoop = setInterval(async () => {
    try {
      const state = await detectPageState(page);
      if (state.step !== pageState.step) {
        Object.assign(pageState, state);
        sendStep(state.step);
        if (state.clientData) {
          pageState.clientData = state.clientData;
          sendClientData(state.clientData);
        }
        console.log(`  [Detecção] ${state.step} — ${state.url.substring(0, 60)}`);
      }
      pageState.url = state.url;
      pageState.text = state.text;
    } catch (_) {}
  }, 2500);

  while (running) {
    try {
      const alive = await chrome.bothTabsAlive();
      if (!alive) { clearInterval(detectionLoop); killAll(); return; }
      const url = page.url();
      if (!url.includes('comprasnet') && !url.includes('sicaf-web') && !url.includes('welcome') && !url.includes('about:blank') && !url.includes('localhost')) {
        break;
      }
    } catch (err) {
      if (err.message?.includes('Target closed') || err.message?.includes('Browser closed')) { running = false; break; }
      if (err.message?.includes('detached') || err.message?.includes('Execution context')) break;
    }
    await sleep(1500);
  }

  clearInterval(detectionLoop);
  if (!running) { console.log('\n  [i] Browser fechou.'); process.exit(0); }

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 2: Gov.br — DESCONECTAR CDP (anti-detecção)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('  [Fase 2] Gov.br detectado — desconectando CDP...');
  sendStep('gov_login');
  pageState.step = 'gov_login';

  // Parar o snap loop ANTES de desconectar (CDP sessions vão morrer)
  if (snapCleanup) { snapCleanup(); snapCleanup = null; }

  try { browser.disconnect(); } catch (_) {}
  sicafPage = null;

  console.log('  ✔ CDP desconectado (zero interferência no Gov.br)');
  console.log('  ✔ Assistente + Chat IA continuam ativos');
  console.log('');

  let lastGovUrl = '';
  let loginComplete = false;

  while (!loginComplete) {
    await sleep(3000);
    const alive = await chrome.bothTabsAlive();
    if (!alive) { killAll(); return; }

    const url = await chrome.getTabUrlViaHttp();
    if (!url) { killAll(); return; }

    if (url !== lastGovUrl) {
      lastGovUrl = url;
      pageState.url = url;
      const ts = new Date().toLocaleTimeString('pt-BR');

      if (url.includes('acesso.gov.br/login')) {
        sendStep('gov_login'); pageState.step = 'gov_login';
        console.log(`  [${ts}] 📍 Página de login Gov.br`);
      } else if (url.includes('acesso.gov.br')) {
        sendStep('captcha'); pageState.step = 'captcha';
        console.log(`  [${ts}] 📍 Gov.br — CAPTCHA/Certificado`);
      } else if (url.includes('sicaf-web') || url.includes('comprasnet.gov.br/sicaf')) {
        loginComplete = true;
        console.log(`  [${ts}] 🎉 Retornou ao SICAF!`);
      } else {
        sendStep('processing'); pageState.step = 'processing';
        console.log(`  [${ts}] 📍 ${url.substring(0, 60)}...`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 3: Login concluído — Reconectar e ativar detecção + ações
  // ═══════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('  [Fase 3] Login concluído! Reconectando...');
  sendStep('logged_in');
  await sleep(800);

  try {
    browser = await chrome.connectPuppeteer();
    pages = await browser.pages();
    page = pages.find((p) => p.url().includes('sicaf') || p.url().includes('comprasnet')) || pages.find((p) => !p.url().includes('localhost')) || pages[0];
    sicafPage = page;

    console.log('  ✔ Reconectado ao SICAF');

    // Liberar o chat IMEDIATAMENTE — já sabemos que o login foi concluído
    sendStep('dashboard');
    pageState.step = 'dashboard';
    pageState.loggedIn = true;

    // Recriar o snap loop com as novas sessões CDP
    try {
      const updatedPages3 = await browser.pages();
      const assistantPage3 = updatedPages3.find((p) => p.url().includes('localhost:' + config.sicaf.assistantPort));
      if (assistantPage3) {
        const snapResult3 = await setupWindowSnap({
          mainPage: page,
          assistantPage: assistantPage3,
          browser,
        });
        snapCleanup = snapResult3.cleanup;
        console.log('  ✔ Snap loop recriado após reconexão');
      }
    } catch (snapErr) {
      console.log(`  ⚠ Não foi possível recriar snap: ${snapErr.message?.substring(0, 50)}`);
    }

    console.log('');
    console.log('  ╔════════════════════════════════════════════════════════╗');
    console.log('  ║  ✅  LOGIN REALIZADO COM SUCESSO!                     ║');
    console.log('  ╚════════════════════════════════════════════════════════╝');

    // Ler dados do cliente em background (sem bloquear o chat)
    (async () => {
      try {
        await sleep(1500);
        for (let attempt = 0; attempt < 4; attempt++) {
          const state = await detectPageState(page);
          if (state.clientData && (state.clientData.nome || state.clientData.doc)) {
            pageState.clientData = state.clientData;
            sendClientData(state.clientData);
            console.log(`  ✔ Dados do cliente lidos (tentativa ${attempt + 1})`);
            console.log(`    Nome: ${state.clientData.nome || '—'}`);
            console.log(`    Doc: ${state.clientData.doc || '—'}`);
            return;
          }
          if (attempt < 3) {
            console.log(`  ℹ Tentativa ${attempt + 1}: dados ainda carregando...`);
            await sleep(2000);
          }
        }
        console.log('  ⚠ Dados do cliente não detectados automaticamente');
      } catch (_) {}
    })();

    await chrome.takeScreenshot(page, 'dashboard');
  } catch (err) {
    // Mesmo com erro, liberar o chat para o usuário não ficar preso
    sendStep('dashboard');
    pageState.step = 'dashboard';
    pageState.loggedIn = true;
    console.log(`  ⚠ Erro ao reconectar: ${err.message} — chat liberado mesmo assim`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 4: Loop contínuo — Detecção + Ações + Detecção de logout
  // ═══════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('  ═══════════════════════════════════════════════════════');
  console.log('  Assistente com IA ativo. Chat liberado. Feche o Chrome para encerrar.');
  console.log('  ═══════════════════════════════════════════════════════');

  let logoutDetected = false;

  const postLoginDetection = setInterval(async () => {
    try {
      if (!sicafPage || logoutDetected) return;
      const state = await detectPageState(sicafPage);

      // ── Detectar logout: saiu do dashboard e voltou para login/home ──
      const wasLoggedIn = pageState.loggedIn && (pageState.step === 'dashboard' || pageState.step.startsWith('nivel_') || pageState.step === 'crc' || pageState.step === 'situacao_fornecedor');
      const isLoggedOut = state.step === 'sicaf_home' || state.step === 'gov_login' || state.step === 'unknown';

      if (wasLoggedIn && isLoggedOut) {
        logoutDetected = true;
        console.log('');
        console.log('  ╔════════════════════════════════════════════════════════╗');
        console.log('  ║  ⚠  LOGOUT DETECTADO — Reiniciando assistente...      ║');
        console.log('  ╚════════════════════════════════════════════════════════╝');
        return;
      }

      if (state.step !== pageState.step) {
        console.log(`  [Detecção] ${pageState.step} → ${state.step}`);
        Object.assign(pageState, state);
        sendStep(state.step);
        if (state.clientData && !pageState.clientData) {
          sendClientData(state.clientData);
        }
      }
      pageState.url = state.url;
      pageState.text = state.text;
    } catch (_) {}
  }, 3000);

  // Manter vivo — verifica logout e tabs (com tolerância a falsos positivos)
  let deadChecks = 0;
  while (true) {
    await sleep(3000);
    const alive = await chrome.bothTabsAlive();
    if (!alive) {
      deadChecks++;
      if (deadChecks >= 3) {
        // 3 checks seguidos sem abas = Chrome realmente fechou
        clearInterval(postLoginDetection);
        console.log('\n  [i] Chrome fechou (confirmado após 3 verificações) — encerrando tudo.');
        killAll();
        return;
      }
      // Pode ser transitório (PDF fechado, aba em transição) — aguardar
      console.log(`  [i] Verificação ${deadChecks}/3 — abas não encontradas, aguardando...`);
      continue;
    }
    deadChecks = 0; // Reset counter se está vivo

    // ── RESTART: Logout detectado → reiniciar fluxo completo ──
    if (logoutDetected) {
      clearInterval(postLoginDetection);
      console.log('  [Restart] Resetando conversa e estado...');

      // 1. Resetar chat history
      resetChatHistory();

      // 2. Resetar estado da página
      pageState.step = 'sicaf_home';
      pageState.url = '';
      pageState.text = '';
      pageState.clientData = null;
      pageState.loggedIn = false;

      // 3. Notificar frontend para limpar chat e mostrar reinício
      broadcastSSE({ type: 'restart', reason: 'logout' });
      sendStep('sicaf_home');

      // 4. Navegar de volta para o portal SICAF
      console.log('  [Restart] Navegando de volta para o portal SICAF...');
      try {
        await sicafPage.goto(config.sicaf.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch (_) {}
      await sleep(2000);
      console.log('  [Restart] SICAF carregado. Aguardando novo login...');
      console.log('');

      // ══════════════════════════════════════════════════════════
      // REINICIAR FASE 1: Esperar redirecionamento para Gov.br
      // ══════════════════════════════════════════════════════════
      console.log('  [Fase 1 — Restart] Aguardando clique em "Entrar com Gov.br"...');
      let running2 = true;

      const detectionLoop2 = setInterval(async () => {
        try {
          const state2 = await detectPageState(sicafPage);
          if (state2.step !== pageState.step) {
            Object.assign(pageState, state2);
            sendStep(state2.step);
            if (state2.clientData) {
              pageState.clientData = state2.clientData;
              sendClientData(state2.clientData);
            }
            console.log(`  [Detecção] ${state2.step} — ${state2.url.substring(0, 60)}`);
          }
          pageState.url = state2.url;
          pageState.text = state2.text;
        } catch (_) {}
      }, 2500);

      while (running2) {
        try {
          const alive2 = await chrome.bothTabsAlive();
          if (!alive2) { clearInterval(detectionLoop2); killAll(); return; }
          const url2 = sicafPage.url();
          if (!url2.includes('comprasnet') && !url2.includes('sicaf-web') && !url2.includes('welcome') && !url2.includes('about:blank') && !url2.includes('localhost')) {
            break;
          }
        } catch (err) {
          if (err.message?.includes('Target closed') || err.message?.includes('Browser closed')) { running2 = false; break; }
          if (err.message?.includes('detached') || err.message?.includes('Execution context')) break;
        }
        await sleep(1500);
      }

      clearInterval(detectionLoop2);
      if (!running2) { console.log('\n  [i] Browser fechou.'); process.exit(0); }

      // ══════════════════════════════════════════════════════════
      // REINICIAR FASE 2: Gov.br — DESCONECTAR CDP
      // ══════════════════════════════════════════════════════════
      console.log('  [Fase 2 — Restart] Gov.br detectado — desconectando CDP...');
      sendStep('gov_login');
      pageState.step = 'gov_login';

      // Parar o snap loop ANTES de desconectar
      if (snapCleanup) { snapCleanup(); snapCleanup = null; }

      try { browser.disconnect(); } catch (_) {}
      sicafPage = null;

      let lastGovUrl2 = '';
      let loginComplete2 = false;

      while (!loginComplete2) {
        await sleep(3000);
        const alive3 = await chrome.bothTabsAlive();
        if (!alive3) { killAll(); return; }

        const url3 = await chrome.getTabUrlViaHttp();
        if (!url3) { killAll(); return; }

        if (url3 !== lastGovUrl2) {
          lastGovUrl2 = url3;
          pageState.url = url3;
          const ts3 = new Date().toLocaleTimeString('pt-BR');

          if (url3.includes('acesso.gov.br/login')) {
            sendStep('gov_login'); pageState.step = 'gov_login';
            console.log(`  [${ts3}] Página de login Gov.br`);
          } else if (url3.includes('acesso.gov.br')) {
            sendStep('captcha'); pageState.step = 'captcha';
            console.log(`  [${ts3}] Gov.br — CAPTCHA/Certificado`);
          } else if (url3.includes('sicaf-web') || url3.includes('comprasnet.gov.br/sicaf')) {
            loginComplete2 = true;
            console.log(`  [${ts3}] Retornou ao SICAF!`);
          } else {
            sendStep('processing'); pageState.step = 'processing';
            console.log(`  [${ts3}] ${url3.substring(0, 60)}...`);
          }
        }
      }

      // ══════════════════════════════════════════════════════════
      // REINICIAR FASE 3: Reconectar e ativar detecção
      // ══════════════════════════════════════════════════════════
      console.log('  [Fase 3 — Restart] Login concluído! Reconectando...');
      sendStep('logged_in');
      await sleep(1000);

      try {
        browser = await chrome.connectPuppeteer();
        pages = await browser.pages();
        page = pages.find((p) => p.url().includes('sicaf') || p.url().includes('comprasnet')) || pages.find((p) => !p.url().includes('localhost')) || pages[0];
        sicafPage = page;

        console.log('  ✔ Reconectado ao SICAF');

        // Liberar o chat IMEDIATAMENTE
        sendStep('dashboard');
        pageState.step = 'dashboard';
        pageState.loggedIn = true;

        // Recriar o snap loop com as novas sessões CDP
        try {
          const updatedPagesR = await browser.pages();
          const assistantPageR = updatedPagesR.find((p) => p.url().includes('localhost:' + config.sicaf.assistantPort));
          if (assistantPageR) {
            const snapResultR = await setupWindowSnap({
              mainPage: page,
              assistantPage: assistantPageR,
              browser,
            });
            snapCleanup = snapResultR.cleanup;
            console.log('  ✔ Snap loop recriado após re-login');
          }
        } catch (snapErr) {
          console.log(`  ⚠ Não foi possível recriar snap: ${snapErr.message?.substring(0, 50)}`);
        }

        console.log('');
        console.log('  ╔════════════════════════════════════════════════════════╗');
        console.log('  ║  ✅  RE-LOGIN REALIZADO COM SUCESSO!                  ║');
        console.log('  ╚════════════════════════════════════════════════════════╝');

        // Ler dados do cliente em background
        (async () => {
          try {
            await sleep(1500);
            for (let attempt = 0; attempt < 4; attempt++) {
              const stateR = await detectPageState(page);
              if (stateR.clientData && (stateR.clientData.nome || stateR.clientData.doc)) {
                pageState.clientData = stateR.clientData;
                sendClientData(stateR.clientData);
                console.log(`  ✔ Dados do cliente lidos (tentativa ${attempt + 1})`);
                return;
              }
              if (attempt < 3) await sleep(2000);
            }
            console.log('  ⚠ Dados do cliente não detectados automaticamente');
          } catch (_) {}
        })();
      } catch (err) {
        sendStep('dashboard');
        pageState.step = 'dashboard';
        pageState.loggedIn = true;
        console.log(`  ⚠ Erro ao reconectar: ${err.message} — chat liberado mesmo assim`);
      }

      // Reiniciar Fase 4 recursivamente
      console.log('');
      console.log('  ═══════════════════════════════════════════════════════');
      console.log('  Assistente reiniciado. Chat liberado. Feche o Chrome para encerrar.');
      console.log('  ═══════════════════════════════════════════════════════');

      logoutDetected = false;

      // Recriar o loop de detecção pós-login
      const postLoginDetection2 = setInterval(async () => {
        try {
          if (!sicafPage || logoutDetected) return;
          const stateL = await detectPageState(sicafPage);

          const wasIn = pageState.loggedIn && (pageState.step === 'dashboard' || pageState.step.startsWith('nivel_') || pageState.step === 'crc' || pageState.step === 'situacao_fornecedor');
          const isOut = stateL.step === 'sicaf_home' || stateL.step === 'gov_login' || stateL.step === 'unknown';

          if (wasIn && isOut) {
            logoutDetected = true;
            console.log('');
            console.log('  ╔════════════════════════════════════════════════════════╗');
            console.log('  ║  ⚠  LOGOUT DETECTADO — Reiniciando assistente...      ║');
            console.log('  ╚════════════════════════════════════════════════════════╝');
            clearInterval(postLoginDetection2);
            return;
          }

          if (stateL.step !== pageState.step) {
            console.log(`  [Detecção] ${pageState.step} → ${stateL.step}`);
            Object.assign(pageState, stateL);
            sendStep(stateL.step);
            if (stateL.clientData && !pageState.clientData) {
              sendClientData(stateL.clientData);
            }
          }
          pageState.url = stateL.url;
          pageState.text = stateL.text;
        } catch (_) {}
      }, 3000);

      // Continuar o loop principal (o while(true) acima continua rodando)
      // A próxima iteração do while(true) vai detectar logoutDetected e reiniciar novamente
      continue;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUÇÃO
// ═══════════════════════════════════════════════════════════════════════════════
process.on('SIGINT', () => killAll());
main().catch((err) => {
  console.error('Erro:', err.message);
  killAll();
});
