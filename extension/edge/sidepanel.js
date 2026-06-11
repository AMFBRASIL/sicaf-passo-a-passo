/**
 * CadBrasil Extension — Side Panel (shell fino)
 * Carrega o chat real via iframe do servidor CadBrasil.
 * Atualizações no chat não exigem atualizar a extensão.
 */

const PROD_URL = 'https://fornecedor.cadbrasil.com.br';
const DEV_URLS = ['http://localhost:8080'];
const CHAT_PATH = '/sicaf-assistant-chat';

function isDevUrl(url) {
  return DEV_URLS.some(d => url.startsWith(d)) ||
         /localhost|127\.0\.0\.1/i.test(url);
}

async function detectDevServer() {
  const checks = DEV_URLS.map(async (devUrl) => {
    const res = await fetch(devUrl + CHAT_PATH, { method: 'HEAD', signal: AbortSignal.timeout(1500) });
    if (res.ok) return devUrl;
    throw new Error('not ok');
  });

  const results = await Promise.allSettled(checks);
  const found = results.find(r => r.status === 'fulfilled');
  return found ? found.value : null;
}

async function init() {
  const frame = document.getElementById('chatFrame');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');

  const stored = await chrome.storage.local.get(['authToken', 'apiBaseUrl']);
  const token = stored.authToken || '';
  const hintedBaseUrl = (stored.apiBaseUrl || '').trim();

  // Em produção, usar SEMPRE a URL enviada pelo portal.
  // Só tenta detectar localhost quando o próprio portal já for dev.
  let baseUrl = PROD_URL;
  if (hintedBaseUrl) {
    if (isDevUrl(hintedBaseUrl)) {
      const devServer = await detectDevServer();
      baseUrl = devServer || hintedBaseUrl;
    } else {
      baseUrl = hintedBaseUrl;
    }
  }

  const isDebug = isDevUrl(baseUrl);
  const env = isDebug ? 'development' : 'production';

  await chrome.storage.local.set({ detectedEnv: env, resolvedBaseUrl: baseUrl });

  console.log(`[CadBrasil SidePanel] Ambiente: ${env.toUpperCase()} | URL: ${baseUrl}`);

  const chatUrl = baseUrl + CHAT_PATH + (token ? '?token=' + encodeURIComponent(token) : '');

  frame.src = chatUrl;
  frame.style.display = 'block';

  frame.addEventListener('load', () => {
    loading.style.display = 'none';
    error.style.display = 'none';
  });

  frame.addEventListener('error', () => {
    loading.style.display = 'none';
    error.style.display = 'block';
  });

  setTimeout(() => {
    if (loading.style.display !== 'none') {
      loading.style.display = 'none';
      error.style.display = 'block';
    }
  }, 10000);

  // ── Escutar comandos vindos do iframe (React chat) ──
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.source !== 'cadbrasil-chat') return;

    // Comandos do chat para a extensão
    if (msg.type === 'extension-commands' && Array.isArray(msg.commands)) {
      if (isDebug) console.log('[CadBrasil SidePanel] Recebido', msg.commands.length, 'comando(s):', msg.commands);

      for (const cmd of msg.commands) {
        chrome.runtime.sendMessage({
          type: 'execute-command',
          command: cmd.type,
          param: cmd.param,
        }).then((response) => {
          if (isDebug) {
            console.log(`[CadBrasil SidePanel] Resultado ${cmd.type}:`, response);
            frame.contentWindow?.postMessage({
              source: 'cadbrasil-extension',
              type: 'command-result',
              command: cmd.type,
              param: cmd.param,
              result: response?.result || response,
              error: response?.ok === false ? (response.error || 'Falha') : null,
            }, '*');
          }
        }).catch((err) => {
          if (isDebug) {
            console.error(`[CadBrasil SidePanel] Erro ${cmd.type}:`, err);
            frame.contentWindow?.postMessage({
              source: 'cadbrasil-extension',
              type: 'command-result',
              command: cmd.type,
              param: cmd.param,
              error: err.message || 'Erro desconhecido',
            }, '*');
          }
        });
      }
    }

    // Chat pediu o contexto fresco da página SICAF (on-demand, a cada mensagem)
    if (msg.type === 'request-page-context') {
      chrome.runtime.sendMessage({ type: 'get-fresh-page-context' }).then((res) => {
        frame.contentWindow?.postMessage({
          source: 'cadbrasil-extension',
          type: 'page-context-response',
          context: res?.context || { url: '', pageText: '', title: '', formData: [] },
        }, '*');
        if (isDebug) console.log('[CadBrasil SidePanel] Contexto enviado ao chat:', res?.context?.url);
      }).catch(() => {
        frame.contentWindow?.postMessage({
          source: 'cadbrasil-extension',
          type: 'page-context-response',
          context: { url: '', pageText: '', title: '', formData: [] },
        }, '*');
      });
    }
  });

  // ── Escutar mensagens vindas do background (PDF capturado, progresso de fluxo) ──
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'pdf-captured') {
      if (isDebug) console.log('[CadBrasil SidePanel] PDF recebido do background:', msg.fileName, `(${(msg.size / 1024).toFixed(1)} KB)`);
      frame.contentWindow?.postMessage({
        source: 'cadbrasil-extension',
        type: 'pdf-captured',
        fileName: msg.fileName,
        base64: msg.base64,
        size: msg.size,
      }, '*');
    }

    // Progresso do fluxo orquestrado pelo background (Situação Fornecedor, etc.)
    if (msg.type === 'flow-progress') {
      if (isDebug) console.log('[CadBrasil SidePanel] Flow:', msg.message);
      frame.contentWindow?.postMessage({
        source: 'cadbrasil-extension',
        type: 'flow-progress',
        message: msg.message,
        isError: msg.isError || false,
      }, '*');
    }

    // CNPJ/dados do cliente detectados na página SICAF
    if (msg.type === 'client-data') {
      if (isDebug) console.log('[CadBrasil SidePanel] Client data:', msg.data);
      frame.contentWindow?.postMessage({
        source: 'cadbrasil-extension',
        type: 'client-data',
        data: msg.data,
      }, '*');
    }

    // PDF baixado pelo browser (Situação Fornecedor) — pedir ao usuário para enviar
    if (msg.type === 'pdf-downloaded') {
      if (isDebug) console.log('[CadBrasil SidePanel] PDF baixado:', msg.fileName);
      frame.contentWindow?.postMessage({
        source: 'cadbrasil-extension',
        type: 'pdf-downloaded',
        fileName: msg.fileName,
        filePath: msg.filePath,
      }, '*');
    }
  });

  // Informar background que o painel abriu
  chrome.runtime.sendMessage({ type: 'sidepanel-loaded' }).catch(() => {});
}

// Informar background quando fechar
window.addEventListener('beforeunload', () => {
  chrome.runtime.sendMessage({ type: 'sidepanel-closing' }).catch(() => {});
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    chrome.runtime.sendMessage({ type: 'sidepanel-closing' }).catch(() => {});
  } else {
    chrome.runtime.sendMessage({ type: 'sidepanel-loaded' }).catch(() => {});
  }
});

init();
