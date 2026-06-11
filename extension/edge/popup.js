document.getElementById('btnOpen').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'open-sicaf' });
  window.close();
});

document.getElementById('btnPanel').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const sidePanelApi = chrome['side' + 'Panel'];
  if (tab && sidePanelApi?.open) {
    await sidePanelApi.open({ tabId: tab.id });
  } else if (typeof browser !== 'undefined' && browser.sidebarAction?.open) {
    await browser.sidebarAction.open();
  } else {
    await chrome.tabs.create({ url: chrome.runtime.getURL('sidebar.html'), active: true });
  }
  window.close();
});

// Verificar status
chrome.runtime.sendMessage({ type: 'get-state' }, (res) => {
  if (res && res.state) {
    const el = document.getElementById('status');
    if (res.state.step !== 'idle') {
      el.className = 'status active';
      el.textContent = res.state.loggedIn
        ? `✅ Logado — ${res.state.clientData?.nome || 'SICAF ativo'}`
        : `🔗 SICAF aberto — ${res.state.step}`;
    }
  }
});
