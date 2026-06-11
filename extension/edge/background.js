/**
 * CadBrasil Extension — Background Service Worker
 *
 * Estratégia para abrir o side panel automaticamente:
 *  - O side panel é habilitado APENAS quando a aba ativa é do SICAF
 *  - Ao clicar no ícone da extensão, abre o side panel (sem popup)
 *  - O content script injeta um botão flutuante no SICAF para abrir o painel
 */

const SICAF_URL = 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf';

let sicafTabId = null;
let pageState = { step: 'idle', url: '', clientData: null, loggedIn: false };
let apiBaseUrl = '';
let sicafPageContext = { url: '', pageText: '', title: '', formData: [] };
const sidePanelApi = chrome['side' + 'Panel'];
const SUPPORTS_SIDE_PANEL = !!(sidePanelApi && sidePanelApi.open);

async function setSidePanelOptionsSafe(tabId, enabled) {
  if (!SUPPORTS_SIDE_PANEL || !sidePanelApi?.setOptions) return;
  try {
    await sidePanelApi.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled,
    });
  } catch (_) {}
}

async function openAssistantSurface(tab) {
  if (!tab) return;
  if (SUPPORTS_SIDE_PANEL) {
    await sidePanelApi.open({ windowId: tab.windowId });
    if (tab.id) notifyContentScript(tab.id, 'panel-opened');
    return;
  }
  // Firefox fallback: abrir em janela popup à direita (evita painel preso à esquerda).
  await openAssistantWindow(tab.id || null);
  if (tab.id) notifyContentScript(tab.id, 'panel-opened');
}

async function closeAssistantSurface(tab) {
  if (!tab || !SUPPORTS_SIDE_PANEL || !sidePanelApi?.close) return;
  try {
    await sidePanelApi.close({ windowId: tab.windowId });
  } catch (_) {}
}

// ── Ao clicar no ícone da extensão → abre side panel ──
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await openAssistantSurface(tab);
    console.log('[CadBrasil] Side panel aberto via clique no ícone');
  } catch (err) {
    console.log('[CadBrasil] Erro ao abrir side panel:', err.message);
  }
});

// ── Habilitar side panel APENAS em abas do SICAF ──
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;

  const isSICAF = tab.url.includes('comprasnet.gov.br') || tab.url.includes('sicaf-web');

  // Habilitar/desabilitar side panel conforme a URL (quando disponível)
  await setSidePanelOptionsSafe(tabId, isSICAF);





  // Se é SICAF e acabou de carregar, registrar a aba e mostrar badge
  if (isSICAF && changeInfo.status === 'complete') {
    sicafTabId = tabId;
    pageState.step = 'sicaf_home';
    pageState.url = tab.url;

    // Badge verde no ícone para indicar que o assistente está disponível
    chrome.action.setBadgeText({ text: 'IA', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#238636', tabId });
    chrome.action.setTitle({ title: 'CadBrasil — Clique para abrir o Assistente SICAF', tabId });

    console.log('[CadBrasil] SICAF detectado na aba', tabId);

    // Tentar abrir a superfície do assistente automaticamente
    try {
      await openAssistantSurface(tab);
      console.log('[CadBrasil] Side panel aberto automaticamente');
    } catch (_) {
      // Se falhar (restrição de user gesture), o badge "IA" guia o usuário a clicar
      console.log('[CadBrasil] Auto-open não permitido, badge IA exibido');
    }
  }

  // Atualizar estado se já é a aba SICAF
  if (tabId === sicafTabId && changeInfo.url) {
    pageState.url = changeInfo.url;
    if (changeInfo.url.includes('acesso.gov.br')) {
      pageState.step = 'gov_login';
    } else if (changeInfo.url.includes('sicaf-web') || changeInfo.url.includes('comprasnet.gov.br/sicaf')) {
      pageState.step = pageState.loggedIn ? 'dashboard' : 'sicaf_home';
    }
    broadcastToSidePanel({ type: 'state-update', state: pageState });
  }
});

