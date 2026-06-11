/**
 * Serviço de gerenciamento de janelas (Window Snap).
 * Mantém as janelas do SICAF e Assistente grudadas lado a lado.
 * Sincroniza minimizar/restaurar entre as duas janelas.
 *
 * Usa Win32 API (via PowerShell oculto) para efetivamente restaurar e trazer
 * janelas ao primeiro plano — necessário porque CDP sozinho não consegue
 * forçar foco em janelas de processos background no Windows.
 */
const { sleep } = require('../../../utils/helpers');
const { bringChromeToFront } = require('./chrome.service');

/**
 * Configura o snap de janelas e inicia o loop de sincronização.
 */
async function setupWindowSnap({ mainPage, assistantPage, browser }) {
  let snapLoop = null;

  try {
    // ═══ OBTER DIMENSÕES DA TELA ═══
    const screen = await mainPage.evaluate(() => ({
      w: screen.availWidth,
      h: screen.availHeight,
    }));
    const assistantW = Math.max(380, Math.round(screen.w * 0.28));
    const mainW = screen.w - assistantW;
    const h = screen.h - 40;

    const mainBounds = { left: 0, top: 0, width: mainW, height: h };
    const assistBounds = { left: mainW, top: 0, width: assistantW, height: h };

    // ═══ CONECTAR CDP PARA AMBAS AS JANELAS ═══
    const mainCdp = await mainPage.target().createCDPSession();
    const { windowId: mainWinId } = await mainCdp.send('Browser.getWindowForTarget');

    await sleep(300);
    const assistCdp = await assistantPage.target().createCDPSession();
    const { windowId: assistWinId } = await assistCdp.send('Browser.getWindowForTarget');

    // ═══ POSICIONAMENTO INICIAL ═══
    console.log('  [Snap] Posicionando janelas...');

    // Posicionar via CDP
    await cdpRestore(mainCdp, mainWinId, mainBounds);
    await sleep(200);
    await cdpRestore(assistCdp, assistWinId, assistBounds);
    await sleep(200);

    // Trazer ao primeiro plano via Win32 API (resolve o problema de abrir minimizado)
    bringChromeToFront();
    await sleep(500);

    // Reposicionar após o Win32 restore (pode ter mudado bounds)
    await cdpRestore(mainCdp, mainWinId, mainBounds);
    await sleep(200);
    await cdpRestore(assistCdp, assistWinId, assistBounds);
    await sleep(200);

    // Verificar e tentar novamente se necessário
    for (let retry = 0; retry < 3; retry++) {
      const mState = await getState(mainCdp, mainWinId);
      const aState = await getState(assistCdp, assistWinId);

      if (!mState.minimized && !aState.minimized) {
        console.log('  ✔ Ambas janelas visíveis e posicionadas');
        break;
      }

      console.log(`  [Snap] Tentativa ${retry + 2}: restaurando janelas...`);
      bringChromeToFront();
      await sleep(800);
      await cdpRestore(mainCdp, mainWinId, mainBounds);
      await cdpRestore(assistCdp, assistWinId, assistBounds);
      await sleep(500);
    }

    // ═══ SINCRONIZAR FECHAMENTO — Fechar uma aba fecha a outra ═══
    let closingPeer = false; // Evitar loop infinito de fechamento

    mainPage.on('close', () => {
      if (closingPeer) return;
      closingPeer = true;
      console.log('  [Snap] Aba SICAF fechada → fechando assistente...');
      if (snapLoop) clearInterval(snapLoop);
      assistantPage.close().catch(() => {});
    });

    assistantPage.on('close', () => {
      if (closingPeer) return;
      closingPeer = true;
      console.log('  [Snap] Aba Assistente fechada → fechando SICAF...');
      if (snapLoop) clearInterval(snapLoop);
      mainPage.close().catch(() => {});
    });

    // ═══ SNAP LOOP — Manter grudados + sincronizar minimizar/restaurar ═══
    let bothMinimized = false;
    let snapBusy = false;
    let cooldownUntil = 0;

    snapLoop = setInterval(async () => {
      if (snapBusy) return;
      if (Date.now() < cooldownUntil) return;
      snapBusy = true;

      try {
        const mState = await getState(mainCdp, mainWinId);
        const aState = await getState(assistCdp, assistWinId);
        const mMin = mState.minimized;
        const aMin = aState.minimized;

        // ── AMBAS MINIMIZADAS → marcar flag e aguardar ──
        if (mMin && aMin) {
          bothMinimized = true;
          snapBusy = false;
          return;
        }

        // ── Uma restaurada pelo usuário, outra minimizada → restaurar a outra ──
        if (bothMinimized && (!mMin || !aMin)) {
          console.log('  [Snap] Restaurando janelas coladas...');

          // Restaurar a que está minimizada via CDP
          if (mMin) await cdpRestore(mainCdp, mainWinId, mainBounds);
          if (aMin) await cdpRestore(assistCdp, assistWinId, assistBounds);

          // Win32 API para realmente trazer ambas ao primeiro plano
          bringChromeToFront();
          await sleep(500);

          // Reposicionar após Win32 restore
          const freshMain = await getState(mainCdp, mainWinId);
          if (!freshMain.minimized) {
            const b = freshMain.bounds;
            await cdpSetBounds(assistCdp, assistWinId, {
              left: b.left + b.width, top: b.top, width: assistantW, height: b.height,
            });
          }

          bothMinimized = false;
          cooldownUntil = Date.now() + 2000;
          snapBusy = false;
          return;
        }

        // ── Uma minimizada pelo usuário → minimizar a outra ──
        if (!bothMinimized && mMin && !aMin) {
          await cdpMinimize(assistCdp, assistWinId);
          bothMinimized = true;
          cooldownUntil = Date.now() + 2000;
          snapBusy = false;
          return;
        }
        if (!bothMinimized && aMin && !mMin) {
          await cdpMinimize(mainCdp, mainWinId);
          bothMinimized = true;
          cooldownUntil = Date.now() + 2000;
          snapBusy = false;
          return;
        }

        // ── Ambas normais → manter assistente grudado à direita ──
        if (!mMin && !aMin && mState.state !== 'fullscreen') {
          const b = mState.bounds;
          await cdpSetBounds(assistCdp, assistWinId, {
            left: b.left + b.width, top: b.top, width: assistantW, height: b.height,
          });
        }
      } catch (e) {
        // NÃO matar o snap loop — apenas logar e continuar
        // O loop será recriado após reconexão se necessário
        if (e.message && (e.message.includes('Target closed') || e.message.includes('Session closed') || e.message.includes('detached'))) {
          // CDP desconectado (provavelmente Fase 2) — pausar silenciosamente
        }
      }
      snapBusy = false;
    }, 700);

    console.log('  ✔ Assistente grudado à direita');

    return {
      cleanup: () => {
        if (snapLoop) clearInterval(snapLoop);
      },
    };
  } catch (e) {
    console.log(`  ℹ Popup: ${e.message.substring(0, 50)}`);
    return { cleanup: () => {} };
  }
}

// ═══ HELPERS CDP ═══

/** Obtém estado da janela */
async function getState(cdp, windowId) {
  const { bounds } = await cdp.send('Browser.getWindowBounds', { windowId });
  return {
    minimized: bounds.windowState === 'minimized',
    state: bounds.windowState,
    bounds,
  };
}

/** Restaura janela via CDP (estado normal + posição) */
async function cdpRestore(cdp, windowId, bounds) {
  try {
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'normal' },
    });
    await sleep(100);
    if (bounds) {
      await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      });
    }
  } catch (_) {}
}

/** Define apenas bounds (sem mudar estado) */
async function cdpSetBounds(cdp, windowId, bounds) {
  try {
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
    });
  } catch (_) {}
}

/** Minimiza janela via CDP */
async function cdpMinimize(cdp, windowId) {
  try {
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'minimized' },
    });
  } catch (_) {}
}

module.exports = { setupWindowSnap };
