/**
 * CadBrasil Extension — Content Script
 * Injetado nas páginas do SICAF (comprasnet.gov.br)
 *
 * 1. Detecta o estado da página e envia para o background
 * 2. Injeta botão flutuante "Assistente IA" para o usuário abrir o side panel
 */

(function () {
  'use strict';

  let lastStep = '';
  let lastClientData = null;
  let panelOpen = false;

  // ── Mostrar/esconder botão flutuante ──
  function showFab() {
    const btn = document.getElementById('cadbrasil-fab-btn');
    if (btn) btn.style.display = 'flex';
  }

  function hideFab() {
    const btn = document.getElementById('cadbrasil-fab-btn');
    if (btn) btn.style.display = 'none';
  }

  // ── Escutar mensagens do background (painel abriu/fechou + comandos) ──
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'panel-opened') {
      panelOpen = true;
      hideFab();
    }
    if (msg.type === 'panel-closed') {
      panelOpen = false;
      showFab();
    }

    // ── Background pede contexto fresco da página (on-demand) ──
    if (msg.type === 'get-page-context') {
      const ctx = extractPageContext();
      sendResponse({ ok: true, context: ctx });
      return true;
    }

    // ── Comandos vindos do servidor (via background) ──
    if (msg.type === 'execute-page-command') {
      try {
        const result = executePageCommand(msg.command, msg.param);
        sendResponse({ ok: true, result });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
      return true;
    }

    // ── Background pede para buscar PDF por URL (fallback do chrome.downloads) ──
    if (msg.type === 'fetch-and-send-pdf') {
      fetchAndSendPdf(msg.url, msg.fileName || 'SituacaoFornecedor.pdf')
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    // ── Background pede para ativar interceptador de PDF ──
    if (msg.type === 'start-pdf-intercept') {
      interceptPdfDownload();
      sendResponse({ ok: true, intercepting: true });
      return true;
    }

    // ── Background pede para rodar fluxo Situação Fornecedor (fallback) ──
    if (msg.type === 'run-situacao-flow') {
      runSituacaoFornecedorFlow();
      sendResponse({ ok: true, started: true });
      return true;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTOR DE COMANDOS NA PÁGINA SICAF
  // Recebe comandos do background.js e manipula a página diretamente.
  // ═══════════════════════════════════════════════════════════════════════════
  function executePageCommand(command, param) {
    console.log(`[CadBrasil CMD:page] ${command}: ${param}`);

    switch (command) {
      // ── click: clicar em elemento por CSS selector ou texto ──
      case 'click': {
        let el = document.querySelector(param);
        // Se não achou por selector, tentar por texto visível
        if (!el) {
          const allElements = document.querySelectorAll('a, button, input[type="submit"], span, td, li');
          for (const candidate of allElements) {
            if (candidate.textContent && candidate.textContent.trim().toLowerCase().includes(param.toLowerCase())) {
              el = candidate;
              break;
            }
          }
        }
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Flash visual antes de clicar
          flashElement(el);
          setTimeout(() => el.click(), 300);
          return { clicked: true, text: el.textContent?.substring(0, 50) };
        }
        return { clicked: false, error: 'Elemento não encontrado: ' + param };
      }

      // ── fill: preencher campo (selector|valor) ──
      case 'fill': {
        const sepIndex = param.indexOf('|');
        if (sepIndex < 0) return { error: 'Formato: selector|valor' };
        const selector = param.substring(0, sepIndex).trim();
        const value = param.substring(sepIndex + 1).trim();
        const input = document.querySelector(selector);
        if (input) {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          flashElement(input);
          input.focus();
          input.value = value;
          // Disparar eventos para frameworks (JSF, React, etc.)
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
          return { filled: true, selector, value };
        }
        return { filled: false, error: 'Campo não encontrado: ' + selector };
      }

      // ── highlight: destacar elemento com borda verde ──
      case 'highlight': {
        const el = document.querySelector(param);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          flashElement(el, 3000);
          return { highlighted: true };
        }
        return { highlighted: false, error: 'Elemento não encontrado' };
      }

      // ── scroll: rolar até um elemento ──
      case 'scroll': {
        const el = document.querySelector(param);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          flashElement(el);
          return { scrolled: true };
        }
        return { scrolled: false, error: 'Elemento não encontrado' };
      }

      // ── action: ações SICAF pré-definidas (clicar em menus/níveis) ──
      case 'action': {
        return executeSicafAction(param);
      }

      default:
        return { error: 'Comando desconhecido: ' + command };
    }
  }

  // ── Flash visual num elemento (borda verde pulsante) ──
  function flashElement(el, duration) {
    if (!el) return;
    const ms = duration || 1500;
    const orig = el.style.cssText;
    el.style.outline = '3px solid #238636';
    el.style.outlineOffset = '2px';
    el.style.transition = 'outline 0.3s ease';
    el.style.boxShadow = '0 0 15px rgba(35, 134, 54, 0.6)';
    setTimeout(() => {
      el.style.cssText = orig;
    }, ms);
  }

  // ── Ações SICAF pré-definidas (compatível com sistema existente) ──
  const SICAF_BASE = 'https://www3.comprasnet.gov.br';

  function executeSicafAction(actionName) {
    console.log(`[CadBrasil Action] ${actionName}`);

    // Mapa de ações → navegação direta por URL do SICAF + pós-ações
    const actionMap = {
      'clicar_nivel_1': () => navigateAndAction('/sicaf-web/private/credenciamento/manterNivel1.jsf'),
      'clicar_nivel_2': () => navigateAndAction('/sicaf-web/private/niveis/manterNivel2.jsf'),
      'clicar_nivel_3': () => navigateAndAction('/sicaf-web/private/niveis/manterNivel3.jsf'),
      'clicar_nivel_4': () => navigateAndAction('/sicaf-web/private/niveis/manterNivel4.jsf'),
      'clicar_nivel_5': () => navigateAndAction('/sicaf-web/private/niveis/manterNivel5.jsf'),
      'clicar_nivel_6': () => navigateAndAction('/sicaf-web/private/niveis/manterNivel6.jsf'),
      'abrir_crc': () => navigateAndAction('/sicaf-web/private/consultas/consultarCRC.jsf'),
      // abrir_situacao_fornecedor agora é orquestrado pelo background.js (fluxo multi-etapa)
      'abrir_situacao_fornecedor': () => { return true; },
      'navegar_consulta': () => clickByText('Consulta'),
      'navegar_seguranca': () => clickByText('Segurança'),
      'navegar_sicaf': () => { window.location.href = SICAF_BASE + '/sicaf-web/index.jsf'; return true; },
      'atualizar_sicaf': () => { location.reload(); return true; },
    };

    const actionFn = actionMap[actionName];
    if (actionFn) {
      const result = actionFn();
      return { action: actionName, executed: !!result };
    }
    return { action: actionName, error: 'Ação desconhecida' };
  }

  /**
   * Mapa de pós-ações: executadas automaticamente quando a página correspondente carrega.
   * Chave = trecho da URL, Valor = função a executar após delay.
   */
  const POST_NAVIGATION_ACTIONS = {
    // Todos os níveis e CRC usam o botão da barra superior (#barraBotao button)
    'manterNivel1.jsf': () => waitAndClick('#barraBotao button', 2000),
    'manterNivel2.jsf': () => waitAndClick('#barraBotao button', 2000),
    'manterNivel3.jsf': () => waitAndClick('#barraBotao button', 2000),
    'manterNivel4.jsf': () => waitAndClick('#barraBotao button', 2000),
    'manterNivel5.jsf': () => waitAndClick('#barraBotao button', 2000),
    'manterNivel6.jsf': () => waitAndClick('#barraBotao button', 2000),
    'consultarCRC.jsf': () => waitAndClick('#barraBotao button', 2000),
    // Situação do Fornecedor é orquestrado pelo background.js
    'consultarSituacaoFornecedor.jsf': () => runSituacaoFornecedorFlow(),
  };

  /**
   * Navega para uma URL do SICAF.
   * Se houver pós-ações, salva o identificador no sessionStorage.
   */
  function navigateAndAction(path) {
    const url = SICAF_BASE + path;
    console.log(`[CadBrasil Action] Navegando → ${url}`);

    // Verificar se tem pós-ação para esta URL
    for (const key of Object.keys(POST_NAVIGATION_ACTIONS)) {
      if (path.includes(key)) {
        sessionStorage.setItem('cadbrasil_post_action', JSON.stringify({
          key: key,
          timestamp: Date.now(),
        }));
        break;
      }
    }

    window.location.href = url;
    return true;
  }

  /**
   * Aguarda um tempo e clica em um elemento por selector.
   * Tenta várias vezes caso o elemento ainda não esteja no DOM.
   */
  function waitAndClick(selector, delayMs, maxRetries) {
    const delay = delayMs || 2000;
    const retries = maxRetries || 5;
    let attempt = 0;

    function tryClick() {
      attempt++;
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashElement(el);
        setTimeout(() => {
          el.click();
          console.log(`[CadBrasil Action] waitAndClick OK: "${selector}" (tentativa ${attempt})`);
        }, 300);
        return;
      }
      if (attempt < retries) {
        console.log(`[CadBrasil Action] waitAndClick: elemento "${selector}" não encontrado, tentativa ${attempt}/${retries}`);
        setTimeout(tryClick, 1000);
      } else {
        console.log(`[CadBrasil Action] waitAndClick FALHOU: "${selector}" após ${retries} tentativas`);
      }
    }

    setTimeout(tryClick, delay);
  }

  /**
   * Fluxo completo: Situação do Fornecedor
   * 1. Clicar em Pesquisar (2s)
   * 2. Clicar em "Situação Fornecedor" (1s após pesquisa)
   * 3. Interceptar o PDF gerado e enviar ao chat
   */
  function runSituacaoFornecedorFlow() {
    console.log('[CadBrasil Action] Iniciando fluxo Situação do Fornecedor...');

    // Passo 1: Clicar em Pesquisar (#barraBotao button — padrão para todas as páginas)
    waitAndClickThen(
      '#barraBotao button',
      2000,
      () => {
        console.log('[CadBrasil Action] Pesquisa clicada, aguardando resultado...');

        // Passo 2: Clicar em "Situação Fornecedor" (link detalhar PrimeFaces)
        waitAndClickThen(
          '#form\\:fornecedores\\:0\\:detalharLink',
          1000,
          () => {
            console.log('[CadBrasil Action] Detalhar clicado, aguardando PDF...');

            // Passo 3: Interceptar o download do PDF
            interceptPdfDownload();
          }
        );
      }
    );
  }

  /**
   * waitAndClick com callback após o clique ser bem-sucedido.
   */
  function waitAndClickThen(selector, delayMs, onSuccess) {
    const delay = delayMs || 2000;
    const maxRetries = 8;
    let attempt = 0;

    function tryClick() {
      attempt++;
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashElement(el);
        setTimeout(() => {
          el.click();
          console.log(`[CadBrasil Action] waitAndClickThen OK: "${selector}" (tentativa ${attempt})`);
          // Executar callback após um delay para a página processar
          if (onSuccess) setTimeout(onSuccess, 1500);
        }, 300);
        return;
      }
      if (attempt < maxRetries) {
        console.log(`[CadBrasil Action] waitAndClickThen: "${selector}" não encontrado, tentativa ${attempt}/${maxRetries}`);
        setTimeout(tryClick, 1000);
      } else {
        console.log(`[CadBrasil Action] waitAndClickThen FALHOU: "${selector}" após ${maxRetries} tentativas`);
      }
    }

    setTimeout(tryClick, delay);
  }

  /**
   * Intercepta download de PDF na página SICAF.
   *
   * IMPORTANTE: Os interceptores precisam rodar no PAGE WORLD (não no isolated world
   * do content script) porque o PrimeFaces/JSF faz requests no contexto da página.
   *
   * Estratégias cobertas:
   * 1. Override HTMLFormElement.prototype.submit — PrimeFaces usa form submit → iframe oculto
   * 2. Override window.open — caso abra PDF em nova janela
   * 3. Override PrimeFaces.download — se existir
   * 4. MutationObserver para iframes novos (no content script world)
   * 5. Listener de postMessage para receber o PDF capturado do page world
   */
  function interceptPdfDownload() {
    console.log('[CadBrasil Action] Ativando interceptador de PDF (page world + content world)...');

    // ── Injetar pageworld.js no MAIN world via chrome.scripting (CSP-safe) ──
    chrome.runtime.sendMessage({ type: 'inject-pageworld' });

    /* ── BLOCO INLINE REMOVIDO — todo o código de interceptação foi movido para pageworld.js ──
          if (_captured) return;
          // Validar magic bytes do PDF (%PDF-) antes de enviar
          // base64 é data URL: data:application/pdf;base64,JVBER...
          // %PDF- em base64 = JVBER
          var b64Part = base64.split(',')[1] || '';
          if (!b64Part.startsWith('JVBER')) {
            console.log('[CadBrasil PageWorld] Conteúdo NÃO é PDF (magic bytes ausentes). Ignorando. Size:', size);
            return;
          }
          _captured = true;
          console.log('[CadBrasil PageWorld] ✅ PDF válido capturado! (' + (size/1024).toFixed(1) + ' KB)');
          window.postMessage({
            source: 'cadbrasil-pdf-intercept',
            base64: base64,
            fileName: fileName || 'SituacaoFornecedor.pdf',
            size: size
          }, '*');
        }

        function blobToBase64(blob, fileName) {
          var reader = new FileReader();
          reader.onload = function() {
            sendCapturedPdf(reader.result, fileName, blob.size);
          };
          reader.readAsDataURL(blob);
        }

        // ── LOG: Monitorar o que proximoPasso() faz ──
        if (typeof window.proximoPasso === 'function') {
          var _origProximoPasso = window.proximoPasso;
          window.proximoPasso = function() {
            console.log('[CadBrasil PageWorld] 🔍 proximoPasso() chamado!');
            // Monitorar temporariamente location changes
            var curHref = window.location.href;
            setTimeout(function() {
              if (window.location.href !== curHref) {
                console.log('[CadBrasil PageWorld] 🔍 proximoPasso mudou location para:', window.location.href);
              }
            }, 500);
            return _origProximoPasso.apply(this, arguments);
          };
          console.log('[CadBrasil PageWorld] proximoPasso() interceptado para logging');
        } else {
          console.log('[CadBrasil PageWorld] proximoPasso() não existe ainda (será definido pelo AJAX?)');
        }

        // ── Estratégia 1: Override form.submit() — PrimeFaces download via iframe ──
        var _origSubmit = HTMLFormElement.prototype.submit;
        HTMLFormElement.prototype.submit = function() {
          var form = this;
          console.log('[CadBrasil PageWorld] 🔍 form.submit() chamado! action:', form.action ? form.action.substring(0, 100) : '(vazio)', 'target:', form.target || '(nenhum)', 'id:', form.id || '(sem id)');

          // PrimeFaces file download submits to a hidden iframe
          if (form.target && !_captured) {
            console.log('[CadBrasil PageWorld] Form com target detectado! Procurando iframe:', form.target);
            var targetFrame = document.querySelector('iframe[name="' + form.target + '"]');
            if (targetFrame) {
              console.log('[CadBrasil PageWorld] ✅ Form submit to iframe:', form.action, 'target:', form.target);
              console.log('[CadBrasil PageWorld] Form fields:', form.elements.length, 'method:', form.method);

              // NÃO fazer replay XHR aqui (o background.js fará via webRequest replay).
              // Apenas logar que o submit aconteceu — o download real será capturado pelo
              // chrome.downloads + webRequest no background.js.
            }
          }
          return _origSubmit.call(form);
        };

        // ── Estratégia 2: Override window.open — PDF aberto em nova janela ──
        var _origOpen = window.open;
        window.open = function(url, target, features) {
          console.log('[CadBrasil PageWorld] 🔍 window.open chamado! url:', url ? String(url).substring(0, 100) : '(vazio)');
          if (url && !_captured) {
            var urlStr = String(url).toLowerCase();
            if (urlStr.includes('pdf') || urlStr.includes('download') || urlStr.includes('report') ||
                urlStr.includes('dynamiccontent') || urlStr.includes('javax.faces.resource')) {
              console.log('[CadBrasil PageWorld] window.open PDF detectado:', url);
              try {
                var xhr = new XMLHttpRequest();
                xhr.responseType = 'blob';
                xhr.open('GET', url, true);
                xhr.onload = function() {
                  if (xhr.response && xhr.response.size > 100) {
                    blobToBase64(xhr.response, 'SituacaoFornecedor.pdf');
                  }
                };
                xhr.send();
              } catch(e) {}
            }
          }
          return _origOpen.apply(this, arguments);
        };

        // ── Estratégia 3: Override PrimeFaces.download (se existir) ──
        if (typeof PrimeFaces !== 'undefined') {
          // Override PrimeFaces.download se existir
          if (PrimeFaces.download) {
            var _origPFDownload = PrimeFaces.download;
            PrimeFaces.download = function(url, mimeType, fileName) {
              console.log('[CadBrasil PageWorld] ✅ PrimeFaces.download chamado! url:', url, 'mime:', mimeType, 'file:', fileName);
              if (!_captured) {
                try {
                  var xhr = new XMLHttpRequest();
                  xhr.responseType = 'blob';
                  // PrimeFaces.download usa POST, não GET!
                  var dlForm = document.createElement('form');
                  dlForm.method = 'POST';
                  dlForm.action = url;
                  // Adicionar ViewState
                  var vs = document.querySelector('input[name="javax.faces.ViewState"]');
                  if (vs) {
                    var vsInput = document.createElement('input');
                    vsInput.type = 'hidden';
                    vsInput.name = 'javax.faces.ViewState';
                    vsInput.value = vs.value;
                    dlForm.appendChild(vsInput);
                  }
                  var formData = new FormData(dlForm);
                  xhr.open('POST', url, true);
                  xhr.onload = function() {
                    var ct = (xhr.getResponseHeader('Content-Type') || '').toLowerCase();
                    console.log('[CadBrasil PageWorld] PrimeFaces.download XHR response:', ct, 'size:', xhr.response ? xhr.response.size : 0);
                    if (xhr.response && (ct.includes('pdf') || ct.includes('octet-stream'))) {
                      blobToBase64(xhr.response, fileName || 'SituacaoFornecedor.pdf');
                    }
                  };
                  xhr.send(formData);
                } catch(e) {
                  console.log('[CadBrasil PageWorld] PrimeFaces.download XHR erro:', e.message);
                }
              }
              return _origPFDownload.apply(this, arguments);
            };
            console.log('[CadBrasil PageWorld] PrimeFaces.download overridden');
          } else {
            console.log('[CadBrasil PageWorld] PrimeFaces existe mas .download não está definido');
            // Definir getter para capturar quando for criado
            var _pfDesc = Object.getOwnPropertyDescriptor(PrimeFaces, 'download');
            if (!_pfDesc || _pfDesc.configurable) {
              var _realDownload = null;
              Object.defineProperty(PrimeFaces, 'download', {
                get: function() { return _realDownload; },
                set: function(fn) {
                  console.log('[CadBrasil PageWorld] PrimeFaces.download definido! Interceptando...');
                  _realDownload = function(url, mimeType, fileName) {
                    console.log('[CadBrasil PageWorld] ✅ PrimeFaces.download (lazy) chamado! url:', url);
                    return fn.apply(this, arguments);
                  };
                },
                configurable: true
              });
            }
          }
        }

        // ── Estratégia 4: Override fetch no page world (caso use fetch API) ──
        var _origFetch = window.fetch;
        window.fetch = function(input, init) {
          var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
          console.log('[CadBrasil PageWorld] 🔍 fetch chamado:', url.substring(0, 100));
          var promise = _origFetch.apply(this, arguments);
          if (!_captured) {
            promise.then(function(response) {
              var ct = (response.headers.get('Content-Type') || '').toLowerCase();
              if (ct.includes('pdf') || ct.includes('octet-stream')) {
                console.log('[CadBrasil PageWorld] fetch retornou PDF!', url, ct);
                response.clone().blob().then(function(blob) {
                  if (blob.size > 500) blobToBase64(blob, 'SituacaoFornecedor.pdf');
                });
              }
            }).catch(function() {});
          }
          return promise;
        };

        // ── Estratégia 5: Override XHR no page world ──
        var _origXHROpen = XMLHttpRequest.prototype.open;
        var _origXHRSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url) {
          this._cbd_url = url;
          this._cbd_method = method;
          return _origXHROpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function() {
          var self = this;
          this.addEventListener('load', function() {
            if (_captured) return;
            var ct = (self.getResponseHeader('Content-Type') || '').toLowerCase();
            if (ct.includes('pdf') || ct.includes('octet-stream')) {
              console.log('[CadBrasil PageWorld] XHR PDF detectado:', self._cbd_url, ct, 'size:', self.response ? (self.response.size || self.response.byteLength || 0) : 0);
              var blob = self.response instanceof Blob
                ? self.response
                : new Blob([self.response], { type: ct || 'application/pdf' });
              if (blob.size > 500) blobToBase64(blob, 'SituacaoFornecedor.pdf');
            }
          });
          return _origXHRSend.apply(this, arguments);
        };

        // Cleanup após 45s
        setTimeout(function() {
          HTMLFormElement.prototype.submit = _origSubmit;
          window.open = _origOpen;
          window.fetch = _origFetch;
          XMLHttpRequest.prototype.open = _origXHROpen;
          XMLHttpRequest.prototype.send = _origXHRSend;
          console.log('[CadBrasil PageWorld] Interceptadores de PDF removidos (timeout 45s)');
        }, 45000);
      })();
    `;
    (document.head || document.documentElement).appendChild(pageScript);
    pageScript.remove();
    ── FIM DO BLOCO INLINE REMOVIDO ── */

    // ── Listener no content world: receber PDF capturado do page world via postMessage ──
    function onPdfMessage(event) {
      if (event.data && event.data.source === 'cadbrasil-pdf-intercept') {
        window.removeEventListener('message', onPdfMessage);
        observer.disconnect();
        console.log('[CadBrasil Action] PDF recebido do page world:', event.data.fileName, `(${(event.data.size / 1024).toFixed(1)} KB)`);

        chrome.runtime.sendMessage({
          type: 'pdf-captured',
          fileName: event.data.fileName,
          base64: event.data.base64,
          size: event.data.size,
        }).catch((e) => console.log('[CadBrasil Action] Erro ao enviar PDF:', e.message));
      }
    }
    window.addEventListener('message', onPdfMessage);

    // ── Estratégia 5 (content world): MutationObserver para qualquer iframe/object novo ──
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          // Detectar iframes que podem conter PDF (PrimeFaces cria iframes para download)
          if (node.tagName === 'IFRAME' || node.tagName === 'OBJECT' || node.tagName === 'EMBED') {
            const src = node.src || node.data || '';
            console.log('[CadBrasil Action] Novo iframe/object detectado:', node.tagName, src ? src.substring(0, 100) : '(sem src)');
            // Se tem src que parece PDF ou resource, tentar capturar
            if (src && src.length > 5) {
              setTimeout(() => {
                fetchAndSendPdf(src, 'SituacaoFornecedor.pdf');
              }, 500);
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout geral
    setTimeout(() => {
      window.removeEventListener('message', onPdfMessage);
      observer.disconnect();
      console.log('[CadBrasil Action] Timeout geral de interceptação (45s)');
    }, 45000);
  }

  /**
   * Busca PDF de uma URL e envia ao chat (content script world).
   */
  async function fetchAndSendPdf(url, fileName) {
    try {
      const response = await fetch(url, { credentials: 'include' });
      const ct = (response.headers.get('Content-Type') || '').toLowerCase();
      if (!ct.includes('pdf') && !ct.includes('octet-stream')) {
        console.log('[CadBrasil Action] URL não retornou PDF:', ct);
        return;
      }
      const blob = await response.blob();
      if (blob.size < 500) return; // muito pequeno para ser PDF
      sendPdfToChat(blob, fileName);
    } catch (e) {
      console.log('[CadBrasil Action] Erro ao buscar PDF:', e.message);
    }
  }

  /**
   * Converte blob PDF para base64 e envia para a extensão → sidepanel → chat.
   */
  function sendPdfToChat(blob, fileName) {
    console.log(`[CadBrasil Action] Enviando PDF ao chat: ${fileName} (${(blob.size / 1024).toFixed(1)} KB)`);

    const reader = new FileReader();
    reader.onload = function () {
      const base64 = reader.result; // data:application/pdf;base64,...
      chrome.runtime.sendMessage({
        type: 'pdf-captured',
        fileName: fileName,
        base64: base64,
        size: blob.size,
      }).catch((e) => console.log('[CadBrasil Action] Erro ao enviar PDF:', e.message));
    };
    reader.readAsDataURL(blob);
  }

  /**
   * Executar pós-ações salvas no sessionStorage após navegação.
   * Chamado na inicialização do content script.
   */
  function runPendingActions() {
    try {
      const raw = sessionStorage.getItem('cadbrasil_post_action');
      if (!raw) return;
      sessionStorage.removeItem('cadbrasil_post_action');

      const pending = JSON.parse(raw);
      // Só executar se foi salvo há menos de 15 segundos
      if (Date.now() - pending.timestamp > 15000) return;

      const actionFn = POST_NAVIGATION_ACTIONS[pending.key];
      if (actionFn) {
        console.log(`[CadBrasil Action] Executando pós-ação para: ${pending.key}`);
        actionFn();
      }
    } catch (e) {
      console.log('[CadBrasil Action] Erro ao executar pós-ação:', e.message);
    }
  }

  // ── Helper: clicar em elemento que contém texto ──
  function clickByText(text) {
    const lower = text.toLowerCase();
    const candidates = document.querySelectorAll('a, button, span, td, li, div[role="menuitem"], [class*="menu"], [class*="nivel"], [class*="link"]');
    for (const el of candidates) {
      const content = (el.textContent || '').trim().toLowerCase();
      if (content.includes(lower)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashElement(el);
        setTimeout(() => el.click(), 300);
        console.log(`[CadBrasil Action] Clicou em: "${el.textContent.trim().substring(0, 40)}"`);
        return true;
      }
    }
    console.log(`[CadBrasil Action] Texto não encontrado: "${text}"`);
    return false;
  }

  // ── Injetar botão flutuante do assistente ──
  function injectFloatingButton() {
    if (document.getElementById('cadbrasil-fab')) return;

    const fab = document.createElement('div');
    fab.id = 'cadbrasil-fab';
    fab.innerHTML = `
      <style>
        #cadbrasil-fab-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 99999;
          background: linear-gradient(135deg, #1a7f37, #238636);
          color: #fff;
          border: none;
          border-radius: 50px;
          padding: 14px 22px;
          font-size: 14px;
          font-weight: 700;
          font-family: system-ui, sans-serif;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(35, 134, 54, 0.5);
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
          animation: cadbrasil-pulse 3s ease-in-out infinite;
        }
        #cadbrasil-fab-btn:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 6px 30px rgba(35, 134, 54, 0.7);
        }
        @keyframes cadbrasil-pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(35, 134, 54, 0.5); }
          50% { box-shadow: 0 4px 30px rgba(35, 134, 54, 0.8); }
        }
        #cadbrasil-fab-badge {
          background: #ff4444;
          color: #fff;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          top: -4px;
          right: -4px;
          animation: cadbrasil-badge-bounce 1s ease-in-out infinite;
        }
        @keyframes cadbrasil-badge-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      </style>
      <button id="cadbrasil-fab-btn">
        🟢 Assistente CadBrasil
        <span id="cadbrasil-fab-badge">IA</span>
      </button>
    `;
    document.body.appendChild(fab);

    document.getElementById('cadbrasil-fab-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'user-open-sidepanel' });
    });

    // Se o painel já estiver aberto, esconder o botão
    if (panelOpen) hideFab();
  }

  // ── Detecção de estado ──
  function detectState() {
    const url = window.location.href;
    const text = document.body?.innerText || '';
    let step = 'unknown';
    let clientData = null;

    if (url.includes('sicaf-web/index.jsf') && (text.includes('Entrar com gov.br') || text.includes('Bem-vindo ao SICAF'))) {
      step = 'sicaf_home';
    } else if (url.includes('acesso.gov.br')) {
      step = url.includes('/login') ? 'gov_login' : 'captcha';
    } else if (url.includes('sicaf-web') && (text.includes('Credenciamento') || text.includes('Fornecedor') || text.includes('Nível'))) {
      step = 'dashboard';
      try {
        // CNPJ exclusivamente do input cnpjPesquisa (telas de Nível 1-6)
        const cnpjInput = document.querySelector('input[id*="cnpjPesquisa"]');
        if (cnpjInput && cnpjInput.value) {
          clientData = { nome: '', doc: cnpjInput.value.trim() };
          const nomeEl = document.querySelector('[id*="razaoSocial"], [id*="nomeEmpresa"], .dados-fornecedor .nome');
          if (nomeEl) clientData.nome = nomeEl.textContent?.trim() || '';
        }
      } catch (_) {}
    } else if (url.includes('sicaf-web') && text.includes('Certificado de Registro Cadastral')) {
      step = 'crc';
    } else if (url.includes('sicaf-web') && text.includes('Situação do Fornecedor')) {
      step = 'situacao_fornecedor';
    } else if (url.includes('sicaf-web') || url.includes('comprasnet.gov.br/sicaf')) {
      step = 'sicaf_page';
    }

    return { step, url, clientData };
  }

  // ── Extrair contexto visível da página SICAF (chamado on-demand pelo background) ──
  function extractPageContext() {
    const url = window.location.href;

    // ── 1. Dados do fornecedor/pessoa no topo (nome, CPF/CNPJ) ──
    // Tentar múltiplos seletores usados pelas diferentes páginas do SICAF
    let fornecedorInfo = '';
    // Capturar pelo div[title="Identificação do Usuário"] — estável, não muda com IDs JSF
    let clientName = '';
    let clientDoc = '';
    let clientRole = '';
    const userDiv = document.querySelector('div[title="Identificação do Usuário"]');
    if (userDiv) {
      const nome = userDiv.querySelector('.usuario_nome');
      const cpf = userDiv.querySelector('.usuario_cpf');
      const funcao = userDiv.querySelector('.usuario_funcao');
      if (nome) clientName = nome.textContent.trim();
      if (cpf) clientDoc = cpf.textContent.trim();
      if (funcao) clientRole = funcao.textContent.trim();
      const parts = [];
      if (clientName) parts.push(clientName);
      if (clientDoc) parts.push(clientDoc);
      if (clientRole) parts.push(clientRole);
      if (parts.length) fornecedorInfo = parts.join(' - ');
    }

    // Fallback: tentar outros seletores caso o header não exista
    if (!fornecedorInfo) {
      const fallbackSelectors = [
        '.dados-fornecedor',
        '[id*="dadosFornecedor"]',
        '[id*="dadosPessoa"]',
      ];
      for (const sel of fallbackSelectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            const text = el.innerText.trim();
            if (text && text.length > 5) { fornecedorInfo = text; break; }
          }
        } catch (_) { /* pular */ }
      }
    }

    // ── 2. Buscar nome/CPF/CNPJ por padrão no corpo da página (fallback) ──
    if (!fornecedorInfo || fornecedorInfo.length < 10) {
      const bodyText = document.body?.innerText || '';
      // CPF: 000.000.000-00
      const cpfMatch = bodyText.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
      // CNPJ: 00.000.000/0000-00
      const cnpjMatch = bodyText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
      const doc = cpfMatch ? cpfMatch[1] : (cnpjMatch ? cnpjMatch[1] : '');

      // Procurar nome próximo ao documento (geralmente na mesma linha ou acima)
      if (doc) {
        const docIdx = bodyText.indexOf(doc);
        // Pegar até 200 caracteres antes do doc para capturar o nome
        const contextStart = Math.max(0, docIdx - 200);
        const contextEnd = Math.min(bodyText.length, docIdx + doc.length + 100);
        const nearDoc = bodyText.substring(contextStart, contextEnd).trim();
        // Pegar linhas ao redor do documento
        const lines = nearDoc.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        fornecedorInfo = lines.join('\n');
      }
    }

    // ── 3. Conteúdo principal da página (painéis, tabelas, resultados) ──
    let mainText = '';
    const contentSelectors = [
      '.ui-datatable tbody',                       // Tabelas de dados
      '.ui-panel-content',                         // Conteúdo de painéis
      '[id*="resultado"]',                         // Resultados de pesquisa
      '[id*="detalhe"]',                           // Detalhes
      'form',                                      // Formulário principal
    ];
    for (const sel of contentSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.innerText.trim();
          if (text && text.length > 20 && text.length > mainText.length) {
            mainText = text;
          }
        }
      } catch (_) { /* pular */ }
    }

    // Fallback: todo o body (limitado)
    if (!mainText && !fornecedorInfo) {
      mainText = (document.body?.innerText || '').substring(0, 2000);
    }

    // Combinar informações do fornecedor + conteúdo principal
    const parts = [];
    if (fornecedorInfo) parts.push(fornecedorInfo);
    if (mainText && mainText !== fornecedorInfo) parts.push(mainText);
    const pageText = parts.join('\n\n');

    // ── 4. Título da página ──
    const titleSelectors = ['.titulo-pagina', '.ui-panel-title', 'h1', 'h2', '.breadcrumb', 'title'];
    let titleText = '';
    for (const sel of titleSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const t = el.innerText?.trim() || el.textContent?.trim() || '';
          if (t && t.length > 3) { titleText = t; break; }
        }
      } catch (_) { /* pular */ }
    }

    // ── 5. Dados de formulário visíveis (campos preenchidos) ──
    const formData = [];
    document.querySelectorAll('label').forEach((label) => {
      const forId = label.getAttribute('for');
      if (forId) {
        const input = document.getElementById(forId);
        if (input && input.value) {
          formData.push(`${label.innerText.trim()}: ${input.value}`);
        }
      }
    });

    // Também pegar spans de "output" do JSF (campos read-only)
    document.querySelectorAll('.ui-outputlabel + .ui-outputtext, span[id*="output"], span[id*="valor"]').forEach((span) => {
      const text = span.innerText?.trim();
      const prev = span.previousElementSibling;
      if (text && prev) {
        const label = prev.innerText?.trim();
        if (label) formData.push(`${label}: ${text}`);
      }
    });

    return {
      url,
      clientName,
      clientDoc,
      clientRole,
      pageText: pageText.substring(0, 3000),
      title: titleText.substring(0, 200),
      formData: formData.slice(0, 30),
    };
  }

  function report() {
    const state = detectState();
    if (state.step !== lastStep) {
      lastStep = state.step;
      chrome.runtime.sendMessage({ type: 'sicaf-state', state });
    }
    if (state.clientData && JSON.stringify(state.clientData) !== JSON.stringify(lastClientData)) {
      lastClientData = state.clientData;
      chrome.runtime.sendMessage({ type: 'sicaf-client-data', data: state.clientData });
    }
  }

  // ── Iniciar ──
  chrome.runtime.sendMessage({ type: 'sicaf-detected', url: window.location.href });
  injectFloatingButton();
  report();
  setInterval(report, 3000);

  // Executar ações pendentes de uma navegação anterior (ex: clicar_nivel_3 → pesquisar)
  runPendingActions();

  const observer = new MutationObserver(() => {
    setTimeout(report, 500);
    injectFloatingButton(); // re-injetar se DOM mudou (SPA)
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[CadBrasil Extension] Content script ativo em:', window.location.href);
})();