// ── Quando aba ativa muda, atualizar badge ──
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    const isSICAF = tab.url && (tab.url.includes('comprasnet.gov.br') || tab.url.includes('sicaf-web'));

    if (isSICAF) {
      chrome.action.setBadgeText({ text: 'IA', tabId: activeInfo.tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#238636', tabId: activeInfo.tabId });
    } else {
      // 🔴 FECHAR O SIDE PANEL AO SAIR DO SICAF
      await closeAssistantSurface(tab);
      console.log('[CadBrasil] Side panel fechado ao sair do SICAF');

      chrome.action.setBadgeText({ text: '', tabId: activeInfo.tabId });
    }

  } catch (err) {
    console.log(err);
  }
});


// ── Mensagens EXTERNAS (do portal CadBrasil) ──
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  console.log('[CadBrasil Extension] Mensagem externa:', msg);

  if (msg.action === 'ping') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return true;
  }

  if (msg.action === 'open-sicaf') {
    apiBaseUrl = msg.apiBaseUrl || '';
    chrome.storage.local.set({ apiBaseUrl }).catch(() => {});
    openSICAF(msg.token);
    sendResponse({ ok: true, message: 'Abrindo SICAF...' });
    return true;
  }

  if (msg.action === 'get-status') {
    sendResponse({ ok: true, pageState, sicafTabId });
    return true;
  }

  sendResponse({ ok: false, error: 'Ação desconhecida' });
  return true;
});

// ── Mensagens INTERNAS (content script + side panel) ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Injetar pageworld.js no MAIN world (CSP-safe, sem inline script)
  if (msg.type === 'inject-pageworld') {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['pageworld.js'],
        world: 'MAIN',
      }).then(() => {
        console.log('[Background] pageworld.js injetado na tab', tabId);
      }).catch((e) => {
        console.error('[Background] Erro ao injetar pageworld.js:', e.message);
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'sicaf-state') {
    pageState = { ...pageState, ...msg.state };
    broadcastToSidePanel({ type: 'state-update', state: pageState });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'sicaf-client-data') {
    pageState.clientData = msg.data;
    pageState.loggedIn = true;
    broadcastToSidePanel({ type: 'client-data', data: msg.data });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'get-state') {
    sendResponse({ ok: true, state: pageState, apiBaseUrl });
    return true;
  }

  // Contexto da página SICAF atualizado pelo content script
  if (msg.type === 'sicaf-page-context') {
    sicafPageContext = msg.context || sicafPageContext;
    sendResponse({ ok: true });
    return true;
  }

  // Pedir contexto fresco ao content script (on-demand, no momento do envio da mensagem)
  if (msg.type === 'get-fresh-page-context') {
    if (!sicafTabId) {
      sendResponse({ ok: true, context: sicafPageContext });
      return true;
    }
    chrome.tabs.sendMessage(sicafTabId, { type: 'get-page-context' }).then((res) => {
      if (res?.ok && res.context) {
        sicafPageContext = res.context;
      }
      sendResponse({ ok: true, context: sicafPageContext });
    }).catch(() => {
      sendResponse({ ok: true, context: sicafPageContext });
    });
    return true; // resposta assíncrona
  }

  if (msg.type === 'open-sicaf') {
    openSICAF();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'sicaf-detected') {
    const tabId = sender.tab?.id;
    if (tabId) {
      sicafTabId = tabId;
      pageState.step = 'sicaf_home';
      pageState.url = msg.url || '';
    }
    sendResponse({ ok: true });
    return true;
  }

  // Botão flutuante clicado no SICAF → abrir side panel
  if (msg.type === 'user-open-sidepanel') {
    if (sender.tab?.windowId) {
      openAssistantSurface(sender.tab).catch(() => {});
    }
    sendResponse({ ok: true });
    return true;
  }

  // Side panel informa que carregou
  if (msg.type === 'sidepanel-loaded') {
    if (sicafTabId) notifyContentScript(sicafTabId, 'panel-opened');
    sendResponse({ ok: true });
    return true;
  }

  // Side panel informa que vai fechar
  if (msg.type === 'sidepanel-closing') {
    if (sicafTabId) notifyContentScript(sicafTabId, 'panel-closed');
    sendResponse({ ok: true });
    return true;
  }

  // ── PDF capturado pelo content script → encaminhar ao side panel (chat) ──
  if (msg.type === 'pdf-captured') {
    console.log('[CadBrasil] PDF capturado pelo content script:', msg.fileName, `(${(msg.size / 1024).toFixed(1)} KB)`);
    broadcastToSidePanel({
      type: 'pdf-captured',
      fileName: msg.fileName,
      base64: msg.base64,
      size: msg.size,
    });
    sendResponse({ ok: true });
    return true;
  }

  // ── Comandos do servidor (repassados pelo sidepanel via postMessage) ──
  if (msg.type === 'execute-command') {
    handleCommand(msg.command, msg.param).then((result) => {
      sendResponse({ ok: true, result });
    }).catch((err) => {
      console.log('[CadBrasil] Erro executando comando:', err.message);
      sendResponse({ ok: false, error: err.message });
    });
    return true; // resposta assíncrona
  }

  return true;
});

// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA DE COMANDOS INVISÍVEIS
// Recebe comandos do servidor (via chat IA → React → sidepanel → aqui)
// e executa ações na aba SICAF sem mostrar nada no chat.
// ═══════════════════════════════════════════════════════════════════════════
async function handleCommand(command, param) {
  console.log(`[CadBrasil CMD] ${command}: ${param}`);

  switch (command) {
    // ── redirect: navega a aba SICAF para uma URL ──
    case 'redirect': {
      if (!param) return { error: 'URL não informada' };
      const tabId = await ensureSicafTab();
      await chrome.tabs.update(tabId, { url: param, active: true });
      console.log(`[CadBrasil CMD] Redirect → ${param}`);
      return { redirected: param };
    }

    // ── click: clica em um elemento na página SICAF via selector CSS ──
    case 'click': {
      if (!sicafTabId) return { error: 'Aba SICAF não encontrada' };
      await chrome.tabs.sendMessage(sicafTabId, {
        type: 'execute-page-command',
        command: 'click',
        param,
      });
      return { clicked: param };
    }

    // ── fill: preenche campo na página SICAF (selector|value) ──
    case 'fill': {
      if (!sicafTabId) return { error: 'Aba SICAF não encontrada' };
      await chrome.tabs.sendMessage(sicafTabId, {
        type: 'execute-page-command',
        command: 'fill',
        param,
      });
      return { filled: param };
    }

    // ── highlight: destaca um elemento na página SICAF ──
    case 'highlight': {
      if (!sicafTabId) return { error: 'Aba SICAF não encontrada' };
      await chrome.tabs.sendMessage(sicafTabId, {
        type: 'execute-page-command',
        command: 'highlight',
        param,
      });
      return { highlighted: param };
    }

    // ── scroll: scrolla até um elemento na página SICAF ──
    case 'scroll': {
      if (!sicafTabId) return { error: 'Aba SICAF não encontrada' };
      await chrome.tabs.sendMessage(sicafTabId, {
        type: 'execute-page-command',
        command: 'scroll',
        param,
      });
      return { scrolled: param };
    }

    // ── alert: mostra notificação no badge da extensão ──
    case 'alert': {
      if (sicafTabId) {
        chrome.action.setBadgeText({ text: '!', tabId: sicafTabId });
        chrome.action.setBadgeBackgroundColor({ color: '#ff4444', tabId: sicafTabId });
        // Restaurar badge após 5s
        setTimeout(() => {
          if (sicafTabId) {
            chrome.action.setBadgeText({ text: 'IA', tabId: sicafTabId });
            chrome.action.setBadgeBackgroundColor({ color: '#238636', tabId: sicafTabId });
          }
        }, 5000);
      }
      return { alerted: param };
    }

    // ── action: ações SICAF existentes (clicar_nivel_1, abrir_crc, etc.) ──
    case 'action': {
      if (!sicafTabId) return { error: 'Aba SICAF não encontrada' };

      // Fluxos complexos gerenciados pelo background (não dependem de sessionStorage)
      if (param === 'abrir_situacao_fornecedor') {
        orchestrateSituacaoFornecedor(); // fire-and-forget
        return { action: param, flowStarted: true };
      }

      await chrome.tabs.sendMessage(sicafTabId, {
        type: 'execute-page-command',
        command: 'action',
        param,
      });
      return { action: param };
    }

    // ── newtab: abre URL em nova aba ──
    case 'newtab': {
      if (!param) return { error: 'URL não informada' };
      await chrome.tabs.create({ url: param, active: false });
      return { opened: param };
    }

    // ── screenshot: captura screenshot da aba SICAF ──
    case 'screenshot': {
      if (!sicafTabId) return { error: 'Aba SICAF não encontrada' };
      const tab = await chrome.tabs.get(sicafTabId);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      return { screenshot: dataUrl };
    }

    default:
      console.log(`[CadBrasil CMD] Comando desconhecido: ${command}`);
      return { error: `Comando desconhecido: ${command}` };
  }
}

