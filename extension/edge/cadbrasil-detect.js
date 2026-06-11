/**
 * CadBrasil Extension — Auto-detect script
 *
 * Roda nas páginas do portal CadBrasil (localhost + produção).
 * Anuncia a presença da extensão para que o React consiga se comunicar
 * sem precisar saber o ID da extensão previamente.
 *
 * Fluxo:
 *   1. Seta atributo data-cadbrasil-extension-id no <html>
 *   2. Dispara evento customizado "cadbrasil-extension-ready"
 *   3. Escuta mensagens via window.postMessage e faz proxy para o background
 */

(function () {
  const extensionId = chrome.runtime.id;

  function announcePresence() {
    document.documentElement.setAttribute('data-cadbrasil-extension-id', extensionId);
    window.dispatchEvent(new CustomEvent('cadbrasil-extension-ready', {
      detail: { extensionId, version: chrome.runtime.getManifest().version }
    }));
  }

  announcePresence();

  window.addEventListener('cadbrasil-extension-probe', announcePresence);

  // Escutar mensagens do portal via postMessage (proxy para background)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'cadbrasil-portal-message') return;

    const { action, payload } = event.data;

    chrome.runtime.sendMessage({ action, ...payload }, (response) => {
      window.postMessage({
        type: 'cadbrasil-extension-response',
        action,
        response: response || { ok: false, error: chrome.runtime.lastError?.message }
      }, '*');
    });
  });
})();
