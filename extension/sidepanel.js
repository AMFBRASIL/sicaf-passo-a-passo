/**
 * CadBrasil Extension — Side Panel (shell fino)
 * Carrega o chat real via iframe do servidor CadBrasil.
 * Atualizações no chat não exigem atualizar a extensão.
 */

const PROD_URL = 'https://fornecedor.cadbrasil.com.br';
const DEV_URLS = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081'];
const CHAT_PATHS = ['/sicaf-assistant-chat', '/sicaf-assistant'];
const CNPJ_ACCESS_STORAGE_KEY = 'cadbrasilAssistantAccess';
const CNPJ_API_KEY_FALLBACK = 'cb_3NoTgyV6CTQBANgwi1RFx96uQCd25ObG4WhHfXSuyuA';
const CNPJ_ACCESS_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const CADASTRO_PORTAL_URL = 'https://cadastro.cadbrasil.com.br';
const FORNECEDOR_PORTAL_URL = 'https://fornecedor.cadbrasil.com.br';
const LOCAL_VERBOSE_DEBUG = true;

function isDevUrl(url) {
  return DEV_URLS.some(d => url.startsWith(d)) ||
         /localhost|127\.0\.0\.1/i.test(url);
}

async function detectDevServer() {
  const checks = DEV_URLS.map(async (devUrl) => {
    const res = await fetch(devUrl + CHAT_PATHS[0], { method: 'HEAD', signal: AbortSignal.timeout(1500) });
    if (res.ok) return devUrl;
    throw new Error('not ok');
  });

  const results = await Promise.allSettled(checks);
  const found = results.find(r => r.status === 'fulfilled');
  return found ? found.value : null;
}

function normalizeBaseUrl(rawBaseUrl) {
  if (!rawBaseUrl) return '';
  try {
    const parsed = new URL(rawBaseUrl);
    return parsed.origin;
  } catch (_) {
    return rawBaseUrl.replace(/\/+$/, '');
  }
}