/**
 * Garante que existe uma aba SICAF aberta, criando uma se necessário.
 */
async function ensureSicafTab() {
  if (sicafTabId) {
    try {
      await chrome.tabs.get(sicafTabId);
      return sicafTabId;
    } catch (_) {
      sicafTabId = null;
    }
  }
  const tab = await chrome.tabs.create({ url: SICAF_URL, active: true });
  sicafTabId = tab.id;
  return tab.id;
}

// ── Abrir SICAF em nova aba ──
async function openSICAF(token) {
  if (token) {
    await chrome.storage.local.set({ authToken: token });
  }

  if (sicafTabId) {
    try {
      const tab = await chrome.tabs.get(sicafTabId);
      if (tab) {
        await chrome.tabs.update(sicafTabId, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
        return;
      }
    } catch (_) {
      sicafTabId = null;
    }
  }

  const tab = await chrome.tabs.create({ url: SICAF_URL, active: true });
  sicafTabId = tab.id;
  pageState.step = 'sicaf_home';
  pageState.url = SICAF_URL;
}

// ── Abrir assistente em janela popup ao lado do SICAF ──
let assistantWindowId = null;

async function openAssistantWindow(sicafTab) {
  // Se já está aberta, focar
  if (assistantWindowId) {
    try {
      await chrome.windows.update(assistantWindowId, { focused: true });
      console.log('[CadBrasil] Janela do assistente focada');
      return;
    } catch (_) {
      assistantWindowId = null;
    }
  }

  // Pegar tamanho da tela para posicionar à direita
  const tab = typeof sicafTab === 'number' ? await chrome.tabs.get(sicafTab) : null;
  let left = 0, top = 0, width = 420, height = 700;

  if (tab && tab.windowId) {
    try {
      const win = await chrome.windows.get(tab.windowId);
      // Posicionar à direita da janela do SICAF
      left = (win.left || 0) + (win.width || 1200) - 10;
      top = win.top || 0;
      height = win.height || 700;
    } catch (_) {}
  }

  const assistantUrl = chrome.runtime.getURL('sidepanel.html');
  const win = await chrome.windows.create({
    url: assistantUrl,
    type: 'popup',
    width: width,
    height: height,
    left: left,
    top: top,
  });

  assistantWindowId = win.id;
  console.log('[CadBrasil] Janela do assistente aberta:', win.id);
}

// Limpar referência quando janela do assistente fecha
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === assistantWindowId) {
    assistantWindowId = null;
    console.log('[CadBrasil] Janela do assistente fechada');
  }
});

// ── Monitorar fechamento de abas ──
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === sicafTabId) {
    sicafTabId = null;
    pageState = { step: 'idle', url: '', clientData: null, loggedIn: false };
    broadcastToSidePanel({ type: 'sicaf-closed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FLUXOS COMPLEXOS ORQUESTRADOS PELO BACKGROUND
// O background.js não morre durante navegação — ideal para fluxos multi-etapa.
// ═══════════════════════════════════════════════════════════════════════════

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Espera até a aba completar o carregamento (status: 'complete').
 */
function waitForTabLoad(tabId, timeoutMs) {
  const timeout = timeoutMs || 20000;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timeout esperando aba carregar'));
    }, timeout);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Envia um comando de clique ao content script com retentativas.
 * Retorna true se clicou, false se falhou.
 */
async function sendClickToTab(tabId, selector, retries) {
  const maxRetries = retries || 6;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'execute-page-command',
        command: 'click',
        param: selector,
      });
      if (res?.ok && res?.result?.clicked) {
        console.log(`[CadBrasil Flow] Click OK: "${selector}" (tentativa ${attempt})`);
        return true;
      }
      console.log(`[CadBrasil Flow] Click não encontrou: "${selector}" (tentativa ${attempt}/${maxRetries})`);
    } catch (err) {
      console.log(`[CadBrasil Flow] Click erro: "${selector}" (tentativa ${attempt}/${maxRetries}):`, err.message);
    }
    if (attempt < maxRetries) await _sleep(1500);
  }
  return false;
}

/**
 * Fluxo completo: Situação do Fornecedor
 * Orquestrado pelo background para não depender de sessionStorage.
 *
 * 1. Navegar para a página
 * 2. Clicar em Pesquisar (após page load + delay)
 * 3. Clicar em "Situação Fornecedor" / detalhar (após resultado)
 * 4. content.js intercepta o PDF e envia de volta
 */