async function resolveChatPath(baseUrl) {
  for (const path of CHAT_PATHS) {
    try {
      const res = await fetch(baseUrl + path, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
      // 2xx/3xx/401/403/405 indicam rota existente (pode exigir auth ou não aceitar HEAD)
      if ((res.status >= 200 && res.status < 400) || res.status === 401 || res.status === 403 || res.status === 405) {
        return path;
      }
    } catch (_) {
      // tenta próxima rota
    }
  }
  return CHAT_PATHS[0];
}

async function init() {
  const frame = document.getElementById('chatFrame');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const gate = document.getElementById('cnpjGate');
  const gateMsg = document.getElementById('cnpjGateMsg');
  const gateLinks = document.getElementById('cnpjGateLinks');
  const cnpjInput = document.getElementById('cnpjInput');
  const cnpjValidateBtn = document.getElementById('cnpjValidateBtn');
  const cnpjClearBtn = document.getElementById('cnpjClearBtn');

  function normalizeCnpj(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatCnpj(value) {
    const d = normalizeCnpj(value).slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function setGateMessage(message, ok = false) {
    gateMsg.textContent = message || '';
    gateMsg.classList.toggle('ok', !!ok);
  }

  function showRegularizeLinks(show) {
    if (!gateLinks) return;
    gateLinks.style.display = show ? 'flex' : 'none';
  }

  function lockChat() {
    frame.classList.add('locked');
    gate.style.display = 'flex';
  }

  function unlockChat() {
    frame.classList.remove('locked');
    gate.style.display = 'none';
    setGateMessage('');
    showRegularizeLinks(false);
  }

  const stored = await chrome.storage.local.get(['authToken', 'apiBaseUrl', CNPJ_ACCESS_STORAGE_KEY, 'cnpjConsultaApiKey']);
  const token = stored.authToken || '';
  const hintedBaseUrl = normalizeBaseUrl((stored.apiBaseUrl || '').trim());

  // Prioridade: se LOCAL estiver online, usar LOCAL.
  // Fallback para URL do portal e por último produção.
  let baseUrl = PROD_URL;
  const devServer = await detectDevServer();
  if (devServer) {
    baseUrl = devServer;
  } else if (hintedBaseUrl) {
    baseUrl = hintedBaseUrl;
  }

  const isDebug = isDevUrl(baseUrl);
  const env = isDebug ? 'development' : 'production';
  const debugEnabled = isDebug && LOCAL_VERBOSE_DEBUG;
  const dbg = (...args) => { if (debugEnabled) console.log('[CadBrasil SidePanel][DEBUG]', ...args); };

  await chrome.storage.local.set({ detectedEnv: env, resolvedBaseUrl: baseUrl });

  console.log(`[CadBrasil SidePanel] Ambiente: ${env.toUpperCase()} | URL: ${baseUrl}`);
  dbg('Storage inicial carregado:', {
    hasToken: !!token,
    hasApiBaseUrl: !!stored.apiBaseUrl,
    hasCachedAccess: !!stored[CNPJ_ACCESS_STORAGE_KEY],
    hasCnpjApiKey: !!stored.cnpjConsultaApiKey,
  });

  const chatPath = await resolveChatPath(baseUrl);
  const chatUrl = baseUrl + chatPath + (token ? '?token=' + encodeURIComponent(token) : '');

  frame.src = chatUrl;
  frame.style.display = 'block';
  lockChat();
  dbg('Chat URL resolvida:', chatUrl);

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

  async function validateAndUnlock(rawCnpj) {
    const cnpj = normalizeCnpj(rawCnpj);
    dbg('Iniciando validação CNPJ:', { rawCnpj, normalized: cnpj });
    if (cnpj.length !== 14) {
      setGateMessage('Informe um CNPJ válido com 14 dígitos.');
      dbg('CNPJ inválido (tamanho).');
      return;
    }

    cnpjValidateBtn.disabled = true;
    cnpjValidateBtn.textContent = 'Validando...';
    setGateMessage('');

    try {
      const apiKey = String(stored.cnpjConsultaApiKey || CNPJ_API_KEY_FALLBACK || '').trim();
      const headers = {};
      if (apiKey) headers['x-api-key'] = apiKey;

      const res = await fetch(`${baseUrl}/api/clients/consulta-cnpj?cnpj=${encodeURIComponent(cnpj)}`, {
        method: 'GET',
        headers,
      });

      let data = {};
      try { data = await res.json(); } catch (_) {}
      dbg('Retorno API /api/clients/consulta-cnpj:', {
        httpStatus: res.status,
        ok: res.ok,
        payload: data,
      });

      if (!res.ok || !data?.ok) {
        setGateMessage(data?.error || `Falha ao validar CNPJ (HTTP ${res.status}).`);
        showRegularizeLinks(false);
        dbg('Falha validação API:', { status: res.status, body: data });
        return;
      }

      const autorizado = !!(
        data.sicafValido ||
        data.possuiRenovacao ||
        data.possuiManutencao ||
        data.cadastroValido
      );

      if (!autorizado) {
        const motivo = 'Cliente sem elegibilidade ativa (SICAF válido, renovação ou manutenção ativa).';
        setGateMessage(
          `${motivo} Escolha uma opção abaixo para continuar.`
        );
        showRegularizeLinks(true);
        dbg('Cliente não autorizado:', {
          sicafValido: !!data.sicafValido,
          possuiRenovacao: !!data.possuiRenovacao,
          possuiManutencao: !!data.possuiManutencao,
          cadastroValido: !!data.cadastroValido,
        });
        return;
      }

      const cache = {
        cnpj,
        doc: formatCnpj(cnpj),
        documento: formatCnpj(cnpj),
        razaoSocial: data.razaoSocial || null,
        autorizado: true,
        sicafValido: !!data.sicafValido,
        possuiRenovacao: !!data.possuiRenovacao,
        possuiManutencao: !!data.possuiManutencao,
        cadastroValido: !!data.cadastroValido,
        validatedAt: Date.now(),
        expiresAt: Date.now() + CNPJ_ACCESS_TTL_MS,
      };

      await chrome.storage.local.set({ [CNPJ_ACCESS_STORAGE_KEY]: cache });
      dbg('Cache salvo com sucesso:', cache);

      // Envia o contexto do cliente para o chat remoto.
      frame.contentWindow?.postMessage({
        source: 'cadbrasil-extension',
        type: 'client-data',
        data: cache,
      }, '*');

      setGateMessage('Validação concluída. Chat liberado.', true);
      showRegularizeLinks(false);
      unlockChat();
      dbg('Chat liberado.');
    } catch (err) {
      setGateMessage(`Erro na validação: ${err.message || 'erro desconhecido'}`);
      dbg('Exceção na validação:', err);
    } finally {
      cnpjValidateBtn.disabled = false;
      cnpjValidateBtn.textContent = 'Validar e liberar chat';
    }
  }

  cnpjInput.addEventListener('input', () => {
    cnpjInput.value = formatCnpj(cnpjInput.value);
  });

  cnpjInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      validateAndUnlock(cnpjInput.value);
    }
  });

  cnpjValidateBtn.addEventListener('click', () => validateAndUnlock(cnpjInput.value));
  cnpjClearBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove(CNPJ_ACCESS_STORAGE_KEY);
    cnpjInput.value = '';
    setGateMessage('Cache limpo. Informe o CNPJ para liberar o chat.');
    showRegularizeLinks(false);
    lockChat();
    dbg('Cache removido manualmente pelo usuário.');
  });

  const cachedAccess = stored[CNPJ_ACCESS_STORAGE_KEY];
  const cacheExpiresAt = Number(
    cachedAccess?.expiresAt
    || ((cachedAccess?.validatedAt ? Number(cachedAccess.validatedAt) : 0) + CNPJ_ACCESS_TTL_MS)
  );
  const cacheIsValid = !!(
    cachedAccess?.autorizado &&
    normalizeCnpj(cachedAccess?.cnpj).length === 14 &&
    Number.isFinite(cacheExpiresAt) &&
    Date.now() < cacheExpiresAt
  );

  if (cacheIsValid) {
    dbg('Cache válido encontrado. Liberando chat automaticamente.');
    cnpjInput.value = formatCnpj(cachedAccess.cnpj);
    frame.contentWindow?.postMessage({
      source: 'cadbrasil-extension',
      type: 'client-data',
      data: {
        ...cachedAccess,
        doc: cachedAccess.doc || formatCnpj(cachedAccess.cnpj),
        documento: cachedAccess.documento || formatCnpj(cachedAccess.cnpj),
      },
    }, '*');
    unlockChat();
  } else {
    dbg('Cache ausente/expirado. Mantendo chat bloqueado.', {
      cacheExists: !!cachedAccess,
      cacheExpiresAt,
      now: Date.now(),
    });
    if (cachedAccess) {
      await chrome.storage.local.remove(CNPJ_ACCESS_STORAGE_KEY);
      setGateMessage('Validação expirada (12h). Informe o CNPJ novamente.');
      showRegularizeLinks(false);
      dbg('Cache expirado removido automaticamente.');
    }
    lockChat();
  }

  // ── Escutar comandos vindos do iframe (React chat) ──
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.source !== 'cadbrasil-chat') return;

    // Comandos do chat para a extensão
    if (msg.type === 'extension-commands' && Array.isArray(msg.commands)) {
      if (isDebug) console.log('[CadBrasil SidePanel] Recebido', msg.commands.length, 'comando(s):', msg.commands);
      dbg('Mensagem do iframe (extension-commands):', msg);

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
      dbg('Iframe solicitou contexto de página.');
      chrome.runtime.sendMessage({ type: 'get-fresh-page-context' }).then((res) => {
        frame.contentWindow?.postMessage({
          source: 'cadbrasil-extension',
          type: 'page-context-response',
          context: res?.context || { url: '', pageText: '', title: '', formData: [] },
        }, '*');
        if (isDebug) console.log('[CadBrasil SidePanel] Contexto enviado ao chat:', res?.context?.url);
        dbg('Contexto enviado:', res?.context);
      }).catch(() => {
        dbg('Falha ao obter contexto fresco da página.');
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
    dbg('Mensagem recebida do background:', msg?.type);
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
  dbg('Evento sidepanel-loaded enviado ao background.');
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