async function orchestrateSituacaoFornecedor() {
  try {
    const SICAF = 'https://www3.comprasnet.gov.br';
    const targetUrl = SICAF + '/sicaf-web/private/geral/consultarSituacaoFornecedor.jsf';

    // ── Passo 0: Garantir aba SICAF ──
    const tabId = sicafTabId || await ensureSicafTab();

    // ── Passo 1: Navegar (sempre forçar reload, mesmo se já estiver na página) ──
    console.log('[CadBrasil Flow] Situação Fornecedor → navegando...');
    broadcastFlowProgress('Navegando para Situação do Fornecedor...');

    // Verificar se já está na página — se sim, forçar reload
    const currentTab = await chrome.tabs.get(tabId);
    const alreadyOnPage = currentTab.url && currentTab.url.includes('consultarSituacaoFornecedor');

    if (alreadyOnPage) {
      // Forçar reload adicionando timestamp para evitar cache
      await chrome.tabs.update(tabId, { url: targetUrl + '?_t=' + Date.now(), active: true });
    } else {
      await chrome.tabs.update(tabId, { url: targetUrl, active: true });
    }
    await waitForTabLoad(tabId);
    // Esperar content script inicializar + JSF renderizar
    await _sleep(3000);

    // ── Passo 2: Clicar em Pesquisar (#barraBotao button — mesmo padrão dos níveis) ──
    console.log('[CadBrasil Flow] Clicando em Pesquisar...');
    broadcastFlowProgress('Clicando em Pesquisar...');

    const searchClicked = await sendClickToTab(tabId, '#barraBotao button', 8);
    if (!searchClicked) {
      broadcastFlowProgress('Erro: Botão Pesquisar não encontrado.', true);
      return;
    }

    // Esperar resultado da pesquisa (JSF AJAX update)
    await _sleep(3000);

    // ── Passo 3: Ativar captura de requests + interceptador de PDF ANTES de clicar ──
    console.log('[CadBrasil Flow] Ativando captura de requests (webRequest) + interceptador de PDF...');
    broadcastFlowProgress('Preparando para capturar PDF...');

    // Iniciar captura de requests via webRequest (para replay posterior)
    startRequestCapture();

    // Ativar interceptador no content script (page world) como estratégia adicional
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'start-pdf-intercept' });
    } catch (_) {
      console.log('[CadBrasil Flow] Aviso: start-pdf-intercept não respondido (esperado)');
    }

    // Monitorar chrome.downloads para detectar e replay o PDF
    startDownloadMonitor();

    await _sleep(500);

    // ── Passo 4: Clicar em "Situação Fornecedor" (link detalhar com PrimeFaces onclick) ──
    console.log('[CadBrasil Flow] Clicando em Situação Fornecedor...');
    broadcastFlowProgress('Clicando em Situação do Fornecedor...');

    const detailClicked = await sendClickToTab(tabId, '#form\\:fornecedores\\:0\\:detalharLink', 8);
    if (!detailClicked) {
      broadcastFlowProgress('Erro: Link Situação Fornecedor não encontrado.', true);
      return;
    }

    broadcastFlowProgress('Aguardando PDF da Situação do Fornecedor...');
    console.log('[CadBrasil Flow] Fluxo completo. Aguardando PDF do content script...');

  } catch (err) {
    console.log('[CadBrasil Flow] Erro fatal:', err.message);
    broadcastFlowProgress('Erro no fluxo: ' + err.message, true);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PDF CAPTURE — webRequest + chrome.downloads + replay
// ══════════════════════════════════════════════════════════════════════════

/**
 * Cache de requests recentes capturados por webRequest.onBeforeRequest.
 * Guardamos URL, method e requestBody para replay posterior.
 */
let _capturedRequests = [];
let _webRequestListener = null;

/**
 * Inicia a captura de requests via webRequest para poder fazer replay do POST
 * que gera o PDF do PrimeFaces.
 */
function startRequestCapture() {
  // Remover listener anterior se existir
  if (_webRequestListener) {
    try { chrome.webRequest.onBeforeRequest.removeListener(_webRequestListener); } catch (_) {}
  }
  _capturedRequests = [];

  _webRequestListener = function (details) {
    // Capturar apenas POST (PrimeFaces usa POST para downloads)
    if (details.method === 'POST') {
      _capturedRequests.push({
        url: details.url,
        method: details.method,
        requestBody: details.requestBody,
        type: details.type,
        timestamp: Date.now(),
      });
      // Manter apenas os últimos 20
      if (_capturedRequests.length > 20) _capturedRequests.shift();
      console.log('[CadBrasil WebReq] POST capturado:', details.url.substring(0, 120), 'type:', details.type);
    }
  };

  chrome.webRequest.onBeforeRequest.addListener(
    _webRequestListener,
    { urls: ['https://www3.comprasnet.gov.br/*', 'https://*.comprasnet.gov.br/*'] },
    ['requestBody']
  );
  console.log('[CadBrasil WebReq] Captura de requests ativada');
}

/**
 * Para a captura de requests.
 */
function stopRequestCapture() {
  if (_webRequestListener) {
    try { chrome.webRequest.onBeforeRequest.removeListener(_webRequestListener); } catch (_) {}
    _webRequestListener = null;
  }
}

/**
 * Monitora chrome.downloads para detectar PDF baixado.
 * Quando detectado, usa os dados capturados por webRequest para fazer
 * replay do POST e obter o PDF real no service worker.
 */
function startDownloadMonitor() {
  let downloadDetected = false;

  function onCreated(item) {
    const isPdf = (item.mime && item.mime.includes('pdf')) ||
                  (item.filename && item.filename.toLowerCase().endsWith('.pdf')) ||
                  (item.url && item.url.toLowerCase().includes('.pdf'));
    if (isPdf && !downloadDetected) {
      downloadDetected = true;
      const downloadId = item.id;
      const downloadUrl = item.url;
      console.log('[CadBrasil Flow] Download PDF detectado via chrome.downloads:', item.filename || downloadUrl, 'id:', downloadId, 'size:', item.fileSize);
      broadcastFlowProgress('PDF detectado! Aguardando download concluir...');

      // Monitorar quando o download terminar
      function onChange(delta) {
        if (delta.id !== downloadId) return;
        if (delta.state && delta.state.current === 'complete') {
          chrome.downloads.onChanged.removeListener(onChange);
          console.log('[CadBrasil Flow] Download PDF concluído. Tentando replay do POST...');
          broadcastFlowProgress('PDF baixado! Capturando conteúdo...');

          // Aguardar 1s e depois tentar replay
          setTimeout(async () => {
            await replayAndCapturePdf(downloadId, downloadUrl);
          }, 1000);
        }
        if (delta.state && delta.state.current === 'interrupted') {
          chrome.downloads.onChanged.removeListener(onChange);
          console.log('[CadBrasil Flow] Download PDF interrompido');
          broadcastFlowProgress('Download do PDF falhou.', true);
        }
      }
      chrome.downloads.onChanged.addListener(onChange);
    }
  }

  chrome.downloads.onCreated.addListener(onCreated);

  // Remover listener após 60s
  setTimeout(() => {
    chrome.downloads.onCreated.removeListener(onCreated);
  }, 60000);
}

/**
 * Tenta fazer replay do POST que gerou o PDF, lendo a resposta no service worker.
 * O service worker tem acesso aos cookies via host_permissions.
 *
 * Se o replay falhar, notifica o usuário para upload manual.
 */
async function replayAndCapturePdf(downloadId, downloadUrl) {
  try {
    const items = await chrome.downloads.search({ id: downloadId });
    if (!items || !items.length) {
      broadcastFlowProgress('Erro: Download não encontrado.', true);
      return;
    }

    const item = items[0];
    const filename = item.filename;
    const shortName = filename ? filename.split(/[/\\]/).pop() : 'SituacaoFornecedor.pdf';

    // ── Tentar replay do POST com dados capturados pelo webRequest ──
    // Procurar o request que corresponde à URL do download
    let matchingReq = _capturedRequests.find(r => r.url === downloadUrl);

    // Se não encontrou por URL exata, procurar o POST mais recente que é sub_frame ou outro
    if (!matchingReq) {
      // Procurar qualquer POST recente para SICAF que possa ser o download
      matchingReq = [..._capturedRequests].reverse().find(r =>
        r.url.includes('comprasnet.gov.br') &&
        r.requestBody &&
        r.requestBody.formData
      );
    }

    if (matchingReq && matchingReq.requestBody) {
      console.log('[CadBrasil Flow] Request match encontrado! URL:', matchingReq.url.substring(0, 120));
      console.log('[CadBrasil Flow] Tipo:', matchingReq.type, '| FormData keys:', matchingReq.requestBody.formData ? Object.keys(matchingReq.requestBody.formData).length : 0);

      const pdfBase64 = await replayPostRequest(matchingReq);
      if (pdfBase64) {
        console.log('[CadBrasil Flow] PDF capturado via replay!', shortName, '(' + (pdfBase64.length / 1370).toFixed(0) + ' KB aprox)');
        broadcastFlowProgress(`PDF "${shortName}" capturado com sucesso!`);
        stopRequestCapture();

        broadcastToSidePanel({
          type: 'pdf-captured',
          base64: 'data:application/pdf;base64,' + pdfBase64,
          fileName: shortName,
          size: Math.round(pdfBase64.length * 3 / 4), // tamanho estimado em bytes
        });
        return;
      }
    } else {
      console.log('[CadBrasil Flow] Nenhum request match encontrado nos', _capturedRequests.length, 'requests capturados');
      console.log('[CadBrasil Flow] URLs capturadas:', _capturedRequests.map(r => r.url.substring(0, 80)));
    }

    // ── Fallback: tentar fetch direto da URL do download (pode funcionar se for GET) ──
    console.log('[CadBrasil Flow] Tentando fetch direto da URL:', downloadUrl.substring(0, 120));
    try {
      const directResp = await fetch(downloadUrl, { credentials: 'include' });
      if (directResp.ok) {
        const ct = (directResp.headers.get('Content-Type') || '').toLowerCase();
        if (ct.includes('pdf') || ct.includes('octet-stream')) {
          const buf = await directResp.arrayBuffer();
          const b64 = arrayBufferToBase64(buf);
          if (b64.startsWith('JVBER')) {
            console.log('[CadBrasil Flow] PDF capturado via fetch direto!', (buf.byteLength / 1024).toFixed(1), 'KB');
            broadcastFlowProgress(`PDF "${shortName}" capturado com sucesso!`);
            stopRequestCapture();

            broadcastToSidePanel({
              type: 'pdf-captured',
              base64: 'data:application/pdf;base64,' + b64,
              fileName: shortName,
              size: buf.byteLength,
            });
            return;
          }
        }
      }
    } catch (fetchErr) {
      console.log('[CadBrasil Flow] Fetch direto falhou:', fetchErr.message);
    }

    // ── Fallback final: pedir upload manual ──
    console.log('[CadBrasil Flow] Replay e fetch direto falharam. Pedindo upload manual:', shortName);
    broadcastFlowProgress(`PDF "${shortName}" baixado. Por favor, envie pelo botão 📎.`);
    stopRequestCapture();

    broadcastToSidePanel({
      type: 'pdf-downloaded',
      fileName: shortName,
      filePath: filename,
    });

  } catch (err) {
    console.log('[CadBrasil Flow] Erro ao capturar PDF:', err.message);
    broadcastFlowProgress('Erro ao processar PDF: ' + err.message, true);
    stopRequestCapture();
  }
}

/**
 * Faz replay de um POST capturado e retorna o base64 do PDF (ou null se falhar).
 */
async function replayPostRequest(reqInfo) {
  try {
    let body;

    if (reqInfo.requestBody.formData) {
      // Reconstruir o form data como URL-encoded
      const params = new URLSearchParams();
      for (const [key, values] of Object.entries(reqInfo.requestBody.formData)) {
        if (Array.isArray(values)) {
          for (const val of values) {
            params.append(key, val);
          }
        } else {
          params.append(key, values);
        }
      }
      body = params.toString();
    } else if (reqInfo.requestBody.raw) {
      // Raw body (menos comum)
      const parts = reqInfo.requestBody.raw.map(p => {
        if (p.bytes) return new Uint8Array(p.bytes);
        return new Uint8Array(0);
      });
      const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
      const combined = new Uint8Array(totalLen);
      let offset = 0;
      for (const part of parts) {
        combined.set(part, offset);
        offset += part.length;
      }
      body = combined;
    }

    if (!body) {
      console.log('[CadBrasil Flow] Replay: sem body para enviar');
      return null;
    }

    console.log('[CadBrasil Flow] Replay POST para:', reqInfo.url.substring(0, 120));

    const response = await fetch(reqInfo.url, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      credentials: 'include',
    });

    console.log('[CadBrasil Flow] Replay status:', response.status, 'Content-Type:', response.headers.get('Content-Type'));

    if (!response.ok) {
      console.log('[CadBrasil Flow] Replay falhou com HTTP', response.status);
      return null;
    }

    const ct = (response.headers.get('Content-Type') || '').toLowerCase();
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    // Validar magic bytes: %PDF- em base64 = JVBER
    if (!base64.startsWith('JVBER')) {
      console.log('[CadBrasil Flow] Replay: resposta NÃO é PDF (magic bytes ausentes). Tipo:', ct, 'Size:', arrayBuffer.byteLength);
      // Mostrar primeiros bytes para debug
      const preview = base64.substring(0, 50);
      console.log('[CadBrasil Flow] Replay: primeiros bytes base64:', preview);
      return null;
    }

    console.log('[CadBrasil Flow] Replay: PDF válido!', (arrayBuffer.byteLength / 1024).toFixed(1), 'KB');
    return base64;

  } catch (err) {
    console.log('[CadBrasil Flow] Replay erro:', err.message);
    return null;
  }
}

/**
 * Converte ArrayBuffer para string Base64.
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Envia progresso do fluxo para o sidepanel → chat (para debug).
 */
function broadcastFlowProgress(message, isError) {
  broadcastToSidePanel({
    type: 'flow-progress',
    message: message,
    isError: isError || false,
  });
}

function broadcastToSidePanel(data) {
  chrome.runtime.sendMessage(data).catch(() => {});
}

function notifyContentScript(tabId, type) {
  chrome.tabs.sendMessage(tabId, { type }).catch(() => {});
}

// Side panel habilitado por padrão, mas desabilitado em abas não-SICAF
//sidePanelApi?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});

console.log('[CadBrasil Extension] Service worker iniciado');
